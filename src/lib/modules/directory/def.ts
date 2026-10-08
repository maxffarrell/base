/**
 * Directory module — a small CRM shipped with Base to demonstrate the entity
 * framework end-to-end: link fields (contact → company), select fields with
 * workflow transitions, and hook functions (see `server.ts`).
 */
import Building2 from '@lucide/svelte/icons/building-2';
import Users from '@lucide/svelte/icons/users';
import { defineEntity } from '#lib/entities.ts';

defineEntity({
	name: 'company',
	archivable: true,
	label: 'Company',
	labelPlural: 'Companies',
	description: 'Organizations you do business with',
	icon: Building2,
	titleField: 'name',
	searchFields: ['name', 'website'],
	defaultSort: { key: 'name', dir: 'asc' },
	fields: [
		{ key: 'name', label: 'Name', type: 'text', required: true, list: true, sortable: true },
		{
			key: 'industry',
			label: 'Industry',
			type: 'select',
			options: ['technology', 'finance', 'retail', 'manufacturing', 'services', 'other'],
			list: true,
			filterable: true
		},
		{ key: 'website', label: 'Website', type: 'url' },
		{ key: 'phone', label: 'Phone', type: 'phone' },
		{ key: 'notes', label: 'Notes', type: 'textarea' }
	]
});

defineEntity({
	name: 'contact',
	archivable: true,
	label: 'Contact',
	labelPlural: 'Contacts',
	description: 'People at your companies',
	icon: Users,
	titleField: 'name',
	searchFields: ['name', 'email'],
	defaultSort: { key: 'name', dir: 'asc' },
	fields: [
		{ key: 'name', label: 'Name', type: 'text', required: true, list: true, sortable: true },
		{ key: 'email', label: 'Email', type: 'email', list: true },
		{ key: 'phone', label: 'Phone', type: 'phone' },
		{
			key: 'companyId',
			label: 'Company',
			type: 'link',
			linkTo: 'company',
			list: true,
			filterable: true
		},
		{
			key: 'stage',
			label: 'Stage',
			type: 'select',
			options: ['lead', 'customer', 'inactive'],
			list: true,
			sortable: true,
			filterable: true,
			// Per-entity workflow: stage transitions enforced by the generic service.
			transitions: {
				'': ['lead'],
				lead: ['customer', 'inactive'],
				customer: ['inactive'],
				inactive: ['lead']
			}
		},
		{ key: 'notes', label: 'Notes', type: 'textarea' }
	]
});
