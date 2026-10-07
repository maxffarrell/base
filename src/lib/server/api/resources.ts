import '#lib/modules/index.ts';
import '#lib/modules/server.ts';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import type { OrgContext } from '#lib/server/context.ts';
import { entityLabel } from '#lib/entities.ts';
import { listEntities } from '#lib/server/entities/registry.ts';
import {
	createRecord,
	deleteRecord,
	getRecord,
	inputSchema,
	listRecords,
	updateInputSchema,
	updateRecord
} from '#lib/server/services/entity.ts';

type Resource = {
	description: string;
	list: (ctx: OrgContext, url: URL) => Promise<unknown>;
	get?: (ctx: OrgContext, id: string) => Promise<unknown>;
	create?: { schema: v.GenericSchema; run: (ctx: OrgContext, input: never) => Promise<unknown> };
	update?: { schema: v.GenericSchema; run: (ctx: OrgContext, input: never) => Promise<unknown> };
	delete?: (ctx: OrgContext, id: string) => Promise<unknown>;
};

/**
 * Public REST surface, mirrored by the OpenAPI document. It is generated from
 * the entity registry: registering an entity automatically exposes
 * list/get/create/update/delete under its plural resource name, running the
 * same generic service (and hooks) as the UI.
 */
export const resources: Record<string, Resource> = Object.fromEntries(
	listEntities().map((reg) => [
		reg.def.name,
		{
			description: reg.def.description ?? entityLabel(reg.def),
			list: (ctx: OrgContext, url: URL) =>
				listRecords(ctx.orgId, reg.def.name, {
					q: url.searchParams.get('q') ?? undefined,
					filters: Object.fromEntries(
						reg.def.fields
							.filter((f) => f.filterable)
							.map((f) => [f.key, url.searchParams.get(f.key)] as const)
							.filter(([, value]) => value != null)
					) as Record<string, string>,
					sort: url.searchParams.get('sort') ?? undefined,
					dir: url.searchParams.get('dir') === 'asc' ? 'asc' : undefined,
					limit: Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 200),
					offset: Number(url.searchParams.get('offset') ?? 0) || 0
				}),
			get: (ctx: OrgContext, id: string) => getRecord(ctx.orgId, reg.def.name, id),
			create: {
				schema: inputSchema(reg.def),
				run: ((ctx: OrgContext, input: Record<string, unknown>) =>
					createRecord(ctx, reg.def.name, input)) as never
			},
			update: {
				schema: updateInputSchema(reg.def),
				run: ((ctx: OrgContext, input: Record<string, unknown> & { id: string }) => {
					const { id, ...data } = input;
					return updateRecord(ctx, reg.def.name, id, data);
				}) as never
			},
			delete: (ctx: OrgContext, id: string) => deleteRecord(ctx, reg.def.name, id)
		}
	])
);

export function resource(name: string): Resource {
	const r = resources[name];
	if (!r) error(404, `Unknown resource: ${name}`);
	return r;
}

/** Parses and validates a JSON request body; `extra` fields are merged in first (e.g. path id). */
export async function parseBody(
	schema: v.GenericSchema,
	request: Request,
	extra: Record<string, unknown> = {}
) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}
	const parsed = v.safeParse(schema, { ...(body as object), ...extra });
	if (!parsed.success) {
		const first = parsed.issues[0];
		error(422, `${first?.path?.[0]?.key ?? 'input'}: ${first?.message ?? 'invalid'}`);
	}
	return parsed.output;
}
