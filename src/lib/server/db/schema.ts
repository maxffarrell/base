import { sql } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { organization, user } from './auth.schema.ts';
import { id, orgId, timestamps } from './kit.ts';

export * from './auth.schema.ts';
export * from '#lib/modules/tables.ts';

/**
 * A file uploaded to the workspace. `entityType`/`entityId` attach it to any
 * registered entity record (generic by design).
 */
export const document = pgTable(
	'document',
	{
		id: id(),
		organizationId: orgId(),
		name: text('name').notNull(),
		contentType: text('content_type').notNull(),
		size: integer('size').notNull(),
		storageKey: text('storage_key').notNull(),
		entityType: text('entity_type'),
		entityId: text('entity_id'),
		uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
		...timestamps
	},
	(t) => [index('document_entity_idx').on(t.organizationId, t.entityType, t.entityId)]
);

/** A note/comment thread attachable to any registered entity record. */
export const comment = pgTable(
	'comment',
	{
		id: id(),
		organizationId: orgId(),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		...timestamps
	},
	(t) => [index('comment_entity_idx').on(t.organizationId, t.entityType, t.entityId)]
);

/** Per-user starred records across any entity. */
export const favorite = pgTable(
	'favorite',
	{
		id: id(),
		organizationId: orgId(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		...timestamps
	},
	(t) => [
		uniqueIndex('favorite_unique_idx').on(t.organizationId, t.userId, t.entityType, t.entityId)
	]
);

export const documentBlob = pgTable('document_blob', {
	storageKey: text('storage_key').primaryKey(),
	data: text('data').notNull()
});

/** Audit trail / event feed for every entity mutation. */
export const activity = pgTable(
	'activity',
	{
		id: id(),
		organizationId: orgId(),
		actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		action: text('action').notNull(),
		summary: text('summary').notNull(),
		data: jsonb('data').$type<Record<string, unknown>>(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('activity_org_created_idx').on(t.organizationId, t.createdAt),
		index('activity_entity_idx').on(t.entityType, t.entityId)
	]
);

/** Per-workspace notification preferences. Feature flags are generic key/value. */
export const notificationSettings = pgTable('notification_settings', {
	organizationId: text('organization_id')
		.primaryKey()
		.references(() => organization.id, { onDelete: 'cascade' }),
	/** Feature-keyed toggles, e.g. { "entity.created": true }. */
	prefs: jsonb('prefs').$type<Record<string, boolean>>().notNull().default({}),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

/** One row per notification sent, so each notice goes out once per recipient. */
export const notificationLog = pgTable(
	'notification_log',
	{
		id: id(),
		organizationId: orgId(),
		kind: text('kind').notNull(),
		entityId: text('entity_id').notNull(),
		recipient: text('recipient').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('notification_log_once_idx').on(t.kind, t.entityId, t.recipient)]
);

/** One in-app notification for one workspace member, deduped per (kind, entity, user). */
export const inboxItem = pgTable(
	'inbox_item',
	{
		id: id(),
		organizationId: orgId(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		entityId: text('entity_id').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		href: text('href'),
		readAt: timestamp('read_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('inbox_item_once_idx').on(t.kind, t.entityId, t.userId),
		index('inbox_item_user_idx').on(t.userId, t.organizationId, t.createdAt)
	]
);

/** A named, workspace-shared list configuration (filters + sort) a member can apply later. */
export const savedView = pgTable(
	'saved_view',
	{
		id: id(),
		organizationId: orgId(),
		/** List key the view belongs to, normally an entity name. */
		page: text('page').notNull(),
		name: text('name').notNull(),
		state: jsonb('state').$type<Record<string, unknown>>().notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		...timestamps
	},
	(t) => [
		index('saved_view_org_page_idx').on(t.organizationId, t.page),
		uniqueIndex('saved_view_name_idx').on(t.organizationId, t.page, t.name)
	]
);

/** Admin-defined extra field attached to a registered entity type. */
export const customField = pgTable(
	'custom_field',
	{
		id: id(),
		organizationId: orgId(),
		/** Entity key from the entity registry. */
		entity: text('entity').notNull(),
		name: text('name').notNull(),
		/** 'text' | 'number' | 'date' | 'select' | 'checkbox' */
		type: text('type').notNull().default('text'),
		/** Choices for type='select'. */
		options: jsonb('options').$type<string[]>(),
		position: integer('position').notNull().default(0),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('custom_field_org_entity_idx').on(t.organizationId, t.entity),
		uniqueIndex('custom_field_name_idx').on(t.organizationId, t.entity, t.name)
	]
);

export const customFieldValue = pgTable(
	'custom_field_value',
	{
		id: id(),
		fieldId: text('field_id')
			.notNull()
			.references(() => customField.id, { onDelete: 'cascade' }),
		recordId: text('record_id').notNull(),
		value: text('value'),
		...timestamps
	},
	(t) => [
		uniqueIndex('custom_field_value_once_idx').on(t.fieldId, t.recordId),
		index('custom_field_value_record_idx').on(t.recordId)
	]
);

export const webhook = pgTable(
	'webhook',
	{
		id: id(),
		organizationId: orgId(),
		url: text('url').notNull(),
		secret: text('secret').notNull(),
		events: text('events')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		enabled: boolean('enabled').notNull().default(true),
		lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
		lastDeliveryStatus: integer('last_delivery_status'),
		...timestamps
	},
	(t) => [index('webhook_org_idx').on(t.organizationId)]
);

/** A "when event, do action" automation rule built in Settings → Workflows. */
export const workflow = pgTable(
	'workflow',
	{
		id: id(),
		organizationId: orgId(),
		name: text('name').notNull(),
		/** Event type to match ('<entity>.created') or '*' for everything. */
		eventType: text('event_type').notNull(),
		action: text('action').notNull(),
		config: jsonb('config').$type<Record<string, string | null>>().notNull().default({}),
		enabled: boolean('enabled').notNull().default(true),
		lastRunAt: timestamp('last_run_at', { withTimezone: true }),
		runCount: integer('run_count').notNull().default(0),
		...timestamps
	},
	(t) => [index('workflow_org_idx').on(t.organizationId, t.enabled)]
);

export const integrationInstall = pgTable(
	'integration_install',
	{
		id: id(),
		organizationId: orgId(),
		integrationId: text('integration_id').notNull(),
		config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
		enabled: boolean('enabled').notNull().default(true),
		...timestamps
	},
	(t) => [uniqueIndex('integration_install_org_idx').on(t.organizationId, t.integrationId)]
);

/** An OAuth connection to an integration. Tokens are encrypted (see integrations/seal.ts). */
export const integrationConnection = pgTable(
	'integration_connection',
	{
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		integrationId: text('integration_id').notNull(),
		accessToken: text('access_token').notNull(),
		refreshToken: text('refresh_token'),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		params: jsonb('params').$type<Record<string, string>>().notNull().default({}),
		/** The connected account, e.g. an external tenant ID. Sync links are kept per account. */
		account: text('account').notNull().default(''),
		accountName: text('account_name'),
		status: text('status').$type<'connected' | 'reconnect'>().notNull().default('connected'),
		connectedBy: text('connected_by').references(() => user.id, { onDelete: 'set null' }),
		syncStartedAt: timestamp('sync_started_at', { withTimezone: true }),
		lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
		lastSyncResult: jsonb('last_sync_result').$type<{
			synced: number;
			skipped: number;
			failed: number;
			removed: number;
			remaining: number;
		}>(),
		lastError: text('last_error'),
		...timestamps
	},
	(t) => [primaryKey({ columns: [t.organizationId, t.integrationId] })]
);

/** Which external record a local record was synced to, or why it wasn't. */
export const integrationLink = pgTable(
	'integration_link',
	{
		id: id(),
		organizationId: orgId(),
		integrationId: text('integration_id').notNull(),
		account: text('account').notNull().default(''),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		externalId: text('external_id'),
		status: text('status').$type<'synced' | 'skipped' | 'failed'>().notNull(),
		error: text('error'),
		...timestamps
	},
	(t) => [
		uniqueIndex('integration_link_entity_idx').on(
			t.organizationId,
			t.integrationId,
			t.account,
			t.entityType,
			t.entityId
		),
		index('integration_link_status_idx').on(t.organizationId, t.integrationId, t.status)
	]
);
