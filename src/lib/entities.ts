/**
 * Meta-driven entity registry — the client-safe half of the "DocType" layer.
 *
 * An `EntityDef` describes one entity: its fields, list-view columns, and how
 * records are titled. Modules register defs by calling `defineEntity` from a
 * shared (non-server) module so the UI, remote functions, and REST API all
 * derive from the same metadata. Server-only binding (Drizzle table + hook
 * functions) lives in `src/lib/server/entities/registry.ts`.
 *
 * Escape hatches: `listComponent`/`formComponent`/`viewComponent` let a module
 * drop down to a bespoke Svelte component where the generic renderer is not
 * enough (e.g. a kanban board or calendar).
 */
import type { Component } from 'svelte';

export type FieldType =
	| 'text'
	| 'textarea'
	| 'number'
	| 'currency'
	| 'boolean'
	| 'date'
	| 'select'
	| 'link'
	| 'email'
	| 'url'
	| 'phone'
	| 'user';

export type EntityField = {
	/** Column key on the entity's table and in record payloads. */
	key: string;
	label: string;
	type: FieldType;
	required?: boolean;
	/** Choices for `select`. */
	options?: string[];
	/** Entity name for `link` fields. */
	linkTo?: string;
	/** Show as a column in the generic list view. */
	list?: boolean;
	/** Filterable in the list view (select/boolean/link fields). */
	filterable?: boolean;
	/** Sortable in the list view. */
	sortable?: boolean;
	/** Rendered read-only in forms (e.g. computed or system fields). */
	readonly?: boolean;
	placeholder?: string;
	/** Per-entity workflow config: transitions enforced on `type: 'select'` status fields. */
	transitions?: Record<string, string[]>;
};

export type EntityDef = {
	/** Singular key: 'contact'. Doubles as the URL segment and REST resource name. */
	name: string;
	label: string;
	labelPlural?: string;
	/** Short blurb for the dashboard and REST docs. */
	description?: string;
	icon?: Component;
	fields: EntityField[];
	/** Fields searched by `?q=`; defaults to the title field. */
	searchFields?: string[];
	/** Field used as a record's display title; defaults to `name` or the first text field. */
	titleField?: string;
	defaultSort?: { key: string; dir: 'asc' | 'desc' };
	/** Records can be archived instead of deleted — requires an `archivedAt`
	 * timestamp column on the entity's table. */
	archivable?: boolean;
	/** Custom component escape hatches (Frappe struggles to offer this cleanly). */
	listComponent?: Component;
	formComponent?: Component;
	viewComponent?: Component;
};

const defs = new Map<string, EntityDef>();

export function defineEntity(def: EntityDef) {
	defs.set(def.name, def);
}

export function getEntityDef(name: string): EntityDef | undefined {
	return defs.get(name);
}

export function listEntityDefs(): EntityDef[] {
	return [...defs.values()];
}

export function entityLabel(def: EntityDef): string {
	return def.labelPlural ?? `${def.label}s`;
}

/** Display title for a record of this entity. */
export function recordTitle(def: EntityDef, record: Record<string, unknown>): string {
	const key =
		def.titleField ?? (def.fields.some((f) => f.key === 'name') ? 'name' : def.fields[0]?.key);
	const value = key ? record[key] : undefined;
	return value == null || value === '' ? (record.id as string) : String(value);
}

export function listFields(def: EntityDef): EntityField[] {
	const listed = def.fields.filter((f) => f.list);
	return listed.length ? listed : def.fields.slice(0, 5);
}
