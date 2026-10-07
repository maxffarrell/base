import { error } from '@sveltejs/kit';
import { BASE_DEMO } from '$app/env/private';

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
