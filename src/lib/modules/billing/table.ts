import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, orgId, timestamps } from '#lib/server/db/kit.ts';
import { directoryCompany } from '#lib/modules/directory/table.ts';

export const invoice = pgTable(
	'invoice',
	{
		id: id(),
		organizationId: orgId(),
		number: text('number').notNull(),
		companyId: text('company_id')
			.notNull()
			.references(() => directoryCompany.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('draft'),
		/** Cents. */
		amount: integer('amount').notNull(),
		issuedDate: text('issued_date'),
		dueDate: text('due_date'),
		notes: text('notes'),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('invoice_org_idx').on(t.organizationId, t.status),
		index('invoice_company_idx').on(t.organizationId, t.companyId)
	]
);

export const payment = pgTable(
	'payment',
	{
		id: id(),
		organizationId: orgId(),
		reference: text('reference').notNull(),
		invoiceId: text('invoice_id')
			.notNull()
			.references(() => invoice.id, { onDelete: 'cascade' }),
		amount: integer('amount').notNull(),
		method: text('method'),
		paidAt: text('paid_at'),
		notes: text('notes'),
		...timestamps
	},
	(t) => [index('payment_org_idx').on(t.organizationId, t.invoiceId)]
);
