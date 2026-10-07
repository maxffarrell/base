import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { member, organization, user, workflow } from '#lib/server/db/schema.ts';
import { appOrigin, sendEmail } from '#lib/server/email.ts';
import { renderEmail } from '#lib/server/email-template.ts';
import * as v from 'valibot';
import type { OrgContext } from '#lib/server/context.ts';
import type { workflowInput, workflowUpdate } from '#lib/schemas.ts';
import type { BaseEvent } from '#lib/server/services/events.ts';
import { inboxForManagers } from '#lib/server/services/inbox.ts';
import { getNotificationPrefs } from '#lib/server/services/notifications.ts';
import { createRecord } from '#lib/server/services/entity.ts';
import { error } from '@sveltejs/kit';

type Out<T extends v.GenericSchema> = v.InferOutput<T>;

export async function listWorkflows(orgId: string) {
	return db
		.select()
		.from(workflow)
		.where(eq(workflow.organizationId, orgId))
		.orderBy(desc(workflow.createdAt));
}

export async function createWorkflow(ctx: OrgContext, input: Out<typeof workflowInput>) {
	const [row] = await db
		.insert(workflow)
		.values({ ...input, organizationId: ctx.orgId })
		.returning();
	return row!;
}

export async function updateWorkflow(ctx: OrgContext, { id, ...data }: Out<typeof workflowUpdate>) {
	const [row] = await db
		.update(workflow)
		.set(data)
		.where(and(eq(workflow.organizationId, ctx.orgId), eq(workflow.id, id)))
		.returning();
	if (!row) error(404, 'Rule not found');
	return row;
}

export async function deleteWorkflow(orgId: string, id: string) {
	const [row] = await db
		.delete(workflow)
		.where(and(eq(workflow.organizationId, orgId), eq(workflow.id, id)))
		.returning({ id: workflow.id });
	if (!row) error(404, 'Rule not found');
}

const entityHref = (type: string, id: string) => `/${type}/${id}`;

const render = (template: string, event: BaseEvent) =>
	template.replaceAll('{summary}', event.summary).replaceAll('{event}', event.type);

async function orgName(orgId: string) {
	const [o] = await db
		.select({ name: organization.name })
		.from(organization)
		.where(eq(organization.id, orgId));
	return o?.name ?? 'Your workspace';
}

async function managerEmails(orgId: string) {
	const rows = await db
		.select({ email: user.email })
		.from(member)
		.innerJoin(user, eq(user.id, member.userId))
		.where(and(eq(member.organizationId, orgId), inArray(member.role, ['owner', 'admin'])));
	return rows.map((r) => r.email);
}

/** True while a create_record action is executing; suppresses nested runs. */
let creatingRecord = false;

/** Runs every enabled rule matching the event; called from emit() (fire-and-forget). */
export async function runWorkflows(event: BaseEvent) {
	const rules = await db
		.select()
		.from(workflow)
		.where(and(eq(workflow.organizationId, event.organizationId), eq(workflow.enabled, true)));
	const matched = rules.filter((r) => r.eventType === '*' || r.eventType === event.type);
	for (const rule of matched) {
		try {
			if (rule.action === 'notify') {
				const prefs = await getNotificationPrefs(event.organizationId);
				if (!prefs['workflow.notify']) continue;
				const body = rule.config.message ? render(rule.config.message, event) : event.summary;
				const href = entityHref(event.entity.type, event.entity.id);
				await inboxForManagers(event.organizationId, `workflow.${rule.id}`, event.entity.id, {
					title: rule.name,
					body,
					href
				});
				const org = await orgName(event.organizationId);
				for (const to of await managerEmails(event.organizationId)) {
					await sendEmail({
						to,
						subject: `${rule.name}: ${event.summary}`,
						...renderEmail({
							orgName: org,
							heading: `Workflow: ${rule.name}`,
							lines: [body, `Event: ${event.type}`],
							action: href ? { label: 'Open record', url: `${appOrigin()}${href}` } : undefined
						})
					});
				}
			} else if (rule.action === 'create_record') {
				// A workflow-created record re-emits <entity>.created; skip nested
				// create_record runs so a rule on that event can't amplify itself.
				if (creatingRecord) continue;
				const entity = rule.config.entity;
				if (!entity) continue;
				creatingRecord = true;
				try {
					// config fields are `field.<key>` -> template string
					const input = Object.fromEntries(
						Object.entries(rule.config)
							.filter(([k]) => k.startsWith('field.'))
							.map(([k, val]) => [k.slice(6), val ? render(val, event) : val])
					);
					await createRecord(
						{
							orgId: event.organizationId,
							userId: 'system',
							role: 'admin',
							org: { id: event.organizationId, name: '', slug: '', logo: null }
						},
						entity,
						input
					);
				} finally {
					creatingRecord = false;
				}
			}
			await db
				.update(workflow)
				.set({ lastRunAt: new Date(), runCount: rule.runCount + 1 })
				.where(eq(workflow.id, rule.id));
		} catch (err) {
			console.error(`workflow ${rule.id} (${rule.name}) failed`, err);
			continue;
		}
	}
}
