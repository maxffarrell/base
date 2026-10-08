/**
 * Billing module — invoices and payments, exercising the `currency` field type
 * (MoneyInput, formatMoney in lists), a stricter invoice state machine, and a
 * required back-link (payment → invoice) for the related-records card.
 */
import ReceiptText from '@lucide/svelte/icons/receipt-text';
import Banknote from '@lucide/svelte/icons/banknote';
import { defineEntity } from '#lib/entities.ts';

defineEntity({
	name: 'invoice',
	archivable: true,
	label: 'Invoice',
	labelPlural: 'Invoices',
	description: 'Bills issued to companies',
	icon: ReceiptText,
	titleField: 'number',
	searchFields: ['number'],
	defaultSort: { key: 'issuedDate', dir: 'desc' },
	fields: [
		{ key: 'number', label: 'Number', type: 'text', required: true, list: true, sortable: true },
		{
			key: 'companyId',
			label: 'Company',
			type: 'link',
			linkTo: 'company',
			required: true,
			list: true,
			filterable: true
		},
		{
			key: 'status',
			label: 'Status',
			type: 'select',
			options: ['draft', 'sent', 'paid', 'void'],
			list: true,
			sortable: true,
			filterable: true,
			transitions: {
				'': ['draft'],
				draft: ['sent', 'void'],
				sent: ['paid', 'void', 'draft'],
				paid: [],
				void: ['draft']
			}
		},
		{
			key: 'amount',
			label: 'Amount',
			type: 'currency',
			required: true,
			list: true,
			sortable: true
		},
		{ key: 'issuedDate', label: 'Issued', type: 'date', list: true, sortable: true },
		{ key: 'dueDate', label: 'Due', type: 'date', list: true, sortable: true, filterable: false },
		{ key: 'notes', label: 'Notes', type: 'textarea' }
	]
});

defineEntity({
	name: 'payment',
	label: 'Payment',
	labelPlural: 'Payments',
	description: 'Money received against invoices',
	icon: Banknote,
	titleField: 'reference',
	searchFields: ['reference'],
	defaultSort: { key: 'paidAt', dir: 'desc' },
	fields: [
		{
			key: 'reference',
			label: 'Reference',
			type: 'text',
			required: true,
			list: true,
			sortable: true
		},
		{
			key: 'invoiceId',
			label: 'Invoice',
			type: 'link',
			linkTo: 'invoice',
			required: true,
			list: true,
			filterable: true
		},
		{
			key: 'amount',
			label: 'Amount',
			type: 'currency',
			required: true,
			list: true,
			sortable: true
		},
		{
			key: 'method',
			label: 'Method',
			type: 'select',
			options: ['card', 'transfer', 'cash', 'check'],
			list: true,
			filterable: true
		},
		{ key: 'paidAt', label: 'Paid', type: 'date', list: true, sortable: true },
		{ key: 'notes', label: 'Notes', type: 'textarea' }
	]
});
