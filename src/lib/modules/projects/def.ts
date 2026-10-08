/**
 * Projects module — a second app module proving the framework composes multiple
 * entity apps: link fields across modules (task → project, project → company),
 * a `user` assignee field, priority/status selects, and a task state machine.
 */
import FolderKanban from '@lucide/svelte/icons/folder-kanban';
import ListTodo from '@lucide/svelte/icons/list-todo';
import { defineEntity } from '#lib/entities.ts';

defineEntity({
	name: 'project',
	archivable: true,
	label: 'Project',
	labelPlural: 'Projects',
	description: 'Work you track with tasks',
	icon: FolderKanban,
	titleField: 'name',
	searchFields: ['name'],
	defaultSort: { key: 'name', dir: 'asc' },
	fields: [
		{ key: 'name', label: 'Name', type: 'text', required: true, list: true, sortable: true },
		{
			key: 'status',
			label: 'Status',
			type: 'select',
			options: ['active', 'on_hold', 'done'],
			list: true,
			sortable: true,
			filterable: true,
			transitions: {
				'': ['active'],
				active: ['on_hold', 'done'],
				on_hold: ['active', 'done'],
				done: ['active']
			}
		},
		{
			key: 'companyId',
			label: 'Company',
			type: 'link',
			linkTo: 'company',
			list: true,
			filterable: true
		},
		{ key: 'dueDate', label: 'Due date', type: 'date', list: true, sortable: true },
		{ key: 'description', label: 'Description', type: 'textarea' }
	]
});

defineEntity({
	name: 'task',
	archivable: true,
	label: 'Task',
	labelPlural: 'Tasks',
	description: 'Units of work on a project',
	icon: ListTodo,
	titleField: 'title',
	searchFields: ['title'],
	defaultSort: { key: 'dueDate', dir: 'asc' },
	fields: [
		{ key: 'title', label: 'Title', type: 'text', required: true, list: true, sortable: true },
		{
			key: 'projectId',
			label: 'Project',
			type: 'link',
			linkTo: 'project',
			required: true,
			list: true,
			filterable: true
		},
		{
			key: 'status',
			label: 'Status',
			type: 'select',
			options: ['todo', 'in_progress', 'done'],
			list: true,
			sortable: true,
			filterable: true,
			transitions: {
				'': ['todo', 'in_progress'],
				todo: ['in_progress', 'done'],
				in_progress: ['todo', 'done'],
				done: ['todo', 'in_progress']
			}
		},
		{
			key: 'priority',
			label: 'Priority',
			type: 'select',
			options: ['low', 'medium', 'high'],
			list: true,
			filterable: true
		},
		{ key: 'assigneeId', label: 'Assignee', type: 'user', list: true, filterable: true },
		{ key: 'dueDate', label: 'Due date', type: 'date', list: true, sortable: true },
		{ key: 'notes', label: 'Notes', type: 'textarea' }
	]
});
