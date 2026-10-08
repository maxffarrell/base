import * as v from 'valibot';

/** Shared Valibot schemas for infra features (entity inputs are generated from EntityDef — see services/entity.ts). */

export const idSchema = v.pipe(v.string(), v.minLength(1));

export const webhookInput = v.object({
	url: v.pipe(v.string(), v.url()),
	events: v.optional(v.array(v.pipe(v.string(), v.minLength(1))), ['*'])
});

export const webhookUpdate = v.object({
	id: idSchema,
	url: v.pipe(v.string(), v.url()),
	events: v.array(v.pipe(v.string(), v.minLength(1))),
	enabled: v.boolean()
});

/** Per-workspace notification toggles, keyed by feature. */
export const notificationSettingsInput = v.record(v.string(), v.boolean());

/** Custom fields, attachable to any registered entity. */
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox';
export const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox'] as const;
/** Entity keys come from the runtime registry, so this stays a plain string. */
export type FieldEntity = string;

export const fieldInput = v.object({
	entity: v.pipe(v.string(), v.minLength(1), v.maxLength(60)),
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
	type: v.picklist(FIELD_TYPES),
	options: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))))
});

export const fieldUpdate = v.object({
	id: idSchema,
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60)),
	options: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))))
});

export const fieldValueWrite = v.object({
	recordId: idSchema,
	fieldId: idSchema,
	value: v.nullable(v.string())
});

/** Workflow automation rules. */
export const WORKFLOW_ACTIONS = ['notify', 'create_record', 'set_field'] as const;

export const workflowInput = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
	eventType: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
	action: v.picklist(WORKFLOW_ACTIONS),
	config: v.record(v.string(), v.nullable(v.string())),
	enabled: v.boolean()
});

export const workflowUpdate = v.object({
	id: idSchema,
	name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
	eventType: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(80))),
	action: v.optional(v.picklist(WORKFLOW_ACTIONS)),
	config: v.optional(v.record(v.string(), v.nullable(v.string()))),
	enabled: v.optional(v.boolean())
});
