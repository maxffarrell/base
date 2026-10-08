/**
 * Inventory module — stock items and their movement ledger. Exercises the
 * framework's declarative validation (sku pattern, min/max bounds, field
 * defaults) and adminOnly entity guards on the movement ledger.
 */
import Package from '@lucide/svelte/icons/package';
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import { defineEntity } from '#lib/entities.ts';

defineEntity({
	name: 'stock_item',
	archivable: true,
	label: 'Stock item',
	labelPlural: 'Stock items',
	description: 'Things you keep in the warehouse',
	icon: Package,
	titleField: 'name',
	searchFields: ['name', 'sku'],
	defaultSort: { key: 'name', dir: 'asc' },
	fields: [
		{
			key: 'sku',
			label: 'SKU',
			type: 'text',
			required: true,
			list: true,
			sortable: true,
			pattern: '^[A-Z0-9-]{4,20}$',
			unique: true,
			placeholder: 'WH-1024',
			help: '4–20 chars: capitals, digits, dashes'
		},
		{ key: 'name', label: 'Name', type: 'text', required: true, list: true, sortable: true },
		{
			key: 'category',
			label: 'Category',
			type: 'select',
			options: ['equipment', 'supplies', 'merch'],
			default: 'supplies',
			list: true,
			filterable: true,
			sortable: true
		},
		{
			key: 'quantity',
			label: 'Qty',
			type: 'number',
			required: true,
			min: 0,
			default: 0,
			list: true,
			sortable: true,
			section: 'Stock'
		},
		{
			key: 'reorderLevel',
			label: 'Reorder level',
			type: 'number',
			min: 0,
			default: 10,
			help: 'Alert when quantity drops below this',
			section: 'Stock'
		},
		{
			key: 'unitCost',
			label: 'Unit cost',
			type: 'currency',
			min: 0,
			list: true,
			section: 'Pricing'
		},
		{
			key: 'supplierId',
			label: 'Supplier',
			type: 'link',
			linkTo: 'company',
			list: true,
			filterable: true
		},
		{ key: 'location', label: 'Location', type: 'text', list: true, placeholder: 'Aisle 3, Bay 2' }
	]
});

defineEntity({
	name: 'stock_movement',
	adminOnly: true,
	memberHidden: true,
	label: 'Stock movement',
	labelPlural: 'Stock movements',
	description: 'Every in/out adjustment on a stock item',
	icon: ArrowLeftRight,
	titleField: 'reason',
	defaultSort: { key: 'movedAt', dir: 'desc' },
	fields: [
		{
			key: 'itemId',
			label: 'Item',
			type: 'link',
			linkTo: 'stock_item',
			required: true,
			list: true,
			filterable: true
		},
		{
			key: 'direction',
			label: 'Direction',
			type: 'select',
			options: ['in', 'out'],
			required: true,
			list: true,
			filterable: true
		},
		{ key: 'quantity', label: 'Qty', type: 'number', required: true, min: 1, list: true },
		{
			key: 'reason',
			label: 'Reason',
			type: 'select',
			options: ['purchase', 'sale', 'return', 'adjustment', 'damage'],
			default: 'adjustment',
			list: true,
			filterable: true
		},
		{ key: 'movedAt', label: 'Moved at', type: 'date', required: true, list: true, sortable: true },
		{ key: 'note', label: 'Note', type: 'textarea' }
	]
});
