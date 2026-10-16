import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { setClientAddress } from '../../../scripts/proxy-headers.ts';

describe('forwarded client address boundary', () => {
	const request = (peer: string, forwarded = '203.0.113.44') =>
		({
			headers: { 'x-forwarded-for': forwarded },
			socket: { remoteAddress: peer }
		}) as unknown as Pick<IncomingMessage, 'headers' | 'socket'>;
	it('replaces spoofed direct headers', () => {
		const req = request('198.51.100.2', '127.0.0.1, 203.0.113.44');
		setClientAddress(req, '');
		expect(req.headers['x-forwarded-for']).toBe('198.51.100.2');
	});
	it('trusts only exact configured socket peers', () => {
		const req = request('::ffff:10.0.0.1');
		setClientAddress(req, ' ::ffff:10.0.0.1 , 10.0.0.2 ');
		expect(req.headers['x-forwarded-for']).toBe('203.0.113.44');
		const direct = request('10.0.0.10');
		setClientAddress(direct, '10.0.0.1');
		expect(direct.headers['x-forwarded-for']).toBe('10.0.0.10');
	});
});
