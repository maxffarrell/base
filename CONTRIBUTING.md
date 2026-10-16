# Contributing

Use Node 26 and pnpm. Follow `AGENTS.md`, start from a feature branch and include regression tests for behavior changes. The application core is AGPL-3.0 open-core; preserve the file/directory license overrides described in `LICENSE`.

Report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md). Never include credentials, customer data or exploit details in public issues.

Never commit real credentials or local `.env` files. Keep [`.env.example`](.env.example) placeholder-only; use obviously fake test fixtures and disposable local/CI credentials. Report vulnerabilities privately using [`SECURITY.md`](SECURITY.md), not public issues. Keep committed migration SQL/history; put local Drizzle scratch work in `drizzle/.scratch/` or `drizzle/*.local.sql`.

## Development

```sh
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Before submitting a PR run `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm release:test`. Database tests require a disposable migrated PostgreSQL database. Add a changeset with `pnpm changeset` for user-facing changes.

## Conventions

- Business logic lives in `src/lib/server/services/`. UI talks to it through remote functions in `src/lib/remote/*.remote.ts`; the REST API in `src/routes/api/v1` reuses the same services.
- Money is stored and sent as integer cents.
- Every write that matters calls `emit()` so it shows up in the activity feed, webhooks and integrations.
- Schema changes: edit `src/lib/server/db/schema.ts`, then `pnpm db:generate --name <change>`.
- UI uses shadcn-svelte components from `src/lib/components/ui`. Keep app-specific components in `src/lib/components/app`.
- Enterprise code goes in `src/lib/server/ee/` with a `/* @license Enterprise */` header. Contributions there are accepted under the Enterprise license.

## Contributing an integration

1. Create `integrations/<id>/index.ts` using `defineIntegration` from `@base/integration-sdk`.
2. Register it in `integrations/index.ts`.
3. Integrations must only use `ctx.fetch` for network access, must not store data outside their config, and must handle only the events they declare.
4. Open a PR. A maintainer reviews the code and the permissions it needs; once merged it ships to every workspace.
