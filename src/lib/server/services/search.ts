import { entityLabel, recordTitle } from '#lib/entities.ts';
import { listEntities } from '#lib/server/entities/registry.ts';
import { listRecords } from '#lib/server/services/entity.ts';

export type SearchHit = {
	type: string;
	id: string;
	title: string;
	subtitle: string;
	href: string;
};

/** Global search across every registered entity's `searchFields`. */
export async function search(orgId: string, q: string): Promise<SearchHit[]> {
	if (!q.trim()) return [];
	const hits = await Promise.all(
		listEntities().map(async (reg) => {
			const { rows } = await listRecords(orgId, reg.def.name, { q, limit: 5 }).catch(() => ({
				rows: [] as Record<string, unknown>[]
			}));
			return rows.map((r) => ({
				type: reg.def.name,
				id: r.id as string,
				title: recordTitle(reg.def, r),
				subtitle: entityLabel(reg.def),
				href: `/${reg.def.name}/${r.id}`
			}));
		})
	);
	return hits.flat();
}
