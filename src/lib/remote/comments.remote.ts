import { command, query } from '$app/server';
import * as v from 'valibot';
import { idSchema } from '#lib/schemas.ts';
import { requireOrg } from '#lib/server/context.ts';
import { addComment, deleteComment, listComments } from '#lib/server/services/comments.ts';

const target = v.object({
	entity: v.pipe(v.string(), v.minLength(1), v.maxLength(60)),
	id: v.string()
});

export const getRecordComments = query(target, async ({ entity, id }) =>
	listComments((await requireOrg()).orgId, entity, id)
);

export const createComment = command(
	v.object({ ...target.entries, body: v.string() }),
	async ({ entity, id, body }) => {
		const ctx = await requireOrg();
		await addComment(ctx, entity, id, body);
		void getRecordComments({ entity, id }).refresh();
	}
);

export const removeComment = command(idSchema, async (id) => {
	await deleteComment(await requireOrg(), id);
});
