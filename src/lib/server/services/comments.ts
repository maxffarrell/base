import { and, desc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { comment, user } from '#lib/server/db/schema.ts';
import type { OrgContext } from '#lib/server/context.ts';

/** Comment thread for one entity record, newest first. */
export async function listComments(orgId: string, entityType: string, entityId: string) {
	return db
		.select({
			id: comment.id,
			body: comment.body,
			createdAt: comment.createdAt,
			authorId: comment.authorId,
			authorName: user.name
		})
		.from(comment)
		.leftJoin(user, eq(user.id, comment.authorId))
		.where(
			and(
				eq(comment.organizationId, orgId),
				eq(comment.entityType, entityType),
				eq(comment.entityId, entityId)
			)
		)
		.orderBy(desc(comment.createdAt));
}

export async function addComment(
	ctx: OrgContext,
	entityType: string,
	entityId: string,
	body: string
) {
	const text = body.trim();
	if (!text) error(400, 'Comment cannot be empty');
	if (text.length > 4000) error(400, 'Comment too long');
	const [row] = await db
		.insert(comment)
		.values({
			organizationId: ctx.orgId,
			entityType,
			entityId,
			authorId: ctx.userId,
			body: text
		})
		.returning({ id: comment.id });
	return row;
}

export async function deleteComment(ctx: OrgContext, id: string) {
	const [existing] = await db
		.select({ id: comment.id, authorId: comment.authorId })
		.from(comment)
		.where(and(eq(comment.organizationId, ctx.orgId), eq(comment.id, id)));
	if (!existing) error(404, 'Comment not found');
	if (existing.authorId !== ctx.userId && ctx.role === 'member')
		error(403, 'Only the author or an admin can delete a comment');
	await db.delete(comment).where(eq(comment.id, id));
}
