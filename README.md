<div align="center">

# Base

**An extensible, meta-driven app framework — ERP/CRUD apps from entity definitions.**

Define entities once (fields, labels, links, transitions, hooks) and Base generates the rest: org-scoped CRUD, list/detail UI, REST endpoints, search, nav, permissions and API-key resources. Inspired by Frappe's DocType model, but typed end-to-end: schemas stay in Drizzle, validation in Valibot, and UI calls run through SvelteKit remote functions.

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

Multi-org auth (Better Auth), invitations, API keys, audit log, activity feed, inbox + email notifications, saved views, custom fields on any entity, workflows (`notify` / `create_record` actions), signed webhooks, and a config-only integrations SDK (`@base/integration-sdk`).

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

## Stack

SvelteKit 3 · Svelte 5 (async + remote functions) · Tailwind 4 · shadcn-svelte · PostgreSQL + Drizzle · Better Auth (organizations) · Valibot · pnpm + Node 26.

## License

MIT for the framework. Integrations in [`integrations/`](integrations) and the SDK in [`packages/integration-sdk`](packages/integration-sdk) are MIT as well.
