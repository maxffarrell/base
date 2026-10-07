import '#lib/modules/index.ts';
import '#lib/modules/server.ts';
import { command, query } from '$app/server';
import * as v from 'valibot';
import { requireOrg } from '#lib/server/context.ts';
import { listEntityDefs } from '#lib/entities.ts';
import {
	bulkDelete,
	createRecord,
	deleteRecord,
	getRecord,
	linkOptions,
	listRecords,
	updateRecord
} from '#lib/server/services/entity.ts';

const entityName = v.pipe(v.string(), v.minLength(1), v.maxLength(60));

/** Serializable defs for the generic UI — component references stay client-side. */
export const getEntities = query(async () => {
	await requireOrg();
	return listEntityDefs().map((d) => ({
		name: d.name,
		label: d.label,
		labelPlural: d.labelPlural ?? `${d.label}s`,
		description: d.description,
		fields: d.fields,
		searchFields: d.searchFields,
		titleField: d.titleField,
		defaultSort: d.defaultSort,
		hasListComponent: !!d.listComponent,
		hasFormComponent: !!d.formComponent,
		hasViewComponent: !!d.viewComponent
	}));
});

export const listEntityRecords = query(
	v.object({
		entity: entityName,
		q: v.optional(v.string()),
		filters: v.optional(v.record(v.string(), v.string())),
		sort: v.optional(v.string()),
		dir: v.optional(v.picklist(['asc', 'desc'])),
		limit: v.optional(v.number()),
		offset: v.optional(v.number())
	}),
	async ({ entity, ...opts }) => {
		const { orgId } = await requireOrg();
		return listRecords(orgId, entity, opts);
	}
);

export const getEntityRecord = query(
	v.object({ entity: entityName, id: v.string() }),
	async ({ entity, id }) => {
		const { orgId } = await requireOrg();
		return getRecord(orgId, entity, id);
	}
);

export const getLinkOptions = query(entityName, async (entity) => {
	const { orgId } = await requireOrg();
	return linkOptions(orgId, entity);
});

const recordInput = v.record(v.string(), v.unknown());

export const createEntityRecord = command(
	v.object({ entity: entityName, input: recordInput }),
	async ({ entity, input }) => {
		const ctx = await requireOrg();
		return createRecord(ctx, entity, input);
	}
);

export const updateEntityRecord = command(
	v.object({ entity: entityName, id: v.string(), input: recordInput }),
	async ({ entity, id, input }) => {
		const ctx = await requireOrg();
		return updateRecord(ctx, entity, id, input);
	}
);

export const deleteEntityRecord = command(
	v.object({ entity: entityName, id: v.string() }),
	async ({ entity, id }) => {
		const ctx = await requireOrg();
		await deleteRecord(ctx, entity, id);
		void listEntityRecords({ entity }).refresh();
	}
);

export const bulkDeleteRecords = command(
	v.object({ entity: entityName, ids: v.array(v.string()) }),
	async ({ entity, ids }) => {
		const ctx = await requireOrg();
		const count = await bulkDelete(ctx, entity, ids);
		void listEntityRecords({ entity }).refresh();
		return { deleted: count };
	}
);
