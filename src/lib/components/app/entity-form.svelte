<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import * as NativeSelect from '#lib/components/ui/native-select/index.js';
	import MoneyInput from '#lib/components/app/money-input.svelte';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import { getEntityDef, type EntityDef, type EntityField } from '#lib/entities.ts';
	import Plus from '@lucide/svelte/icons/plus';
	import * as Modal from '#lib/components/ui/modal/index.js';
	// Self-import enables the recursive "new linked record" form.
	import EntityForm from './entity-form.svelte';
	import { aiDraft, getAiStatus } from '#lib/remote/ai.remote.ts';
	import {
		createEntityRecord,
		getLinkOptions,
		listEntityRecords,
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

	const editable = $derived(def.fields.filter((f) => !f.readonly && !f.hidden));

	function buildInitial() {
		const initial: Record<string, unknown> = {};
		for (const f of editable) {
			const v = record?.[f.key];
			if (v != null) initial[f.key] = v;
			else if (f.default !== undefined) initial[f.key] = f.default;
			else if (f.type === 'boolean') initial[f.key] = false;
			else if (f.type === 'currency') initial[f.key] = null;
			else if (f.type === 'select' && f.options?.length)
				initial[f.key] = record ? '' : f.options[0];
			else initial[f.key] = '';
		}
		return initial;
	}

	// Initialized eagerly — bound inputs crash on `undefined` before the effect runs.
	let values = $state<Record<string, unknown>>(buildInitial());
	let linkChoices = $state<Record<string, { id: string; title: string }[]>>({});
	let members = $state<{ userId: string; name: string | null; email: string }[]>([]);
	let saving = $state(false);
	let attempted = $state(false);
	let aiReady = $state(false);
	let aiOpen = $state(false);
	let aiText = $state('');
	let aiBusy = $state(false);
	let linkNew = $state<EntityDef | null>(null);
	let linkNewField = $state('');

	$effect(() => {
		values = buildInitial();
		for (const f of editable) {
			if (f.type === 'link' && f.linkTo && !(f.key in linkChoices)) {
				void getLinkOptions(f.linkTo).then((opts) => (linkChoices[f.key] = opts));
			}
		}
		void getMembers().then((m) => (members = m));
		void getAiStatus().then((s) => (aiReady = s.licensed && s.configured));
	});

	const missing = (f: EntityField) =>
		attempted &&
		f.required &&
		(values[f.key] === '' || values[f.key] == null) &&
		f.type !== 'boolean';

	const inputType = (f: EntityField) =>
		f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'phone' ? 'tel' : 'text';

	async function draft() {
		if (!aiText.trim() || aiBusy) return;
		aiBusy = true;
		try {
			const out = await aiDraft({ entity: def.name, text: aiText });
			let applied = 0;
			for (const [k, v] of Object.entries(out)) {
				if (k in values) {
					values[k] = v;
					applied++;
				}
			}
			toast.success(
				applied
					? `Drafted ${applied} field${applied === 1 ? '' : 's'} — review before saving`
					: 'Nothing to fill in'
			);
			if (applied) aiOpen = false;
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'AI draft failed');
		} finally {
			aiBusy = false;
		}
	}

	/** Non-blocking heads-up when a record with a matching title already exists. */
	let dupCount = $state(0);
	$effect(() => {
		const tf = def.titleField;
		if (record || !tf || !def.searchFields?.includes(tf)) return;
		const v = String(values[tf] ?? '').trim();
		if (!v) {
			dupCount = 0;
			return;
		}
		const t = setTimeout(async () => {
			const { count } = await listEntityRecords({ entity: def.name, q: v, limit: 1 });
			if (String(values[tf] ?? '').trim() === v) dupCount = count;
		}, 300);
		return () => clearTimeout(t);
	});

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
	{#if aiReady}
		{#if aiOpen}
			<div class="rounded-lg border border-primary/30 bg-primary/5 p-3">
				<Textarea
					placeholder={`Describe the ${def.label.toLowerCase()} in words, e.g. "Jane at Acme, lead, jane@acme.com"`}
					bind:value={aiText}
					class="min-h-20 bg-background"
				/>
				<div class="mt-2 flex justify-end gap-2">
					<Button variant="ghost" size="sm" onclick={() => (aiOpen = false)}>Cancel</Button>
					<Button size="sm" onclick={draft} disabled={aiBusy || !aiText.trim()}>
						<Sparkles class="size-4" />
						{aiBusy ? 'Drafting…' : 'Draft fields'}
					</Button>
				</div>
			</div>
		{:else}
			<Button type="button" variant="outline" size="sm" onclick={() => (aiOpen = true)}>
				<Sparkles class="size-4" /> Draft with AI
			</Button>
		{/if}
	{/if}
	<Field.Group class="grid gap-4 sm:grid-cols-2">
		{#each editable as f, i (f.key)}
			{#if f.section && f.section !== editable[i - 1]?.section}
				<h3
					class="mt-2 -mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:col-span-2"
				>
					{f.section}
				</h3>
			{/if}
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
					<div class="flex gap-1">
						<NativeSelect.Root id="ef-{f.key}" class="flex-1" bind:value={values[f.key] as string}>
							<NativeSelect.Option value="">—</NativeSelect.Option>
							{#each linkChoices[f.key] ?? [] as o (o.id)}
								<NativeSelect.Option value={o.id}>{o.title}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
						{#if f.linkTo && getEntityDef(f.linkTo)}
							<Button
								type="button"
								variant="outline"
								size="icon"
								class="shrink-0"
								aria-label="New {getEntityDef(f.linkTo)?.label}"
								onclick={() => {
									linkNew = getEntityDef(f.linkTo!) ?? null;
									linkNewField = f.key;
								}}><Plus /></Button
							>
						{/if}
					</div>
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
				{#if f.help}<Field.Description>{f.help}</Field.Description>{/if}
				{#if missing(f)}<Field.Error>{f.label} is required</Field.Error>{/if}
			</Field.Field>
		{/each}
	</Field.Group>
	<div class="flex items-center justify-end gap-2">
		{#if !record && dupCount > 0}
			<p class="mr-auto text-xs text-amber-600">
				{dupCount} existing {def.label.toLowerCase()}{dupCount === 1 ? '' : 's'} match
				{dupCount === 1 ? 'es' : ''} this {def.titleField}
			</p>
		{/if}
		<Button type="submit" disabled={saving}
			>{record ? 'Save changes' : `Create ${def.label}`}</Button
		>
	</div>
</form>

<Modal.Root open={!!linkNew} onOpenChange={(v) => !v && (linkNew = null)}>
	<Modal.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
		<Modal.Header><Modal.Title>New {linkNew?.label}</Modal.Title></Modal.Header>
		{#if linkNew}
			<EntityForm
				def={linkNew}
				onsaved={(r: Record<string, unknown>) => {
					const key = linkNewField;
					void getLinkOptions(linkNew!.name).then((opts) => (linkChoices[key] = opts));
					values[key] = r.id;
					linkNew = null;
				}}
			/>
		{/if}
	</Modal.Content>
</Modal.Root>
