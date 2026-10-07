/**
 * Server-side entity registry: binds each `EntityDef` to its Drizzle table and
 * lifecycle hooks. Modules register once at boot (imported from
 * `src/lib/modules/index.ts`, which the server entry pulls in).
 *
 * Hooks are typed TypeScript, not eval'd server scripts — integrations and app
 * modules register functions here instead of Frappe's Server Scripts.
 */
import { error } from '@sveltejs/kit';
import type { EntityDef } from '#lib/entities.ts';
import type { OrgContext } from '#lib/server/context.ts';

export type EntityRecord = Record<string, unknown> & { id: string };

export type EntityHooks = {
	/** Mutate or replace raw input before validation (e.g. normalise an email). */
	beforeValidate?: (
		ctx: OrgContext,
		input: Record<string, unknown>,
		opts: { existing?: EntityRecord }
	) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;
	/** Throw `error(422, ...)` (or return a message) to reject the write. */
	validate?: (
		ctx: OrgContext,
		input: Record<string, unknown>,
		opts: { existing?: EntityRecord }
	) => void | string | Promise<void | string>;
	/** Side-effects before the row is written (e.g. stamp derived fields). */
	beforeSave?: (
		ctx: OrgContext,
		input: Record<string, unknown>,
		opts: { existing?: EntityRecord }
	) => void | Promise<void>;
	afterSave?: (
		ctx: OrgContext,
		record: EntityRecord,
		opts: { created: boolean }
	) => void | Promise<void>;
	onDelete?: (ctx: OrgContext, record: EntityRecord) => void | Promise<void>;
};

type TableColumn = { name: string };

export type EntityRegistration = {
	def: EntityDef;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables vary per entity
	table: any;
	hooks?: EntityHooks;
};

const registrations = new Map<string, EntityRegistration>();

export function registerEntity(reg: EntityRegistration) {
	registrations.set(reg.def.name, reg);
}

export function getEntity(name: string): EntityRegistration {
	const reg = registrations.get(name);
	if (!reg) error(404, `Unknown entity: ${name}`);
	return reg;
}

export function listEntities(): EntityRegistration[] {
	return [...registrations.values()];
}

/** Column map for a registered table, keyed by column name. */
export function entityColumns(reg: EntityRegistration): Record<string, TableColumn> {
	return reg.table as Record<string, TableColumn>;
}
