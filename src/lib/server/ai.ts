/* @license Enterprise */

import { AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_PROVIDER } from '$app/env/private';
import { error } from '@sveltejs/kit';
import { hasFeature } from '#lib/server/ee/license.ts';

/**
 * Provider-agnostic AI layer for enterprise features. No key or model ships with
 * Base: the operator picks a provider and model via env (`AI_PROVIDER`,
 * `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`), so any OpenAI-compatible endpoint —
 * OpenAI itself, Ollama, vLLM, Azure, a gateway — works, plus Anthropic.
 * The API key never reaches the browser.
 */

export interface AiStatus {
	licensed: boolean;
	configured: boolean;
	provider: string | null;
	model: string | null;
}

export function aiStatus(): AiStatus {
	return {
		licensed: hasFeature('ai'),
		configured: !!AI_API_KEY && !!AI_PROVIDER,
		provider: AI_PROVIDER ?? null,
		model: AI_MODEL ?? null
	};
}

export function aiAvailable(): boolean {
	const s = aiStatus();
	return s.licensed && s.configured;
}

function requireAi() {
	const s = aiStatus();
	if (!s.licensed) error(402, 'AI features require Base Cloud or an Enterprise license');
	if (!s.configured)
		error(503, 'No AI provider configured — set AI_PROVIDER, AI_API_KEY and AI_MODEL');
}

const DEFAULT_URLS = {
	openai: 'https://api.openai.com/v1',
	anthropic: 'https://api.anthropic.com'
} as const;

export interface AiMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/** One completion round-trip. Returns the assistant's text content. */
export async function complete(messages: AiMessage[], maxTokens = 1024): Promise<string> {
	requireAi();
	const provider = AI_PROVIDER as 'openai' | 'anthropic';
	const base = (AI_BASE_URL ?? DEFAULT_URLS[provider]).replace(/\/$/, '');
	const model = AI_MODEL ?? (provider === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-4o-mini');

	const res =
		provider === 'anthropic'
			? await fetch(`${base}/v1/messages`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						'x-api-key': AI_API_KEY!,
						'anthropic-version': '2023-06-01'
					},
					body: JSON.stringify({
						model,
						max_tokens: maxTokens,
						system: messages.find((m) => m.role === 'system')?.content,
						messages: messages.filter((m) => m.role !== 'system')
					})
				})
			: await fetch(`${base}/chat/completions`, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						authorization: `Bearer ${AI_API_KEY}`
					},
					body: JSON.stringify({ model, max_tokens: maxTokens, messages })
				});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		error(502, `AI provider returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
	}
	const json = (await res.json()) as {
		choices?: { message?: { content?: string } }[];
		content?: { type: string; text?: string }[];
	};
	const text =
		provider === 'anthropic'
			? (json.content?.find((c) => c.type === 'text')?.text ?? '')
			: (json.choices?.[0]?.message?.content ?? '');
	if (!text.trim()) error(502, 'AI provider returned an empty response');
	return text.trim();
}

/** Extract the first JSON object in a model response, tolerant of code fences. */
export function parseJson<T>(text: string): T | null {
	const match = text.match(/\{[\s\S]*\}/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]) as T;
	} catch {
		return null;
	}
}
