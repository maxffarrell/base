import '#lib/modules/index.ts';
import '#lib/modules/server.ts';
import { command, query } from '$app/server';
import { and, desc, eq } from 'drizzle-orm';
import * as v from 'valibot';
import { requireOrg } from '#lib/server/context.ts';
import { recordTitle } from '#lib/entities.ts';
import { db } from '#lib/server/db/index.ts';
import { favorite } from '#lib/server/db/schema.ts';
import { getEntity } from '#lib/server/entities/registry.ts';

const entityName = v.pipe(v.string(), v.minLength(1), v.maxLength(60));
const target = v.object({ entity: entityName, id: v.string() });

/** The current user's starred records, newest first, with resolved titles. */
export const getFavorites = query(async () => {
	const { orgId, userId } = await requireOrg();
	const rows = await db
		.select()
		.from(favorite)
		.where(and(eq(favorite.organizationId, orgId), eq(favorite.userId, userId)))
		.orderBy(desc(favorite.createdAt))
		.limit(50);
	const items = [];
	for (const f of rows) {
		try {
			const reg = getEntity(f.entityType);
			const [row] = await db
				.select()
				.from(reg.table)
				.where(and(eq(reg.table.organizationId, orgId), eq(reg.table.id, f.entityId)))
				.limit(1);
			items.push({
				entity: f.entityType,
				label: reg.def.label,
				id: f.entityId,
				title: row ? recordTitle(reg.def, row as Record<string, unknown>) : '(deleted)'
			});
		} catch {
			// entity unregistered — skip
		}
	}
	return items;
});

export const isFavorite = query(target, async ({ entity, id }) => {
	const { orgId, userId } = await requireOrg();
	const [row] = await db
		.select({ id: favorite.id })
		.from(favorite)
		.where(
			and(
				eq(favorite.organizationId, orgId),
				eq(favorite.userId, userId),
				eq(favorite.entityType, entity),
				eq(favorite.entityId, id)
			)
		)
		.limit(1);
	return Boolean(row);
});

export const toggleFavorite = command(target, async ({ entity, id }) => {
	const { orgId, userId } = await requireOrg();
	const [existing] = await db
		.select({ id: favorite.id })
		.from(favorite)
		.where(
			and(
				eq(favorite.organizationId, orgId),
				eq(favorite.userId, userId),
				eq(favorite.entityType, entity),
				eq(favorite.entityId, id)
			)
		)
		.limit(1);
	if (existing) {
		await db.delete(favorite).where(eq(favorite.id, existing.id));
	} else {
		await db
			.insert(favorite)
			.values({ organizationId: orgId, userId, entityType: entity, entityId: id });
	}
	void getFavorites().refresh();
	void isFavorite({ entity, id }).refresh();
	return { favorited: !existing };
});
