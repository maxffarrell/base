import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, orgId, timestamps } from '#lib/server/db/kit.ts';

export const directoryCompany = pgTable(
	'directory_company',
	{
		id: id(),
		organizationId: orgId(),
		name: text('name').notNull(),
		industry: text('industry'),
		website: text('website'),
		phone: text('phone'),
		notes: text('notes'),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [index('directory_company_org_idx').on(t.organizationId, t.name)]
);

export const directoryContact = pgTable(
	'directory_contact',
	{
		id: id(),
		organizationId: orgId(),
		name: text('name').notNull(),
		email: text('email'),
		phone: text('phone'),
		companyId: text('company_id').references(() => directoryCompany.id, { onDelete: 'set null' }),
		stage: text('stage').notNull().default('lead'),
		tags: text('tags').array(),
		notes: text('notes'),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [index('directory_contact_org_idx').on(t.organizationId, t.companyId)]
);
