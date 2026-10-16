import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

const LIMIT = 16 * 1024 * 1024;

export function isPublicAddress(address: string): boolean {
	if (isIP(address) === 4) {
		const [a, b, c] = address.split('.').map(Number);
		return !(
			a === 0 ||
			a === 10 ||
			a === 127 ||
			a >= 224 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 192 && b === 0 && (c === 0 || c === 2)) ||
			(a === 192 && b === 88 && c === 99) ||
			(a === 198 && (b === 18 || b === 19)) ||
			(a === 198 && b === 51 && c === 100) ||
			(a === 203 && b === 0 && c === 113)
		);
	}
	if (isIP(address) !== 6) return false;
	// Only global unicast; exclude special-use, mapped/compatible IPv4 and tunnels.
	const [head, next] = address.toLowerCase().split(':');
	const first = parseInt(head || '0', 16);
	const second = parseInt(next || '0', 16);
	return (
		first >= 0x2000 &&
		first <= 0x3fff &&
		!(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
		first !== 0x2002 &&
		!(first === 0x3fff && second < 0x1000)
	);
}

function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		if (signal.aborted) return abort();
		signal.addEventListener('abort', abort, { once: true });
		pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}

/** Resolve once, validate every answer, then pin the connection to that address. */
export const outboundFetch: typeof fetch = async (input, init = {}) => {
	const source = input instanceof Request ? input : null;
	const url = new URL(source ? source.url : String(input));
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
		throw new Error('Outbound requests require an HTTP(S) URL without credentials');
	const signal = AbortSignal.any([
		AbortSignal.timeout(10_000),
		...(init.signal ? [init.signal] : source ? [source.signal] : [])
	]);
	signal.throwIfAborted();
	const allowPrivate = (process.env.OUTBOUND_PRIVATE_ORIGINS ?? '').split(',').some((entry) => {
		try {
			const allowed = new URL(entry.trim());
			return (
				!allowed.username &&
				!allowed.password &&
				allowed.pathname === '/' &&
				!allowed.search &&
				!allowed.hash &&
				allowed.origin === url.origin
			);
		} catch {
			return false;
		}
	});
	const hostname = url.hostname.replace(/^\[|\]$/g, '');
	const addresses = isIP(hostname)
		? [{ address: hostname, family: isIP(hostname) }]
		: await abortable(lookup(hostname, { all: true, verbatim: true }), signal);
	if (
		!addresses.length ||
		addresses.some((a) => !isIP(a.address) || (!allowPrivate && !isPublicAddress(a.address)))
	)
		throw new Error('Outbound destination is not a public network address');
	const selected = addresses[0];
	const method = (init.method ?? source?.method ?? 'GET').toUpperCase();
	const headers = new Headers(init.headers ?? source?.headers);
	let body: Buffer | undefined;
	if (init.body != null) {
		if (typeof init.body === 'string' || init.body instanceof URLSearchParams)
			body = Buffer.from(String(init.body));
		else if (init.body instanceof ArrayBuffer) body = Buffer.from(init.body);
		else if (ArrayBuffer.isView(init.body))
			body = Buffer.from(init.body.buffer, init.body.byteOffset, init.body.byteLength);
		else throw new Error('Unsupported outbound request body');
	} else if (source?.body)
		body = Buffer.from(await abortable(source.clone().arrayBuffer(), signal));
	if (body && body.length > LIMIT) throw new Error('Outbound request body exceeds limit');
	if ((method === 'GET' || method === 'HEAD') && body)
		throw new Error('GET/HEAD requests cannot have a body');
	for (const name of ['host', 'connection', 'content-length', 'transfer-encoding'])
		headers.delete(name);
	if (body) headers.set('content-length', String(body.length));
	return new Promise<Response>((resolve, reject) => {
		const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
		const req = request(
			url,
			{
				method,
				headers: Object.fromEntries(headers),
				signal,
				agent: false,
				maxHeaderSize: 32 * 1024,
				lookup: (_host, options, callback) => {
					if (typeof options === 'object' && options.all) callback(null, [selected]);
					else callback(null, selected.address, selected.family);
				}
			},
			(res) => {
				const status = res.statusCode ?? 502;
				if (status >= 300 && status < 400) {
					res.destroy();
					req.destroy();
					reject(new Error('Outbound redirects are not allowed'));
					return;
				}
				let size = 0;
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer) => {
					size += chunk.length;
					if (size > LIMIT) {
						req.destroy(new Error('Outbound response exceeds limit'));
						res.destroy();
					} else chunks.push(chunk);
				});
				res.on('error', reject);
				res.on('end', () => {
					const responseHeaders = new Headers();
					for (const [name, value] of Object.entries(res.headers)) {
						if (Array.isArray(value)) value.forEach((v) => responseHeaders.append(name, v));
						else if (value !== undefined) responseHeaders.set(name, value);
					}
					try {
						let payload = Buffer.concat(chunks);
						const encoding = responseHeaders.get('content-encoding')?.toLowerCase();
						const decoder =
							encoding === 'gzip'
								? gunzipSync
								: encoding === 'deflate'
									? inflateSync
									: encoding === 'br'
										? brotliDecompressSync
										: null;
						if (decoder) {
							payload = decoder(payload, { maxOutputLength: LIMIT });
							responseHeaders.delete('content-encoding');
							responseHeaders.delete('content-length');
						}
						resolve(
							new Response(method === 'HEAD' || [204, 205, 304].includes(status) ? null : payload, {
								status,
								headers: responseHeaders
							})
						);
					} catch (error) {
						reject(error);
					}
				});
			}
		);
		req.on('error', reject);
		req.end(body);
	});
};
