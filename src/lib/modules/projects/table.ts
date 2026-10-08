import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { id, orgId, timestamps } from '#lib/server/db/kit.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { directoryCompany } from '#lib/modules/directory/table.ts';

export const project = pgTable(
	'project',
	{
		id: id(),
		organizationId: orgId(),
		name: text('name').notNull(),
		status: text('status').notNull().default('active'),
		companyId: text('company_id').references(() => directoryCompany.id, { onDelete: 'set null' }),
		dueDate: text('due_date'),
		description: text('description'),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [index('project_org_idx').on(t.organizationId, t.status)]
);

export const task = pgTable(
	'task',
	{
		id: id(),
		organizationId: orgId(),
		title: text('title').notNull(),
		projectId: text('project_id')
			.notNull()
			.references(() => project.id, { onDelete: 'cascade' }),
		status: text('status').notNull().default('todo'),
		priority: text('priority').default('medium'),
		assigneeId: text('assignee_id').references(() => user.id, { onDelete: 'set null' }),
		dueDate: text('due_date'),
		notes: text('notes'),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		...timestamps
	},
	(t) => [
		index('task_org_idx').on(t.organizationId, t.projectId),
		index('task_status_idx').on(t.organizationId, t.status)
	]
);
