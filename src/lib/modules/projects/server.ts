import { error } from '@sveltejs/kit';
import './def.ts';
import { registerEntity } from '#lib/server/entities/registry.ts';
import { getEntityDef } from '#lib/entities.ts';
import { project, task } from './table.ts';

registerEntity({ def: getEntityDef('project')!, table: project });

registerEntity({
	def: getEntityDef('task')!,
	table: task,
	hooks: {
		beforeValidate(_ctx, input) {
			if (typeof input.priority === 'string' && !input.priority) delete input.priority;
			return input;
		},
		validate(_ctx, input) {
			if (input.status === 'done' && input.projectId == null)
				return 'A task must belong to a project before it can be done';
		},
		onDelete(_ctx, record) {
			if (record.status === 'in_progress')
				error(422, 'In-progress tasks cannot be deleted — move them first');
		}
	}
});
