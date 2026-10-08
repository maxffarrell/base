import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, orgId, timestamps } from '#lib/server/db/kit.ts';
import { directoryCompany } from '#lib/modules/directory/table.ts';

export const stockItem = pgTable(
	'stock_item',
	{
		id: id(),
		organizationId: orgId(),
		sku: text('sku').notNull(),
		name: text('name').notNull(),
		category: text('category').notNull().default('supplies'),
		quantity: integer('quantity').notNull().default(0),
		unitCost: integer('unit_cost'),
		reorderLevel: integer('reorder_level').default(10),
		location: text('location'),
		supplierId: text('supplier_id').references(() => directoryCompany.id, {
			onDelete: 'set null'
		}),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('stock_item_org_idx').on(t.organizationId, t.category),
		index('stock_item_supplier_idx').on(t.organizationId, t.supplierId)
	]
);

export const stockMovement = pgTable(
	'stock_movement',
	{
		id: id(),
		organizationId: orgId(),
		itemId: text('item_id')
			.notNull()
			.references(() => stockItem.id, { onDelete: 'cascade' }),
		direction: text('direction').notNull(),
		quantity: integer('quantity').notNull(),
		reason: text('reason'),
		movedAt: text('moved_at').notNull(),
		note: text('note'),
		...timestamps
	},
	(t) => [index('stock_movement_item_idx').on(t.organizationId, t.itemId)]
);
