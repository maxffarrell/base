import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'Postgres connection string.' },
	BETTER_AUTH_SECRET: {
		description: 'Secret used to sign sessions. Use 32+ random characters in production.'
	},
	ORIGIN: {
		description:
			'Public origin, e.g. `https://app.example.com`. Optional; derived from the request when unset.',
		schema: (value) => value || undefined
	},
	BASE_ENTERPRISE_KEY: {
		description:
			'Enterprise license key. Unlocks SAML/OIDC SSO and passkeys on self-hosted installs.',
		schema: (value) => value || undefined
	},
	BASE_CLOUD: {
		description: 'Set to `true` on hosted cloud installs. Enables enterprise features.',
		schema: (value) => value === 'true'
	},
	BASE_DEMO: {
		description:
			'Set to `true` for a public demo: sign-up, API access, webhooks, invites and uploads are disabled.',
		schema: (value) => value === 'true'
	},
	GOOGLE_CLIENT_ID: {
		description:
			'Google OAuth client ID. Shows "Continue with Google" on sign-in. Redirect URI: `<origin>/api/auth/callback/google`.',
		schema: (value) => value || undefined
	},
	GOOGLE_CLIENT_SECRET: {
		description: 'Google OAuth client secret.',
		schema: (value) => value || undefined
	},
	GITHUB_CLIENT_ID: {
		description:
			'GitHub OAuth client ID. Shows "Continue with GitHub" on sign-in. Redirect URI: `<origin>/api/auth/callback/github`.',
		schema: (value) => value || undefined
	},
	GITHUB_CLIENT_SECRET: {
		description: 'GitHub OAuth client secret.',
		schema: (value) => value || undefined
	},
	EMAIL_FROM: {
		description: 'Sender for notification emails, e.g. `Base <no-reply@app.example.com>`.',
		schema: (value) => value || undefined
	},
	RESEND_API_KEY: {
		description: 'Send email through Resend. Takes precedence over `SMTP_URL`.',
		schema: (value) => value || undefined
	},
	SMTP_URL: {
		description: 'Send email through SMTP, e.g. `smtps://user:pass@smtp.example.com:465`.',
		schema: (value) => value || undefined
	},
	CRON_SECRET: {
		description: 'Bearer token for `/api/cron`, which runs due scheduled jobs for every workspace.',
		schema: (value) => value || undefined
	}
});
