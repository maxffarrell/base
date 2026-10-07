import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getOrg } from '#lib/server/context.ts';
import { isDemo } from '#lib/server/demo-mode.ts';
import { isEnterpriseEnabled } from '#lib/server/ee/license.ts';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const ctx = await getOrg();
	if (!ctx) redirect(303, '/onboarding');
	return {
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			image: locals.user.image ?? null
		},
		org: ctx.org,
		role: ctx.role,
		demo: isDemo(),
		enterprise: isEnterpriseEnabled()
	};
};
