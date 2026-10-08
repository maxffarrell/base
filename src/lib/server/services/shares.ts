import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { entityShare, member, user } from '#lib/server/db/schema.ts';
import { getEntityDef } from '#lib/entities.ts';
import { recordTitle } from '#lib/entities.ts';
import { emit } from './events.ts';
import { getRecord } from './entity.ts';

/**
 * Shares a record with a member: row in entity_share, a `shared` activity
 * event (fans to webhooks/workflows), and an inbox notice via the
 * `entity.shared` event branch in events.ts.
 */
export async function shareRecord(
	orgId: string,
	entity: string,
	id: string,
	args: {
		fromUserId: string;
		toUserId: string;
	}
) {
	const def = getEntityDef(entity);
	if (!def) throw new Error(`Unknown entity: ${entity}`);
	if (args.fromUserId === args.toUserId) throw new Error('Already your record');
	const record = await getRecord(orgId, entity, id);
	if (!record) throw new Error('Record not found');
	await db
		.insert(entityShare)
		.values({
			organizationId: orgId,
			entityType: entity,
			entityId: id,
			fromUserId: args.fromUserId,
			toUserId: args.toUserId
		})
		.onConflictDoNothing();
	await emit({
		orgId,
		actorId: args.fromUserId,
		entityType: entity,
		entityId: id,
		action: 'shared',
		summary: `${def.label} shared: ${recordTitle(def, record)}`,
		data: { sharedWith: [args.toUserId] }
	});
}

export async function unshareRecord(orgId: string, entity: string, id: string, toUserId: string) {
	await db
		.delete(entityShare)
		.where(
			and(
				eq(entityShare.organizationId, orgId),
				eq(entityShare.entityType, entity),
				eq(entityShare.entityId, id),
				eq(entityShare.toUserId, toUserId)
			)
		);
}

/** Members a record is currently shared with (for the share dialog). */
export async function listShares(orgId: string, entity: string, id: string) {
	const rows = await db
		.select({ toUserId: entityShare.toUserId, createdAt: entityShare.createdAt })
		.from(entityShare)
		.where(
			and(
				eq(entityShare.organizationId, orgId),
				eq(entityShare.entityType, entity),
				eq(entityShare.entityId, id)
			)
		)
		.orderBy(desc(entityShare.createdAt));
	return rows;
}

/** Everything shared with a user, newest first, resolved to titles. */
export async function sharedWithMe(orgId: string, userId: string) {
	const rows = await db
		.select({
			entityType: entityShare.entityType,
			entityId: entityShare.entityId,
			fromUserId: entityShare.fromUserId,
			createdAt: entityShare.createdAt
		})
		.from(entityShare)
		.where(and(eq(entityShare.organizationId, orgId), eq(entityShare.toUserId, userId)))
		.orderBy(desc(entityShare.createdAt))
		.limit(20);

	const names = await memberNames(
		orgId,
		rows.map((r) => r.fromUserId).filter((u): u is string => !!u)
	);
	const items: { entity: string; id: string; title: string; by: string; at: Date }[] = [];
	for (const r of rows) {
		const def = getEntityDef(r.entityType);
		if (!def) continue;
		const rec = await getRecord(orgId, r.entityType, r.entityId);
		if (!rec) continue;
		items.push({
			entity: r.entityType,
			id: r.entityId,
			title: recordTitle(def, rec),
			by: r.fromUserId ? (names[r.fromUserId] ?? 'Someone') : 'Someone',
			at: r.createdAt
		});
	}
	return items;
}

async function memberNames(orgId: string, userIds: string[]) {
	if (!userIds.length) return {} as Record<string, string>;
	const rows = await db
		.select({ userId: member.userId, name: user.name, email: user.email })
		.from(member)
		.innerJoin(user, eq(user.id, member.userId))
		.where(and(eq(member.organizationId, orgId), inArray(member.userId, userIds)));
	const map: Record<string, string> = {};
	for (const r of rows) map[r.userId] = r.name ?? r.email;
	return map;
}
