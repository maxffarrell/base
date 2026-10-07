/* @license Enterprise */

import { BASE_CLOUD, BASE_ENTERPRISE_KEY } from '$app/env/private';

export type EnterpriseFeature = 'sso' | 'passkeys' | 'ai' | 'audit_export';

/**
 * Enterprise features are enabled on Base Cloud, or on self-hosted installs
 * with a license key. Key validation is intentionally minimal until the license
 * server exists; see ee/README.md.
 */
export function isEnterpriseEnabled(): boolean {
	return BASE_CLOUD === true || !!BASE_ENTERPRISE_KEY;
}

export function hasFeature(_feature: EnterpriseFeature): boolean {
	return isEnterpriseEnabled();
}
