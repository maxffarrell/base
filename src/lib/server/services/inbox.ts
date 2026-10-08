import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { inboxItem, member, organization, user } from '#lib/server/db/schema.ts';
import { appOrigin, sendEmail } from '#lib/server/email.ts';
import { renderEmail } from '#lib/server/email-template.ts';

export type InboxNotice = { title: string; body?: string; href?: string };

/**
 * Creates one inbox item per owner/admin in the org, deduped per
 * (kind, entity, user) — retries of the same event do not pile up.
 */
export async function inboxForManagers(
	orgId: string,
	kind: string,
	entityId: string,
	notice: InboxNotice
) {
	const rows = await db
		.select({ userId: member.userId })
		.from(member)
		.where(and(eq(member.organizationId, orgId), inArray(member.role, ['owner', 'admin'])));
	if (!rows.length) return 0;
	await db
		.insert(inboxItem)
		.values(
			rows.map((r) => ({
				organizationId: orgId,
				userId: r.userId,
				kind,
				entityId,
				title: notice.title,
				body: notice.body ?? null,
				href: notice.href ?? null
			}))
		)
		.onConflictDoNothing();
	return rows.length;
}

/** Same as inboxForManagers, but targets explicit user ids (e.g. assignees). */
export async function inboxForUsers(
	orgId: string,
	userIds: string[],
	kind: string,
	entityId: string,
	notice: InboxNotice
) {
	if (!userIds.length) return 0;
	await db
		.insert(inboxItem)
		.values(
			userIds.map((userId) => ({
				organizationId: orgId,
				userId,
				kind,
				entityId,
				title: notice.title,
				body: notice.body ?? null,
				href: notice.href ?? null
			}))
		)
		.onConflictDoNothing();
	return userIds.length;
}

/** Emails an event notice to each listed member (best-effort per user). */
export async function emailUsers(orgId: string, userIds: string[], notice: InboxNotice) {
	if (!userIds.length) return;
	const rows = await db
		.select({ email: user.email })
		.from(member)
		.innerJoin(user, eq(user.id, member.userId))
		.where(and(eq(member.organizationId, orgId), inArray(member.userId, userIds)));
	const [org] = await db
		.select({ name: organization.name })
		.from(organization)
		.where(eq(organization.id, orgId));
	const rendered = renderEmail({
		orgName: org?.name ?? 'Workspace',
		heading: notice.title,
		lines: notice.body ? [notice.body] : [],
		action: notice.href ? { label: 'View', url: `${appOrigin()}${notice.href}` } : undefined
	});
	await Promise.allSettled(
		rows.map((r) => sendEmail({ to: r.email, subject: rendered.text.split('\n')[0]!, ...rendered }))
	);
}

export async function listInbox(orgId: string, userId: string, limit = 30) {
	const items = await db
		.select({
			id: inboxItem.id,
			kind: inboxItem.kind,
			title: inboxItem.title,
			body: inboxItem.body,
			href: inboxItem.href,
			readAt: inboxItem.readAt,
			createdAt: inboxItem.createdAt
		})
		.from(inboxItem)
		.where(and(eq(inboxItem.organizationId, orgId), eq(inboxItem.userId, userId)))
		.orderBy(desc(inboxItem.createdAt))
		.limit(limit);
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)`.mapWith(Number) })
		.from(inboxItem)
		.where(
			and(
				eq(inboxItem.organizationId, orgId),
				eq(inboxItem.userId, userId),
				isNull(inboxItem.readAt)
			)
		);
	return { items, unread: count };
}

export async function markInboxRead(orgId: string, userId: string, ids: string[]) {
	if (!ids.length) return;
	await db
		.update(inboxItem)
		.set({ readAt: new Date() })
		.where(
			and(
				eq(inboxItem.organizationId, orgId),
				eq(inboxItem.userId, userId),
				inArray(inboxItem.id, ids),
				isNull(inboxItem.readAt)
			)
		);
}

export async function markAllInboxRead(orgId: string, userId: string) {
	await db
		.update(inboxItem)
		.set({ readAt: new Date() })
		.where(
			and(
				eq(inboxItem.organizationId, orgId),
				eq(inboxItem.userId, userId),
				isNull(inboxItem.readAt)
			)
		);
}
