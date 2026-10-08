import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { notificationLog, notificationSettings } from '#lib/server/db/schema.ts';
import type { notificationSettingsInput } from '#lib/schemas.ts';
import type * as v from 'valibot';

export type NotificationPrefs = v.InferOutput<typeof notificationSettingsInput>;

export const NOTIFICATION_DEFAULTS: NotificationPrefs = {
	'entity.created': true,
	'entity.deleted': true,
	'entity.assigned': true,
	'entity.shared': true,
	'workflow.notify': true
};

export async function getNotificationPrefs(orgId: string): Promise<NotificationPrefs> {
	const [row] = await db
		.select()
		.from(notificationSettings)
		.where(eq(notificationSettings.organizationId, orgId));
	return { ...NOTIFICATION_DEFAULTS, ...(row?.prefs ?? {}) };
}

export async function saveNotificationPrefs(orgId: string, prefs: NotificationPrefs) {
	await db
		.insert(notificationSettings)
		.values({ organizationId: orgId, prefs })
		.onConflictDoUpdate({ target: notificationSettings.organizationId, set: { prefs } });
}

/**
 * Dedupe guard for outbound notifications: returns true the first time a
 * (kind, entity, recipient) combination is logged, false afterwards.
 */
export async function claimNotification(
	orgId: string,
	kind: string,
	entityId: string,
	recipient: string
) {
	const rows = await db
		.insert(notificationLog)
		.values({ organizationId: orgId, kind, entityId, recipient })
		.onConflictDoNothing()
		.returning({ id: notificationLog.id });
	return rows.length > 0;
}
