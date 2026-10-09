import '#lib/modules/server.ts';
import { randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { and, inArray, like, lt } from 'drizzle-orm';
import { BASE_DEMO } from '$app/env/private';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { member, organization, user } from '#lib/server/db/auth.schema.ts';
import { loadDemoData } from '#lib/server/services/demo.ts';

const DEMO_EMAIL_DOMAIN = '@demo.base.invalid';
const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DEMOS_PER_IP_PER_HOUR = 5;

export const isDemo = (): boolean => !!BASE_DEMO;

export function assertNotDemo() {
	if (BASE_DEMO) error(403, 'This is turned off in the public demo');
}

/** Paths blocked in demo mode (account mutation, API keys, outbound calls). */
export function isDemoBlockedPath(path: string) {
	if (!BASE_DEMO) return false;
	if (path.startsWith('/api/v1/')) return path !== '/api/v1/openapi.json';
	if (path.startsWith('/id')) return true;
	const blocked = [
		'/api/auth/sign-up',
		'/api/auth/api-key',
		'/api/auth/organization/delete',
		'/api/auth/change-email',
		'/api/auth/change-password',
		'/api/auth/delete-user',
		'/api/auth/passkey/',
		'/api/auth/sso/',
		'/api/auth/link-social'
	];
	return blocked.some((p) => path.startsWith(p));
}

const recent = new Map<string, number[]>();
function rateLimit(ip: string) {
	const now = Date.now();
	const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
	if (hits.length >= MAX_DEMOS_PER_IP_PER_HOUR)
		error(429, 'Too many demo workspaces from this address. Try again in an hour.');
	recent.set(ip, [...hits, now]);
}

/** Deletes demo users older than the TTL along with their workspaces. */
export async function purgeExpiredDemos() {
	const stale = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				like(user.email, `%${DEMO_EMAIL_DOMAIN}`),
				lt(user.createdAt, new Date(Date.now() - DEMO_TTL_MS))
			)
		);
	if (!stale.length) return;
	const userIds = stale.map((u) => u.id);
	const orgIds = (
		await db
			.select({ id: member.organizationId })
			.from(member)
			.where(inArray(member.userId, userIds))
	).map((m) => m.id);
	if (orgIds.length)
		// Org-scoped rows (entities, comments, views, watchers...) cascade.
		await db.delete(organization).where(inArray(organization.id, orgIds));
	await db.delete(user).where(inArray(user.id, userIds));
}

/** Signs the visitor into a fresh, private workspace filled with sample data. */
export async function startDemo(ip: string) {
	if (!BASE_DEMO) error(404, 'Not found');
	rateLimit(ip);
	await purgeExpiredDemos();

	const id = randomBytes(6).toString('hex');
	const { user: demoUser } = await auth.api.signUpEmail({
		body: {
			name: 'Demo User',
			email: `demo-${id}${DEMO_EMAIL_DOMAIN}`,
			password: randomBytes(24).toString('base64url')
		}
	});
	const org = await auth.api.createOrganization({
		body: { name: 'Demo Workspace', slug: `demo-${id}`, userId: demoUser.id }
	});
	if (!org) error(500, 'Could not create demo workspace');
	await loadDemoData({
		userId: demoUser.id,
		orgId: org.id,
		role: 'owner',
		org: { id: org.id, name: org.name, slug: org.slug, logo: null }
	});
}
