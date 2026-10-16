<div align="center">

# Base

**An extensible, meta-driven app framework — ERP/CRUD apps from entity definitions.**

Define entities once (fields, labels, links, transitions, hooks) and Base generates the rest: org-scoped CRUD, list/detail UI, REST endpoints, search, nav, permissions and API-key resources. Inspired by Frappe's DocType model, but typed end-to-end: schemas stay in Drizzle, validation in Valibot, and UI calls run through SvelteKit remote functions.

[![Deploy on Vercel](https://img.shields.io/badge/Deploy%20on-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmaxffarrell%2Fbase&env=DATABASE_URL,BETTER_AUTH_SECRET&envDescription=Postgres%20URL%20and%20a%2032%2B%20char%20random%20secret&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)
[![Deploy on Railway](https://img.shields.io/badge/Deploy%20on-Railway-0B0D0E?logo=railway&logoColor=white)](https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fmaxffarrell%2Fbase&plugins=postgresql&envs=BETTER_AUTH_SECRET&BETTER_AUTH_SECRETDesc=32%2B+random+characters)
[![Deploy on Render](https://img.shields.io/badge/Deploy%20on-Render-46E3B7?logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/maxffarrell/base)
[![Deploy on Koyeb](https://img.shields.io/badge/Deploy%20on-Koyeb-00D992?logo=koyeb&logoColor=black)](https://app.koyeb.com/deploy?name=base&type=git&repository=github.com/maxffarrell/base&branch=main&builder=dockerfile&ports=3000;http&env[BETTER_AUTH_SECRET]=&env[DATABASE_URL]=)
[![Deploy on DigitalOcean](https://img.shields.io/badge/Deploy%20on-DigitalOcean-0080FF?logo=digitalocean&logoColor=white)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/maxffarrell/base/tree/main)
[![Deploy on Hostinger](https://img.shields.io/badge/Deploy%20on-Hostinger-673DE6?logo=hostinger&logoColor=white)](https://www.hostinger.com/vps/docker-hosting?compose=https%3A%2F%2Fraw.githubusercontent.com%2Fmaxffarrell%2Fbase%2Fmain%2Fdocker-compose.yml)

</div>

## How it works

- **Entity defs** (`src/lib/entities.ts`): `defineEntity({ name, label, fields, … })` registers metadata — field types (`text`, `number`, `currency`, `boolean`, `date`, `select`, `link`, `email`, `url`, `phone`, `user`), list/filter/sort flags, and per-field `transitions` state machines.
- **Server registry** (`src/lib/server/entities/registry.ts`): `registerEntity({ def, table, hooks })` binds each def to a typed Drizzle table and lifecycle hooks (`beforeValidate`, `validate`, `beforeSave`, `afterSave`, `onDelete`). Typed TS hooks instead of server scripts.
- **Generic CRUD** (`src/lib/server/services/entity.ts`): validation schemas are generated from field defs (Valibot is the single validation source), every record is org-scoped, and writes emit events → activity log, webhooks, integrations and workflows.
- **Generated REST API** (`src/lib/server/api/resources.ts` + `/api/v1/[resource]`): one resource per registered entity, with API keys and OpenAPI (`/api/v1/openapi.json`).
- **Generic UI**: `EntityList` and `EntityForm` render any entity at `/(entity)` and `/(entity)/[id]`; nav, command palette and global search are registry-driven. Per-entity escape hatches: `listComponent` / `formComponent` / `viewComponent` on the def.
- **App modules** (`src/lib/modules/*`): a domain bundle = Drizzle table + entity defs + hooks. The `directory` module (companies + contacts) ships as a working example.

Key differences from Frappe: static typed tables (no EAV/doc-permission rows), remote functions for data loading, and `transitions` on fields instead of a fixed docstatus.

## Included infrastructure

Multi-org auth (Better Auth), invitations, API keys, audit log, activity feed, inbox + email notifications, saved views, custom fields on any entity, workflows (`notify` / `create_record` actions), signed webhooks, and a config-only integrations SDK (`@base/integration-sdk`). **Enterprise:** SSO/passkeys and a provider-agnostic AI layer (`AI_PROVIDER`/`AI_API_KEY`/`AI_MODEL` — record summaries, draft-from-text, ask-your-data) gated behind `BASE_ENTERPRISE_KEY` or Base Cloud.

## Quick start

```bash
pnpm install
cp .env.example .env   # set DATABASE_URL and BETTER_AUTH_SECRET
node --env-file=.env scripts/migrate.ts
pnpm dev
```

## Verify

```bash
pnpm check && pnpm lint && pnpm test && pnpm build
```

## Self-hosting

| Target       | How                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Docker       | `BETTER_AUTH_SECRET=$(openssl rand -hex 32) docker compose up -d`                                              |
| Railway      | Button above. Uses `railway.json` + `Dockerfile` with a Postgres plugin.                                       |
| Vercel       | Button above. Uses `@sveltejs/adapter-vercel` automatically when `VERCEL=1`. Migrations run during the build.  |
| Render       | Button above. `render.yaml` provisions a Docker web service and a Postgres database.                           |
| Koyeb        | Button above. Builds the `Dockerfile`; add a Postgres (Koyeb PostgreSQL or free Neon) and set `DATABASE_URL`.  |
| DigitalOcean | Button above. `.do/deploy.template.yaml` creates the app and a dev Postgres on App Platform.                   |
| Hostinger    | Button above or [docs/deploy-hostinger.md](docs/deploy-hostinger.md) (VPS Docker Manager).                     |
| Any VPS      | [docs/deploy-vps.md](docs/deploy-vps.md) — same compose file on a ~$4 Hetzner VM or Oracle's always-free tier. |
| Fly.io       | [docs/deploy-fly.md](docs/deploy-fly.md) — `fly launch` using `fly.toml`, scales to zero when idle.            |
| PikaPods     | Not yet in their app catalog — once submitted, a `Run on PikaPods` badge goes here (~$1.50/mo managed).        |

Environment variables are documented in [`src/env.ts`](src/env.ts). For daily email digests, set `CRON_SECRET` and call `GET /api/cron` with `Authorization: Bearer $CRON_SECRET` from any scheduler (on Vercel, `vercel.json` wires this up for you).

## Stack

SvelteKit 3 · Svelte 5 (async + remote functions) · Tailwind 4 · shadcn-svelte · PostgreSQL + Drizzle · Better Auth (organizations) · Valibot · pnpm + Node 26.

## License

Base is AGPL-3.0 open-core software. See [`LICENSE-AGPL.txt`](LICENSE-AGPL.txt), [`LICENSE`](LICENSE) and file/directory license overrides. Integrations in [`integrations/`](integrations) and the SDK in [`packages/integration-sdk`](packages/integration-sdk) are MIT; enterprise code has a separate license.

Self-host using [`.env.example`](.env.example): copy it to `.env`, configure your own database and persistent random authentication secret, then follow the setup above. Never commit real credentials or enable demo mode on a production installation.

Report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md).

## Releases

Add a changeset with `pnpm changeset` for user-facing changes. CI validates every PR. On main, Changesets opens a version PR; merging it publishes a versioned container and GitHub release. Deployment is disabled by default: an operator must configure the protected `deployment` environment, `BASE_DEPLOY_ENABLED=true` repository variable and `DEPLOY_HOOK_URL` environment secret, then explicitly dispatch the release workflow with a release tag and `deploy=true`. No host or credentials are bundled.
