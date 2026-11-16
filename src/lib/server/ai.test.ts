import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(
	() =>
		({
			AI_PROVIDER: 'anthropic',
			AI_API_KEY: 'test-key',
			AI_MODEL: 'test-model',
			AI_BASE_URL: undefined
		}) as Record<string, string | undefined>
);
vi.mock('$app/env/private', () => env);
vi.mock('#lib/server/ee/license.ts', () => ({ hasFeature: () => true }));

beforeEach(() => {
	vi.resetModules();
	env.AI_BASE_URL = undefined;
});
afterEach(() => vi.unstubAllGlobals());

describe('Anthropic Messages API contract', () => {
	it('uses the new API version with text messages and a separate system prompt', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			Response.json({
				content: [
					{ type: 'thinking', thinking: 'internal' },
					{ type: 'text', text: '  Completed  ' }
				]
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		const { complete } = await import('./ai.ts');
		expect(
			await complete(
				[
					{ role: 'system', content: 'Be concise' },
					{ role: 'system', content: 'Safety first — sensible volume and progressions.' },
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi' },
					{ role: 'user', content: 'Continue' }
				],
				321
			)
		).toBe('Completed');
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, request] = fetchMock.mock.calls[0];
		expect(url).toBe('https://api.anthropic.com/v1/messages');
		expect(request.method).toBe('POST');
		expect(request.headers).toEqual({
			'content-type': 'application/json',
			'x-api-key': 'test-key',
			'anthropic-version': '2026-10-21'
		});
		expect(JSON.parse(request.body)).toEqual({
			model: 'test-model',
			max_tokens: 321,
			system: 'Be concise\n\nSafety first — sensible volume and progressions.',
			messages: [
				{ role: 'user', content: 'Hello' },
				{ role: 'assistant', content: 'Hi' },
				{ role: 'user', content: 'Continue' }
			]
		});
	});

	it('omits the system field when no system message is supplied', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(Response.json({ content: [{ type: 'text', text: 'Hello' }] }));
		vi.stubGlobal('fetch', fetchMock);
		const { complete } = await import('./ai.ts');
		expect(await complete([{ role: 'user', content: 'Hello' }])).toBe('Hello');
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			model: 'test-model',
			max_tokens: 1024,
			messages: [{ role: 'user', content: 'Hello' }]
		});
	});

	it('surfaces provider errors instead of treating them as successful text', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }))
		);
		const { complete } = await import('./ai.ts');
		await expect(complete([{ role: 'user', content: 'Hello' }])).rejects.toMatchObject({
			status: 502,
			body: { message: 'AI provider returned 429: rate limited' }
		});
	});
});
