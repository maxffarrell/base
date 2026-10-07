<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as NativeSelect from '#lib/components/ui/native-select/index.js';
	import MoneyInput from '#lib/components/app/money-input.svelte';
	import type { EntityDef, EntityField } from '#lib/entities.ts';
	import {
		createEntityRecord,
		getLinkOptions,
		updateEntityRecord
	} from '#lib/remote/entities.remote.ts';
	import { getMembers } from '#lib/remote/workspace.remote.ts';
	import { cn } from '#lib/utils.js';

	/**
	 * Generic record form — renders inputs from an EntityDef's field metadata
	 * (the field-type → control map is this file's whole job, like Frappe's
	 * Control classes). Writes go through the generic remote functions, so
	 * hooks and validation run identically to API writes.
	 */
	let {
		def,
		record,
		onsaved
	}: {
		def: EntityDef;
		record?: Record<string, unknown> | null;
		onsaved?: (record: Record<string, unknown>) => void;
	} = $props();

	const editable = $derived(def.fields.filter((f) => !f.readonly));
	let values = $state<Record<string, unknown>>({});
	let linkChoices = $state<Record<string, { id: string; title: string }[]>>({});
	let members = $state<{ userId: string; name: string | null; email: string }[]>([]);
	let saving = $state(false);
	let attempted = $state(false);

	$effect(() => {
		const initial: Record<string, unknown> = {};
		for (const f of editable) {
			const v = record?.[f.key];
			if (v != null) initial[f.key] = v;
			else if (f.type === 'boolean') initial[f.key] = false;
			else if (f.type === 'select' && f.options?.length)
				initial[f.key] = record ? '' : f.options[0];
			else initial[f.key] = '';
		}
		values = initial;
		for (const f of editable) {
			if (f.type === 'link' && f.linkTo && !(f.key in linkChoices)) {
				void getLinkOptions(f.linkTo).then((opts) => (linkChoices[f.key] = opts));
			}
		}
		void getMembers().then((m) => (members = m));
	});

	const missing = (f: EntityField) =>
		attempted &&
		f.required &&
		(values[f.key] === '' || values[f.key] == null) &&
		f.type !== 'boolean';

	const inputType = (f: EntityField) =>
		f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'phone' ? 'tel' : 'text';

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		attempted = true;
		if (editable.some(missing)) return;
		saving = true;
		try {
			const input = Object.fromEntries(
				editable.map((f) => [
					f.key,
					f.type === 'number' || f.type === 'currency'
						? values[f.key] === '' || values[f.key] == null
							? null
							: Number(values[f.key])
						: values[f.key] === ''
							? null
							: values[f.key]
				])
			);
			const saved = record?.id
				? await updateEntityRecord({ entity: def.name, id: record.id as string, input })
				: await createEntityRecord({ entity: def.name, input });
			toast.success(record ? `${def.label} updated` : `${def.label} created`);
			onsaved?.(saved as Record<string, unknown>);
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Could not save');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-4" onsubmit={submit}>
	<Field.Group class="grid gap-4 sm:grid-cols-2">
		{#each editable as f (f.key)}
			<Field.Field class={cn(f.type === 'textarea' && 'sm:col-span-2')}>
				<Field.Label for="ef-{f.key}">{f.label}{f.required ? ' *' : ''}</Field.Label>
				{#if f.type === 'textarea'}
					<Textarea
						id="ef-{f.key}"
						placeholder={f.placeholder}
						bind:value={values[f.key] as string}
						class="min-h-24"
					/>
				{:else if f.type === 'boolean'}
					<div class="pt-1">
						<Switch
							id="ef-{f.key}"
							checked={!!values[f.key]}
							onCheckedChange={(v) => (values[f.key] = v)}
						/>
					</div>
				{:else if f.type === 'select'}
					<NativeSelect.Root id="ef-{f.key}" bind:value={values[f.key] as string}>
						{#if !f.required}<NativeSelect.Option value="">—</NativeSelect.Option>{/if}
						{#each f.options ?? [] as o (o)}
							<NativeSelect.Option value={o}>{o}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				{:else if f.type === 'link'}
					<NativeSelect.Root id="ef-{f.key}" bind:value={values[f.key] as string}>
						<NativeSelect.Option value="">—</NativeSelect.Option>
						{#each linkChoices[f.key] ?? [] as o (o.id)}
							<NativeSelect.Option value={o.id}>{o.title}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				{:else if f.type === 'user'}
					<NativeSelect.Root id="ef-{f.key}" bind:value={values[f.key] as string}>
						<NativeSelect.Option value="">—</NativeSelect.Option>
						{#each members as m (m.userId)}
							<NativeSelect.Option value={m.userId}>{m.name ?? m.email}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
				{:else if f.type === 'currency'}
					<MoneyInput id="ef-{f.key}" bind:value={values[f.key] as number | null} />
				{:else if f.type === 'number'}
					<Input id="ef-{f.key}" type="number" step="any" bind:value={values[f.key] as string} />
				{:else if f.type === 'date'}
					<Input id="ef-{f.key}" type="date" bind:value={values[f.key] as string} />
				{:else}
					<Input
						id="ef-{f.key}"
						type={inputType(f)}
						placeholder={f.placeholder}
						bind:value={values[f.key] as string}
					/>
				{/if}
				{#if missing(f)}<Field.Error>{f.label} is required</Field.Error>{/if}
			</Field.Field>
		{/each}
	</Field.Group>
	<div class="flex justify-end gap-2">
		<Button type="submit" disabled={saving}
			>{record ? 'Save changes' : `Create ${def.label}`}</Button
		>
	</div>
</form>
