import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiKeyContext } from '#lib/server/api/auth.ts';
import { allows } from '#lib/api-permissions.ts';
import { getEntityDef } from '#lib/entities.ts';
import { linkOptions } from '#lib/server/services/entity.ts';

/**
 * `?entity=<name>` → `{ id, title }[]` for populating `link` field pickers.
 * Requires read permission on the target entity.
 */
export const GET: RequestHandler = async (event) => {
	const { ctx, permissions } = await apiKeyContext(event);
	const entity = event.url.searchParams.get('entity') ?? '';
	if (!getEntityDef(entity)) error(404, `Unknown entity: ${entity}`);
	if (!allows(permissions, entity, 'read')) {
		error(403, `API key lacks ${entity}:read permission`);
	}
	return json({ data: await linkOptions(ctx.orgId, entity) });
};
