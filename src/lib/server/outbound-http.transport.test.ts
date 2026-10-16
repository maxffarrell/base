import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { outboundFetch } from './outbound-http.ts';

afterEach(() => vi.unstubAllEnvs());

it('reaches only an operator-approved loopback service and preserves POST bytes', async () => {
	let calls = 0;
	let received = '';
	const server = createServer(async (req, res) => {
		calls++;
		for await (const chunk of req) received += chunk.toString();
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ signature: req.headers['x-signature'] }));
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	try {
		vi.stubEnv('OUTBOUND_PRIVATE_ORIGINS', '');
		await expect(outboundFetch(origin)).rejects.toThrow('public');
		expect(calls).toBe(0);
		vi.stubEnv('OUTBOUND_PRIVATE_ORIGINS', origin);
		const response = await outboundFetch(`${origin}/hook`, {
			method: 'POST',
			headers: { 'x-signature': 'test_not_real' },
			body: '{"event":"created"}'
		});
		expect(await response.json()).toEqual({ signature: 'test_not_real' });
		expect(received).toBe('{"event":"created"}');
		expect(calls).toBe(1);
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	}
});
