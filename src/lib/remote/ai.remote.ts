import '#lib/modules/index.ts';
import '#lib/modules/server.ts';
import { command, query } from '$app/server';
import * as v from 'valibot';
import { aiStatus, complete, parseJson, type AiStatus } from '#lib/server/ai.ts';
import { requireOrg } from '#lib/server/context.ts';
import { recordTitle } from '#lib/entities.ts';
import { getEntity, type EntityRegistration } from '#lib/server/entities/registry.ts';
import { getRecord, listRecords } from '#lib/server/services/entity.ts';
import { idSchema } from '#lib/schemas.ts';

const entityName = v.pipe(v.string(), v.minLength(1), v.maxLength(60));

/** Public status — never exposes the API key. */
export const getAiStatus = query(async (): Promise<AiStatus> => {
	await requireOrg();
	return aiStatus();
});

const fieldHints = (reg: EntityRegistration) =>
	reg.def.fields
		.map((f) => {
			const bits = [f.key, `(${f.label}${f.required ? ', required' : ''}, type: ${f.type}`];
			if (f.options?.length) bits.push(`, one of: ${f.options.join('|')}`);
			if (f.type === 'link' && f.linkTo) bits.push(`, id of a ${f.linkTo} record`);
			bits.push(')');
			return bits.join('');
		})
		.join('\n');

/** Plain-language summary of one record (and the records it links to). */
export const aiSummarize = command(
	v.strictObject({ entity: entityName, id: idSchema }),
	async ({ entity, id }): Promise<string> => {
		const ctx = await requireOrg();
		const reg = getEntity(entity);
		const record = await getRecord(ctx.orgId, entity, id);
		const title = recordTitle(reg.def, record);
		const fields = reg.def.fields
			.map((f) => `${f.label}: ${JSON.stringify(record[f.key] ?? null)}`)
			.join('\n');
		return complete([
			{
				role: 'system',
				content:
					'You summarize business records inside a work app. Be concrete: what this record is, what stands out, anything missing or worth following up. 3-6 sentences, no headings, no flattery.'
			},
			{
				role: 'user',
				content: `Entity: ${reg.def.label} "${title}"\n\nFields:\n${fields}`
			}
		]);
	}
);

/** Free text → suggested field values for the create/edit form. */
export const aiDraft = command(
	v.strictObject({
		entity: entityName,
		text: v.pipe(v.string(), v.minLength(2), v.maxLength(4000))
	}),
	async ({ entity, text }): Promise<Record<string, unknown>> => {
		const ctx = await requireOrg();
		const reg = getEntity(entity);
		const raw = await complete(
			[
				{
					role: 'system',
					content: `You convert a user's description into JSON field values for a "${reg.def.label}" record in a work app.
Reply with ONLY a JSON object of field keys to values. Rules:
- Use only these fields:\n${fieldHints(reg)}
- select fields must use one of the listed options exactly.
- number/currency fields must be numbers (currency in cents).
- link fields: the user's text may name a related record; put the NAME as a string — do not invent ids.
- Omit fields you can't infer. No commentary, no markdown.`
				},
				{ role: 'user', content: text }
			],
			1500
		);
		const parsed = parseJson<Record<string, unknown>>(raw) ?? {};
		const allowed = new Set(reg.def.fields.filter((f) => !f.readonly).map((f) => f.key));
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(parsed)) {
			if (!allowed.has(k) || val == null) continue;
			const f = reg.def.fields.find((x) => x.key === k)!;
			if (f.type === 'select' && f.options && !f.options.includes(String(val))) continue;
			out[k] = val;
		}
		// Resolve link fields that came back as names into record ids.
		for (const f of reg.def.fields.filter((x) => x.type === 'link' && x.linkTo)) {
			const val = out[f.key];
			if (typeof val !== 'string' || !val.trim()) continue;
			const target = getEntity(f.linkTo!);
			const { rows } = await listRecords(ctx.orgId, f.linkTo!, { q: val, limit: 1 });
			if (rows[0] && recordTitle(target.def, rows[0]).toLowerCase() === val.toLowerCase())
				out[f.key] = rows[0].id;
			else if (rows[0]) out[f.key] = rows[0].id;
			else delete out[f.key];
		}
		return out;
	}
);

/** Ask a question about an entity's records (first page as context). */
export const aiAsk = command(
	v.strictObject({
		entity: entityName,
		question: v.pipe(v.string(), v.minLength(2), v.maxLength(2000))
	}),
	async ({ entity, question }): Promise<string> => {
		const ctx = await requireOrg();
		const reg = getEntity(entity);
		const { rows, count } = await listRecords(ctx.orgId, entity, { limit: 50 });
		const lines = rows.map((r) =>
			reg.def.fields.map((f) => `${f.key}=${JSON.stringify(r[f.key] ?? null)}`).join(', ')
		);
		return complete(
			[
				{
					role: 'system',
					content: `You answer questions about "${reg.def.labelPlural ?? `${reg.def.label}s`}" records in a work app. Answer from the data given; say plainly when it isn't in the data. Be brief — 1-4 sentences or a short list. If the data was truncated, mention the total count.`
				},
				{
					role: 'user',
					content: `Records (${count} total, showing ${rows.length}):\n${lines.join('\n') || '(none)'}\n\nQuestion: ${question}`
				}
			],
			800
		);
	}
);
