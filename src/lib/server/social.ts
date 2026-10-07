import {
	BASE_DEMO,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from '$app/env/private';

export type SocialProvider = 'google' | 'github';

/** Each provider is on only when its keys are set; self-hosters register their own apps. */
export function socialProviders() {
	return {
		...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: GOOGLE_CLIENT_ID,
						clientSecret: GOOGLE_CLIENT_SECRET,
						prompt: 'select_account' as const
					}
				}
			: {}),
		...(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET
			? { github: { clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET } }
			: {})
	};
}

export function enabledSocialProviders(): SocialProvider[] {
	if (BASE_DEMO) return [];
	return Object.keys(socialProviders()) as SocialProvider[];
}
