/**
 * Generic CRUD service — the "ORM over arbitrary DocTypes" layer. One code path
 * serves the remote functions, the REST API, the generic UI, and workflow
 * actions; every mutation runs the entity's hook lifecycle and emits an event
 * (activity feed + webhooks + workflows + integrations fan out from there).
 */
import {
	and,
	asc,
	desc,
	eq,
	getTableColumns,
	ilike,
	inArray,
	isNotNull,
	isNull,
	or,
	sql,
	type AnyColumn,
	type SQL
} from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import type { EntityDef, EntityField } from '#lib/entities.ts';
import { recordTitle } from '#lib/entities.ts';
import type { OrgContext } from '#lib/server/context.ts';
import { db } from '#lib/server/db/index.ts';
import { emit } from '#lib/server/services/events.ts';
import {
	getEntity,
	type EntityRecord,
	type EntityRegistration
} from '#lib/server/entities/registry.ts';

export type ListOptions = {
	q?: string;
	filters?: Record<string, string>;
	sort?: string;
	dir?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
	/** archivable entities only: list archived records instead of active ones. */
	archivedOnly?: boolean;
};

function fieldSchema(f: EntityField): v.GenericSchema {
	let s: v.GenericSchema;
	switch (f.type) {
		case 'number':
		case 'currency':
			s = v.number();
			break;
		case 'boolean':
			s = v.boolean();
			break;
		case 'select':
			s = v.picklist(f.options ?? []);
			break;
		case 'date':
			s = v.pipe(v.string(), v.isoDate());
			break;
		case 'email':
			s = v.pipe(v.string(), v.email());
			break;
		case 'url':
			s = v.pipe(v.string(), v.url());
			break;
		default:
			s = v.pipe(v.string(), v.maxLength(2000));
	}
	if (f.min !== undefined)
		s = v.pipe(s as v.GenericSchema<number>, v.minValue(f.min, `${f.label} must be ≥ ${f.min}`));
	if (f.max !== undefined)
		s = v.pipe(s as v.GenericSchema<number>, v.maxValue(f.max, `${f.label} must be ≤ ${f.max}`));
	if (f.pattern && f.type !== 'number' && f.type !== 'currency' && f.type !== 'boolean')
		s = v.pipe(
			s as v.GenericSchema<string>,
			v.regex(new RegExp(f.pattern), `${f.label} is invalid`)
		);
	if (f.required)
		return f.type === 'boolean' || f.type === 'number' || f.type === 'currency'
			? s
			: v.pipe(s as v.GenericSchema<string>, v.nonEmpty(`${f.label} is required`));
	return v.nullish(s);
}

/** Valibot schema generated from field defs — the API/UI share one validation source. */
export function inputSchema(def: EntityDef): v.GenericSchema {
	return v.strictObject(
		Object.fromEntries(def.fields.filter((f) => !f.readonly).map((f) => [f.key, fieldSchema(f)]))
	) as v.GenericSchema;
}

/** Update variant: same fields plus `id` (merged in by the REST route). */
export function updateInputSchema(def: EntityDef): v.GenericSchema {
	return v.looseObject({
		id: v.string(),
		...Object.fromEntries(def.fields.filter((f) => !f.readonly).map((f) => [f.key, fieldSchema(f)]))
	}) as v.GenericSchema;
}

function validateInput(
	def: EntityDef,
	input: Record<string, unknown>,
	partial = false
): Record<string, unknown> {
	// Updates are partial: only provided keys are validated (required fields
	// don't have to be resent, but a provided one must still pass its schema).
	const schema = partial
		? v.looseObject(
				Object.fromEntries(
					def.fields
						.filter((f) => !f.readonly && f.key in input)
						.map((f) => [f.key, fieldSchema(f)])
				)
			)
		: inputSchema(def);
	const parsed = v.safeParse(schema as v.GenericSchema, input);
	if (!parsed.success) {
		const first = parsed.issues[0];
		error(422, `${first?.path?.[0]?.key ?? 'input'}: ${first?.message ?? 'invalid'}`);
	}
	return parsed.output as Record<string, unknown>;
}

function checkTransition(def: EntityDef, input: Record<string, unknown>, existing?: EntityRecord) {
	if (!existing) return;
	for (const f of def.fields) {
		const rules = f.transitions;
		if (!rules || !(f.key in input)) continue;
		const from: string = String(existing[f.key] ?? '');
		const to: string = String(input[f.key] ?? '');
		if (to !== from && rules[from] && !rules[from].includes(to))
			error(422, `${f.label} cannot change from "${from}" to "${to}"`);
	}
}

export async function listRecords(
	orgId: string,
	name: string,
	{ q, filters, sort, dir, limit = 50, offset = 0, archivedOnly }: ListOptions = {}
) {
	const reg = getEntity(name);
	const { def, table } = reg;
	const conds = [eq(table.organizationId, orgId)];
	if (def.archivable && table.archivedAt)
		conds.push(archivedOnly ? isNotNull(table.archivedAt) : isNull(table.archivedAt));

	const searchKeys = def.searchFields ?? [def.titleField ?? 'name'];
	if (q?.trim()) {
		const cols = searchKeys
			.map((k) => table[k])
			.filter((c): c is NonNullable<typeof c> => Boolean(c));
		if (cols.length) conds.push(or(...cols.map((c) => ilike(c, `%${q.trim()}%`)))!);
	}
	for (const [key, value] of Object.entries(filters ?? {})) {
		const field = def.fields.find((f) => f.key === key);
		const col = table[key];
		if (!field || !col || value === '' || value == null) continue;
		conds.push(eq(col, field.type === 'boolean' ? value === 'true' : value));
	}

	const sortKey = sort && table[sort] ? sort : (def.defaultSort?.key ?? 'createdAt');
	const order = (dir ?? def.defaultSort?.dir) === 'asc' ? asc : desc;
	const sortCol = table[sortKey] ?? table.createdAt;

	const [rows, [{ count }]] = await Promise.all([
		db
			.select()
			.from(table)
			.where(and(...conds))
			.orderBy(order(sortCol), desc(table.createdAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)`.mapWith(Number) })
			.from(table)
			.where(and(...conds))
	]);
	return { rows, count };
}

/** Group-by aggregate for the report builder: count + optional numeric sum. */
export async function entityReport(
	orgId: string,
	name: string,
	groupBy: string,
	sumField?: string
) {
	const reg = getEntity(name);
	const { def, table } = reg;
	const gf = def.fields.find(
		(f) =>
			f.key === groupBy &&
			(f.type === 'select' || f.type === 'boolean' || f.type === 'link' || f.type === 'user')
	);
	const gcol = table[groupBy];
	if (!gf || !gcol) error(422, 'Cannot group by that field');
	const sf = sumField
		? def.fields.find((f) => f.key === sumField && (f.type === 'currency' || f.type === 'number'))
		: null;
	if (sumField && (!sf || !table[sumField])) error(422, 'Cannot sum that field');

	const conds = [eq(table.organizationId, orgId)];
	if (def.archivable && table.archivedAt) conds.push(isNull(table.archivedAt));
	const rows = await db
		.select({
			key: gcol,
			count: sql<number>`count(*)::int`,
			sum: sf ? sql<number>`coalesce(sum(${table[sumField!]}),0)::bigint` : sql<number>`0`
		})
		.from(table)
		.where(and(...conds))
		.groupBy(gcol)
		.orderBy(desc(sql`2`));
	return rows.map((r) => ({ key: String(r.key ?? ''), count: r.count, sum: Number(r.sum) }));
}

export async function getRecord(orgId: string, name: string, id: string): Promise<EntityRecord> {
	const reg = getEntity(name);
	const [row] = await db
		.select()
		.from(reg.table)
		.where(and(eq(reg.table.organizationId, orgId), eq(reg.table.id, id)));
	if (!row) error(404, `${reg.def.label} not found`);
	return row as EntityRecord;
}

/** Options for a `link` field: id + display title pairs, for select dropdowns. */
export async function linkOptions(orgId: string, name: string) {
	const reg = getEntity(name);
	const { rows } = await listRecords(orgId, name, { limit: 200 });
	return rows.map((r) => ({ id: r.id as string, title: recordTitle(reg.def, r) }));
}

async function write(
	ctx: OrgContext,
	reg: EntityRegistration,
	input: Record<string, unknown>,
	existing?: EntityRecord
): Promise<EntityRecord> {
	const { def, table, hooks } = reg;
	const opts = { existing };

	if (def.adminOnly && ctx.role === 'member')
		error(403, `Only admins can modify ${def.labelPlural}`);

	const transformed = (await hooks?.beforeValidate?.(ctx, input, opts)) ?? input;
	// Field defaults apply on create only.
	if (!existing)
		for (const f of def.fields)
			if (f.default !== undefined && transformed[f.key] == null) transformed[f.key] = f.default;
	const data = validateInput(def, transformed, !!existing);
	checkTransition(def, data, existing);
	const message = await hooks?.validate?.(ctx, data, opts);
	if (typeof message === 'string') error(422, message);
	await hooks?.beforeSave?.(ctx, data, opts);

	const values = Object.fromEntries(
		def.fields.filter((f) => !f.readonly && f.key in data).map((f) => [f.key, data[f.key]])
	);

	// Server-side uniqueness for `unique` fields.
	const cols = getTableColumns(table) as unknown as Record<string, AnyColumn>;
	for (const f of def.fields) {
		if (!f.unique || values[f.key] == null) continue;
		const conds: SQL[] = [
			eq(table.organizationId, ctx.orgId),
			eq(cols[f.key]!, values[f.key] as never)
		];
		if (existing) conds.push(sql`${table.id} <> ${existing.id}`);
		const [clash] = await db
			.select({ id: table.id })
			.from(table)
			.where(and(...conds))
			.limit(1);
		if (clash) error(409, `${def.label} with this ${f.label.toLowerCase()} already exists`);
	}

	let row: EntityRecord | undefined;
	if (existing) {
		row = (
			await db
				.update(table)
				.set(values)
				.where(and(eq(table.organizationId, ctx.orgId), eq(table.id, existing.id)))
				.returning()
		)[0] as EntityRecord | undefined;
	} else {
		row = (
			await db
				.insert(table)
				.values({ ...values, organizationId: ctx.orgId })
				.returning()
		)[0] as EntityRecord | undefined;
	}
	if (!row) error(500, 'Write failed');
	await hooks?.afterSave?.(ctx, row, { created: !existing });
	return row;
}

/** user-type fields whose value is set (or, on update, changed) — drives 'assigned' events. */
function newlyAssigned(def: EntityDef, row: EntityRecord, existing?: EntityRecord): string[] {
	return def.fields
		.filter((f) => f.type === 'user')
		.filter((f) => {
			const v = row[f.key];
			return typeof v === 'string' && v.length > 0 && (!existing || existing[f.key] !== v);
		})
		.map((f) => row[f.key] as string);
}

/** Emits an 'assigned' event when any user field gained/changed a member. */
function emitAssigned(
	ctx: OrgContext,
	reg: EntityRegistration,
	row: EntityRecord,
	existing?: EntityRecord
) {
	const assignees = newlyAssigned(reg.def, row, existing);
	if (!assignees.length) return;
	emit({
		orgId: ctx.orgId,
		actorId: ctx.userId,
		entityType: reg.def.name,
		entityId: row.id,
		action: 'assigned',
		summary: `${recordTitle(reg.def, row)} assigned`,
		data: { assignees }
	});
}

export async function createRecord(
	ctx: OrgContext,
	name: string,
	input: Record<string, unknown>
): Promise<EntityRecord> {
	const reg = getEntity(name);
	const row = await write(ctx, reg, input);
	emit({
		orgId: ctx.orgId,
		actorId: ctx.userId,
		entityType: name,
		entityId: row.id,
		action: 'created',
		summary: `${recordTitle(reg.def, row)} created`
	});
	emitAssigned(ctx, reg, row);
	return row;
}

export async function updateRecord(
	ctx: OrgContext,
	name: string,
	id: string,
	input: Record<string, unknown>
): Promise<EntityRecord> {
	const reg = getEntity(name);
	const existing = await getRecord(ctx.orgId, name, id);
	const row = await write(ctx, reg, input, existing);
	emit({
		orgId: ctx.orgId,
		actorId: ctx.userId,
		entityType: name,
		entityId: row.id,
		action: 'updated',
		summary: `${recordTitle(reg.def, row)} updated`,
		data: { changes: diffFields(reg.def, existing, row) }
	});
	emitAssigned(ctx, reg, row, existing);
	return row;
}

/** Field-level {from,to} pairs for the activity timeline; scalar fields only. */
function diffFields(
	def: EntityDef,
	before: EntityRecord,
	after: EntityRecord
): { field: string; from: string | null; to: string | null }[] {
	const fmt = (v: unknown): string | null => {
		if (v == null || v === '') return null;
		if (v instanceof Date) return v.toISOString().slice(0, 10);
		const s = String(v);
		return s.length > 80 ? `${s.slice(0, 77)}…` : s;
	};
	return def.fields
		.filter((f) => !f.readonly && f.type !== 'link' && fmt(before[f.key]) !== fmt(after[f.key]))
		.slice(0, 12)
		.map((f) => ({ field: f.label, from: fmt(before[f.key]), to: fmt(after[f.key]) }));
}

export async function deleteRecord(ctx: OrgContext, name: string, id: string) {
	const reg = getEntity(name);
	if (reg.def.adminOnly && ctx.role === 'member')
		error(403, `Only admins can delete ${reg.def.labelPlural}`);
	const existing = await getRecord(ctx.orgId, name, id);
	await reg.hooks?.onDelete?.(ctx, existing);
	const [row] = await db
		.delete(reg.table)
		.where(and(eq(reg.table.organizationId, ctx.orgId), eq(reg.table.id, id)))
		.returning({ id: reg.table.id });
	if (!row) error(404, `${reg.def.label} not found`);
	emit({
		orgId: ctx.orgId,
		actorId: ctx.userId,
		entityType: name,
		entityId: id,
		action: 'deleted',
		summary: `${recordTitle(reg.def, existing)} deleted`
	});
	return row;
}

/** Archive/restore an archivable record — emits a dedicated activity action. */
export async function setArchived(ctx: OrgContext, name: string, id: string, archived: boolean) {
	const reg = getEntity(name);
	if (!reg.def.archivable || !reg.table.archivedAt)
		error(422, `${reg.def.label} records cannot be archived`);
	if (reg.def.adminOnly && ctx.role === 'member')
		error(403, `Only admins can modify ${reg.def.labelPlural}`);
	await getRecord(ctx.orgId, name, id);
	const [row] = await db
		.update(reg.table)
		.set({ archivedAt: archived ? new Date() : null })
		.where(and(eq(reg.table.organizationId, ctx.orgId), eq(reg.table.id, id)))
		.returning();
	if (!row) error(404, `${reg.def.label} not found`);
	emit({
		orgId: ctx.orgId,
		actorId: ctx.userId,
		entityType: name,
		entityId: id,
		action: archived ? 'archived' : 'restored',
		summary: `${recordTitle(reg.def, row as EntityRecord)} ${archived ? 'archived' : 'restored'}`
	});
	return row as EntityRecord;
}

export async function bulkDelete(ctx: OrgContext, name: string, ids: string[]) {
	const reg = getEntity(name);
	if (reg.def.adminOnly && ctx.role === 'member')
		error(403, `Only admins can delete ${reg.def.labelPlural}`);
	for (const id of ids) {
		const existing = await getRecord(ctx.orgId, name, id);
		await reg.hooks?.onDelete?.(ctx, existing);
	}
	const rows = await db
		.delete(reg.table)
		.where(and(eq(reg.table.organizationId, ctx.orgId), inArray(reg.table.id, ids)))
		.returning({ id: reg.table.id });
	for (const id of ids) {
		emit({
			orgId: ctx.orgId,
			actorId: ctx.userId,
			entityType: name,
			entityId: id,
			action: 'deleted',
			summary: `${reg.def.label} deleted`
		});
	}
	return rows.length;
}
