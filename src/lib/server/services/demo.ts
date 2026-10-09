import type { OrgContext } from '#lib/server/context.ts';
import { createRecord } from '#lib/server/services/entity.ts';
import { saveView } from '#lib/server/services/views.ts';
import { createWorkflow } from '#lib/server/services/workflows.ts';
import { db } from '#lib/server/db/index.ts';
import { comment } from '#lib/server/db/schema.ts';

const days = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

/** Fills a fresh workspace with realistic data across every demo module so a
 * visitor can immediately explore lists, boards, kanban drag, reports,
 * comments, saved views, and workflows. Everything goes through createRecord
 * so validation, hooks, and activity entries run exactly as they would for a
 * real user. */
export async function loadDemoData(ctx: OrgContext) {
	const acme = (
		await createRecord(ctx, 'company', {
			name: 'Acme Robotics',
			industry: 'technology',
			website: 'https://acme.example.com',
			phone: '+1 415 555 0132'
		})
	).id;
	const harbor = (
		await createRecord(ctx, 'company', {
			name: 'Harbor Retail Group',
			industry: 'retail',
			website: 'https://harbor.example.com'
		})
	).id;
	const northpeak = (
		await createRecord(ctx, 'company', {
			name: 'Northpeak Manufacturing',
			industry: 'manufacturing',
			phone: '+1 303 555 0187'
		})
	).id;
	await createRecord(ctx, 'company', {
		name: 'Bluefin Services',
		industry: 'services',
		notes: 'Referred by Acme — quarterly review scheduled.'
	});

	const maya = (
		await createRecord(ctx, 'contact', {
			name: 'Maya Chen',
			email: 'maya.chen@acme.example.com',
			companyId: acme,
			stage: 'lead',
			tags: ['vip', 'q4-target'],
			notes: 'Met at the robotics expo — wants a pilot before year-end.'
		})
	).id;
	// Lead → customer transitions exercise the stage state machine.
	const omar = (
		await createRecord(ctx, 'contact', {
			name: 'Omar Haddad',
			email: 'omar@harbor.example.com',
			companyId: harbor,
			stage: 'lead',
			tags: ['vip']
		})
	).id;
	await createRecord(ctx, 'contact', {
		name: 'Priya Natarajan',
		email: 'priya@northpeak.example.com',
		companyId: northpeak,
		stage: 'lead',
		phone: '+1 303 555 0143'
	});
	await createRecord(ctx, 'contact', {
		name: 'Grace Okafor',
		email: 'grace@acme.example.com',
		companyId: acme,
		stage: 'lead',
		tags: ['newsletter']
	});
	await updateRecordDemo(ctx, 'contact', omar, { stage: 'customer' });
	await updateRecordDemo(ctx, 'contact', maya, { stage: 'customer' });

	const website = (
		await createRecord(ctx, 'project', {
			name: 'Website redesign',
			status: 'active',
			companyId: acme,
			dueDate: days(21),
			description: 'Marketing site rebuild with the new brand.'
		})
	).id;
	const rollout = (
		await createRecord(ctx, 'project', {
			name: 'Store rollout — phase 2',
			status: 'active',
			companyId: harbor,
			dueDate: days(45)
		})
	).id;
	await createRecord(ctx, 'project', {
		name: 'Line audit 2025',
		status: 'done',
		companyId: northpeak,
		dueDate: days(-14),
		description: 'Annual equipment audit, wrapped early.'
	});

	const tasks: [string, string, string, string, number][] = [
		[website, 'Draft wireframes', 'done', 'high', -3],
		[website, 'Copy deck for landing page', 'in_progress', 'medium', 4],
		[website, 'QA on staging', 'todo', 'medium', 14],
		[rollout, 'Order shelving units', 'in_progress', 'high', -2],
		[rollout, 'Hire floor staff', 'todo', 'high', 7],
		[rollout, 'Plan opening event', 'todo', 'low', 30],
		[website, 'Migrate blog posts', 'todo', 'low', 18]
	];
	for (const [projectId, title, status, priority, due] of tasks) {
		await createRecord(ctx, 'task', {
			projectId,
			title,
			status,
			priority,
			dueDate: days(due),
			assigneeId: ctx.userId
		});
	}

	const inv1 = (
		await createRecord(ctx, 'invoice', {
			number: 'INV-1001',
			companyId: acme,
			status: 'sent',
			amount: 2400000,
			issuedDate: days(-20),
			dueDate: days(-5),
			notes: 'Milestone 2 — website redesign'
		})
	).id;
	const inv2 = (
		await createRecord(ctx, 'invoice', {
			number: 'INV-1002',
			companyId: harbor,
			status: 'sent',
			amount: 815000,
			issuedDate: days(-3),
			dueDate: days(27)
		})
	).id;
	await createRecord(ctx, 'invoice', {
		number: 'INV-1003',
		companyId: northpeak,
		status: 'paid',
		amount: 1320000,
		issuedDate: days(-40),
		dueDate: days(-10)
	});
	await createRecord(ctx, 'invoice', {
		number: 'INV-1004',
		companyId: acme,
		status: 'draft',
		amount: 960000,
		issuedDate: days(0),
		dueDate: days(30),
		notes: 'Milestone 3 — pending sign-off'
	});
	await createRecord(ctx, 'payment', {
		reference: 'PAY-2201',
		invoiceId: inv2,
		amount: 400000,
		method: 'transfer',
		paidAt: days(-1)
	});
	await createRecord(ctx, 'payment', {
		reference: 'PAY-2200',
		invoiceId: inv1,
		amount: 1000000,
		method: 'card',
		paidAt: days(-6),
		notes: 'Partial — balance due on receipt'
	});

	const drill = (
		await createRecord(ctx, 'stock_item', {
			sku: 'EQ-DRILL-9',
			name: 'Rotary drill',
			category: 'equipment',
			quantity: 6,
			reorderLevel: 2,
			unitCost: 18999,
			location: 'Aisle 1, Bay 4'
		})
	).id;
	await createRecord(ctx, 'stock_item', {
		sku: 'SUP-GLOVE-L',
		name: 'Work gloves (L)',
		category: 'supplies',
		quantity: 3,
		reorderLevel: 12,
		unitCost: 850,
		location: 'Aisle 3, Bay 1'
	});
	await createRecord(ctx, 'stock_item', {
		sku: 'MERCH-TEE-M',
		name: 'Logo tee (M)',
		category: 'merch',
		quantity: 48,
		unitCost: 1200
	});
	await createRecord(ctx, 'stock_movement', {
		itemId: drill,
		direction: 'out',
		quantity: 2,
		reason: 'sale',
		movedAt: days(-2)
	});
	await createRecord(ctx, 'stock_movement', {
		itemId: drill,
		direction: 'in',
		quantity: 8,
		reason: 'purchase',
		movedAt: days(-30)
	});

	await db.insert(comment).values({
		organizationId: ctx.orgId,
		entityType: 'contact',
		entityId: maya,
		authorId: ctx.userId,
		body: 'Followed up by email — sending the pilot proposal Friday.'
	});

	await saveView(ctx.orgId, ctx.userId, 'task', 'Due this week', {
		sorting: [{ id: 'dueDate', desc: false }],
		'filter.status': 'todo'
	});
	await createWorkflow(ctx, {
		name: 'Ping team on new tasks',
		eventType: 'task.created',
		action: 'notify',
		config: { message: 'New task: {summary}' },
		enabled: true
	});
}

/** updateRecord through the same ctx; kept local so the seed reads top-down. */
async function updateRecordDemo(
	ctx: OrgContext,
	entity: string,
	id: string,
	input: Record<string, unknown>
) {
	const { updateRecord } = await import('#lib/server/services/entity.ts');
	await updateRecord(ctx, entity, id, input);
}
