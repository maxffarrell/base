import { command, query } from '$app/server';
import { requireOrg } from '#lib/server/context.ts';
import { deleteDocument as remove, listDocuments } from '#lib/server/services/documents.ts';
import * as v from 'valibot';
import { idSchema } from '#lib/schemas.ts';

export const getDocuments = query(async () => listDocuments((await requireOrg()).orgId));
export const deleteDocument = command(idSchema, async (id) => {
	await remove(await requireOrg(), id);
	void getDocuments().refresh();
});

export const getRecordDocuments = query(
	v.object({ entity: v.string(), id: v.string() }),
	async ({ entity, id }) => listDocuments((await requireOrg()).orgId, { type: entity, id })
);
