import type { IncomingMessage } from 'node:http';

export function setClientAddress(
	req: Pick<IncomingMessage, 'headers' | 'socket'>,
	trustedPeers = process.env.TRUSTED_PROXY_IPS ?? ''
) {
	const peer = req.socket.remoteAddress;
	const trusted = trustedPeers
		.split(',')
		.map((ip) => ip.trim())
		.filter(Boolean);
	if (!peer || !trusted.includes(peer) || !req.headers['x-forwarded-for']) {
		delete req.headers['x-forwarded-for'];
		if (peer) req.headers['x-forwarded-for'] = peer;
	}
}
