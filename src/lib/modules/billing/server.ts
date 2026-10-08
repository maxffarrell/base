import './def.ts';
import { registerEntity } from '#lib/server/entities/registry.ts';
import { getEntityDef } from '#lib/entities.ts';
import { invoice, payment } from './table.ts';

registerEntity({
	def: getEntityDef('invoice')!,
	table: invoice,
	hooks: {
		validate(_ctx, input) {
			if (typeof input.amount === 'number' && input.amount < 0)
				return 'Invoice amount cannot be negative';
			if (input.status === 'sent' && !input.dueDate) return 'Sent invoices need a due date';
			if (input.status === 'paid' && !input.issuedDate) return 'Paid invoices need an issued date';
		}
	}
});

registerEntity({
	def: getEntityDef('payment')!,
	table: payment,
	hooks: {
		validate(_ctx, input) {
			if (typeof input.amount === 'number' && input.amount <= 0)
				return 'Payment amount must be greater than zero';
		}
	}
});
