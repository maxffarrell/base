import { createHmac } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { activity, recordWatch, webhook, webhookDelivery } from '#lib/server/db/schema.ts';
import { dispatchToIntegrations } from '#lib/server/integrations/runtime.ts';
import { emailUsers, inboxForManagers, inboxForUsers } from '#lib/server/services/inbox.ts';
import { getNotificationPrefs } from '#lib/server/services/notifications.ts';
import { runWorkflows } from '#lib/server/services/workflows.ts';

export type EventInput = {
	orgId: string;
	actorId?: string | null;
	entityType: string;
	entityId: string;
	action: string;
	summary: string;
	data?: Record<string, unknown>;
};

/** Records an activity entry and fans the event out to webhooks and integrations. */
export async function emit(e: EventInput) {
	const [row] = await db
		.insert(activity)
		.values({
			organizationId: e.orgId,
			actorId: e.actorId ?? null,
			entityType: e.entityType,
			entityId: e.entityId,
			action: e.action,
			summary: e.summary,
			data: e.data
		})
		.returning();

	const event = {
		id: row!.id,
		type: `${e.entityType}.${e.action}`,
		organizationId: e.orgId,
		entity: { type: e.entityType, id: e.entityId },
		summary: e.summary,
		data: e.data ?? {},
		createdAt: row!.createdAt.toISOString()
	};

	void deliverWebhooks(event).catch((err) => console.error('webhook delivery failed', err));
	// Followers get an inbox item for every record event except their own actions.
	void (async () => {
		const watchers = await db
			.select({ userId: recordWatch.userId })
			.from(recordWatch)
			.where(
				and(
					eq(recordWatch.organizationId, e.orgId),
					eq(recordWatch.entityType, e.entityType),
					eq(recordWatch.entityId, e.entityId)
				)
			);
		const ids = watchers.map((w) => w.userId).filter((id) => id !== e.actorId);
		if (ids.length)
			await inboxForUsers(e.orgId, ids, 'watch', e.entityId, {
				title: e.summary,
				href: e.action === 'deleted' ? `/${e.entityType}` : `/${e.entityType}/${e.entityId}`
			});
	})().catch((err) => console.error('watch notification failed', err));
	const noticeKey =
		e.action === 'created' ? 'entity.created' : e.action === 'deleted' ? 'entity.deleted' : null;
	if (noticeKey) {
		void (async () => {
			const prefs = await getNotificationPrefs(e.orgId);
			if (prefs[noticeKey]) {
				await inboxForManagers(e.orgId, noticeKey, e.entityId, {
					title: e.summary,
					href: e.action === 'deleted' ? `/${e.entityType}` : `/${e.entityType}/${e.entityId}`
				});
			}
		})().catch((err) => console.error('inbox notification failed', err));
	}
	if (e.action === 'assigned') {
		void (async () => {
			const prefs = await getNotificationPrefs(e.orgId);
			if (!prefs['entity.assigned']) return;
			const users = ((e.data?.assignees as string[] | undefined) ?? []).filter(
				(u) => u !== e.actorId
			);
			if (!users.length) return;
			await inboxForUsers(e.orgId, users, 'entity.assigned', e.entityId, {
				title: e.summary,
				href: `/${e.entityType}/${e.entityId}`
			});
			await emailUsers(e.orgId, users, {
				title: e.summary,
				href: `/${e.entityType}/${e.entityId}`
			});
		})().catch((err) => console.error('assignment notification failed', err));
	}
	if (e.action === 'shared') {
		void (async () => {
			const prefs = await getNotificationPrefs(e.orgId);
			if (!prefs['entity.shared']) return;
			const users = ((e.data?.sharedWith as string[] | undefined) ?? []).filter(
				(u) => u !== e.actorId
			);
			if (!users.length) return;
			await inboxForUsers(e.orgId, users, 'entity.shared', e.entityId, {
				title: e.summary,
				href: `/${e.entityType}/${e.entityId}`
			});
			await emailUsers(e.orgId, users, {
				title: e.summary,
				href: `/${e.entityType}/${e.entityId}`
			});
		})().catch((err) => console.error('share notification failed', err));
	}
	void dispatchToIntegrations(event).catch((err) =>
		console.error('integration dispatch failed', err)
	);
	void runWorkflows(event).catch((err) => console.error('workflow run failed', err));
}

export type BaseEvent = {
	id: string;
	type: string;
	organizationId: string;
	entity: { type: string; id: string };
	summary: string;
	data: Record<string, unknown>;
	createdAt: string;
};

export function signPayload(secret: string, body: string) {
	return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

async function deliverWebhooks(event: BaseEvent) {
	const hooks = await db
		.select()
		.from(webhook)
		.where(and(eq(webhook.organizationId, event.organizationId), eq(webhook.enabled, true)));

	await Promise.allSettled(
		hooks
			.filter((h) => h.events.includes('*') || h.events.includes(event.type))
			.map((h) => deliverToHook(h, event))
	);
}

/** Posts one event payload to a single webhook and records the delivery status. */
export async function deliverToHook(
	h: typeof webhook.$inferSelect,
	event: BaseEvent
): Promise<number> {
	const body = JSON.stringify(event);
	let status = 0;
	let error: string | null = null;
	try {
		const res = await fetch(h.url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-base-event': event.type,
				'x-base-signature': signPayload(h.secret, body)
			},
			body,
			signal: AbortSignal.timeout(10_000)
		});
		status = res.status;
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	} finally {
		await db
			.update(webhook)
			.set({ lastDeliveryAt: new Date(), lastDeliveryStatus: status })
			.where(eq(webhook.id, h.id));
		await db.insert(webhookDelivery).values({
			webhookId: h.id,
			organizationId: h.organizationId,
			eventType: event.type,
			status,
			error
		});
		// Keep only the latest 50 attempts per hook.
		const stale = await db
			.select({ id: webhookDelivery.id })
			.from(webhookDelivery)
			.where(eq(webhookDelivery.webhookId, h.id))
			.orderBy(desc(webhookDelivery.attemptedAt))
			.offset(50);
		if (stale.length)
			await db.delete(webhookDelivery).where(
				inArray(
					webhookDelivery.id,
					stale.map((d) => d.id)
				)
			);
	}
	return status;
}
