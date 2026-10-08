import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiKeyContext } from '#lib/server/api/auth.ts';
import { allows } from '#lib/api-permissions.ts';
import { listEntityDefs } from '#lib/entities.ts';

/**
 * Entity catalog for API clients (e.g. the mobile apps): serializable entity defs —
 * fields, labels, options, workflow transitions — so clients can render lists and
 * forms generically. Only entities the key may read are returned.
 */
export const GET: RequestHandler = async (event) => {
	const { permissions } = await apiKeyContext(event);
	const defs = listEntityDefs()
		.filter((d) => allows(permissions, d.name, 'read'))
		.map((d) => ({
			name: d.name,
			label: d.label,
			labelPlural: d.labelPlural ?? `${d.label}s`,
			description: d.description,
			fields: d.fields,
			searchFields: d.searchFields,
			titleField: d.titleField,
			defaultSort: d.defaultSort,
			archivable: d.archivable,
			writable: allows(permissions, d.name, 'write')
		}));
	return json({ data: defs });
};
