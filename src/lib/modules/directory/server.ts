import { error } from '@sveltejs/kit';
import './def.ts';
import { registerEntity } from '#lib/server/entities/registry.ts';
import { getEntityDef } from '#lib/entities.ts';
import { directoryCompany, directoryContact } from './table.ts';

registerEntity({
	def: getEntityDef('company')!,
	table: directoryCompany
});

registerEntity({
	def: getEntityDef('contact')!,
	table: directoryContact,
	hooks: {
		beforeValidate(_ctx, input) {
			if (typeof input.email === 'string') input.email = input.email.trim().toLowerCase();
			return input;
		},
		validate(_ctx, input) {
			if (input.stage === 'customer' && !input.email)
				return 'An email is required before a contact becomes a customer';
		},
		onDelete(_ctx, record) {
			if (record.stage === 'customer')
				error(422, 'Customer contacts cannot be deleted — set them inactive first');
		}
	}
});
