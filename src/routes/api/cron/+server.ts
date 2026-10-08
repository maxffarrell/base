import { timingSafeEqual } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { CRON_SECRET } from '$app/env/private';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { inboxItem, member, organization, user } from '#lib/server/db/schema.ts';
import { appOrigin, sendEmail } from '#lib/server/email.ts';
import { renderEmail } from '#lib/server/email-template.ts';
import { getNotificationPrefs } from '#lib/server/services/notifications.ts';
import type { RequestHandler } from './$types';

const authorized = (header: string | null) => {
	if (!CRON_SECRET || !header) return false;
	const a = Buffer.from(header);
	const b = Buffer.from(`Bearer ${CRON_SECRET}`);
	return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Periodic job: for every workspace, emails each member a digest of their
 * unread inbox items (gated by the `digest.unread` notification pref).
 * Entity modules can register their own cron handlers via hooks.
 */
export const GET: RequestHandler = async ({ request }) => {
	if (!authorized(request.headers.get('authorization'))) error(401, 'Unauthorized');
	const orgs = await db.select({ id: organization.id, name: organization.name }).from(organization);
	let sent = 0;
	for (const org of orgs) {
		const prefs = await getNotificationPrefs(org.id);
		if (!prefs['digest.unread']) continue;
		const members = await db
			.select({ userId: member.userId, email: user.email })
			.from(member)
			.innerJoin(user, eq(user.id, member.userId))
			.where(eq(member.organizationId, org.id));
		for (const m of members) {
			const items = await db
				.select({ title: inboxItem.title })
				.from(inboxItem)
				.where(
					and(
						eq(inboxItem.organizationId, org.id),
						eq(inboxItem.userId, m.userId),
						isNull(inboxItem.readAt)
					)
				)
				.orderBy(desc(inboxItem.createdAt))
				.limit(11);
			if (!items.length) continue;
			const more = items.length > 10 ? [`…and ${items.length - 10} more`] : [];
			const rendered = renderEmail({
				orgName: org.name,
				heading: `You have ${items.length > 10 ? '10+' : items.length} unread notification${items.length === 1 ? '' : 's'}`,
				lines: [...items.slice(0, 10).map((i) => `• ${i.title}`), ...more],
				action: { label: 'Open inbox', url: `${appOrigin()}/inbox` }
			});
			await sendEmail({ to: m.email, subject: rendered.text.split('\n')[0]!, ...rendered }).catch(
				() => {}
			);
			sent++;
		}
	}
	return json({ workspaces: orgs.length, digests: sent });
};

export const POST = GET;
