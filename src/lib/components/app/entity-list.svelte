<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Modal from '#lib/components/ui/modal/index.js';
	import * as NativeSelect from '#lib/components/ui/native-select/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Pagination from '#lib/components/ui/pagination/index.js';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import BulkBar from '#lib/components/app/bulk-bar.svelte';
	import EntityForm from '#lib/components/app/entity-form.svelte';
	import KanbanBoard from '#lib/components/app/kanban-board.svelte';
	import PageHeader from '#lib/components/app/page-header.svelte';
	import SavedViewsMenu from '#lib/components/app/saved-views-menu.svelte';
	import StatusBadge from '#lib/components/app/status-badge.svelte';
	import ViewSwitcher, { type ViewKind } from '#lib/components/app/view-switcher.svelte';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { confirmDelete } from '#lib/components/ui/confirm-delete-dialog/index.js';
	import type { EntityDef, EntityField } from '#lib/entities.ts';
	import { formatDate, formatMoney } from '#lib/format.ts';
	import {
		bulkDeleteRecords,
		getLinkOptions,
		importEntityRecords,
		listEntityRecords
	} from '#lib/remote/entities.remote.ts';
	import { recordTitle } from '#lib/entities.ts';
	import { cn } from '#lib/utils.js';

	/** Generic list view: search, per-field filters, sortable columns, pagination,
	 * bulk delete — all driven by the entity's field metadata. */
	let { def }: { def: EntityDef } = $props();

	const PAGE_SIZE = 25;
	const columns = $derived(
		def.fields.filter((f) => f.list || (def.searchFields ?? []).includes(f.key)).slice(0, 6)
	);
	const filterFields = $derived(def.fields.filter((f) => f.filterable));

	let q = $state('');
	let filters = $state<Record<string, string>>({});
	let sort = $state<{ key: string; dir: 'asc' | 'desc' }>({ key: '', dir: 'asc' });
	let pageNum = $state(1);
	let selected = $state<Set<string>>(new Set());
	let showNew = $state(false);
	let linkTitles = $state<Record<string, Record<string, string>>>({});

	// Board view: enabled when the entity has a select field to group by.
	const groupField = $derived(
		def.fields.find((f) => f.type === 'select' && (f.options?.length ?? 0) > 1)
	);
	const views = $derived<ViewKind[]>(groupField ? ['table', 'kanban'] : ['table']);
	let view = $state<ViewKind>('table');
	const kanbanQuery = $derived(
		view === 'kanban' ? listEntityRecords({ entity: def.name, q, filters, limit: 500 }) : null
	);

	function kanbanCols(rows: Record<string, unknown>[]) {
		const opts = groupField?.options ?? [];
		const by = new Map<string, Record<string, unknown>[]>(opts.map((o) => [o, []]));
		const none: Record<string, unknown>[] = [];
		for (const r of rows) {
			const v = r[groupField!.key] as string | null;
			(by.get(v ?? '') ?? none).push(r);
		}
		return [
			...opts.map((o) => ({ key: o, label: o, items: by.get(o) ?? [] })),
			{ key: 'none', label: 'No status', items: none }
		];
	}

	// CSV import: first row is field keys; values coerced to the field type.
	let showImport = $state(false);
	let csv = $state('');
	let importing = $state(false);
	const importFields = $derived(def.fields.filter((f) => !f.readonly).slice(0, 8));
	const csvHeader = $derived(importFields.map((f) => f.key).join(','));

	function parseCsv(text: string) {
		const rows: string[][] = [];
		let cur = [''],
			inQ = false;
		const text2 = text.replace(/\r\n?/g, '\n');
		for (let i = 0; i < text2.length; i++) {
			const ch = text2[i];
			if (inQ) {
				if (ch === '"' && text2[i + 1] === '"') {
					cur[cur.length - 1] += '"';
					i++;
				} else if (ch === '"') inQ = false;
				else cur[cur.length - 1] += ch;
			} else if (ch === '"') inQ = true;
			else if (ch === ',') cur.push('');
			else if (ch === '\n') {
				rows.push(cur);
				cur = [''];
			} else cur[cur.length - 1] += ch;
		}
		rows.push(cur);
		const [headers, ...data] = rows.filter((r) => r.some((c) => c.trim() !== ''));
		if (!headers?.length || !data.length) return [];
		const coerce = new Map(def.fields.map((f) => [f.key, f.type]));
		return data.map((cols) => {
			const rec: Record<string, unknown> = {};
			headers.forEach((h, i) => {
				const key = h.trim();
				const raw = (cols[i] ?? '').trim();
				if (raw === '') return;
				const t = coerce.get(key);
				rec[key] =
					t === 'number' || t === 'currency'
						? Number(raw)
						: t === 'boolean'
							? ['true', 'yes', '1'].includes(raw.toLowerCase())
							: raw;
			});
			return rec;
		});
	}

	async function runImport() {
		const rows = parseCsv(csv);
		if (!rows.length) {
			toast.error('No data rows — first row must be field keys');
			return;
		}
		importing = true;
		try {
			const res = await importEntityRecords({ entity: def.name, rows });
			toast.success(
				`Imported ${res.created}${res.failed.length ? `, ${res.failed.length} failed` : ''}`
			);
			for (const f of res.failed.slice(0, 3)) toast.error(`Row ${f.row}: ${f.error}`);
			csv = '';
			showImport = false;
			await query.refresh();
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Import failed');
		} finally {
			importing = false;
		}
	}

	$effect(() => {
		if (def.defaultSort && !sort.key) sort = { ...def.defaultSort };
		if (page.url.searchParams.get('new') === '1') showNew = true;
		for (const f of def.fields) {
			if (f.type === 'link' && f.linkTo && !linkTitles[f.key]) {
				void getLinkOptions(f.linkTo).then((opts) => {
					linkTitles[f.key] = Object.fromEntries(opts.map((o) => [o.id, o.title]));
				});
			}
		}
	});

	const query = $derived(
		listEntityRecords({
			entity: def.name,
			q,
			filters,
			sort: sort.key || undefined,
			dir: sort.dir,
			limit: PAGE_SIZE,
			offset: (pageNum - 1) * PAGE_SIZE
		})
	);

	function toggleSort(key: string) {
		pageNum = 1;
		sort =
			sort.key !== key
				? { key, dir: 'asc' }
				: sort.dir === 'asc'
					? { key, dir: 'desc' }
					: { key: '', dir: 'asc' };
	}

	function setFilter(key: string, value: string) {
		filters = { ...filters, [key]: value };
		pageNum = 1;
	}

	function cell(f: EntityField, row: Record<string, unknown>) {
		const v = row[f.key];
		if (v == null || v === '') return '—';
		if (f.type === 'currency') return formatMoney(v as number);
		if (f.type === 'date') return formatDate(v as string);
		if (f.type === 'boolean') return v ? 'Yes' : 'No';
		if (f.type === 'link') return linkTitles[f.key]?.[v as string] ?? '…';
		return String(v);
	}

	function applyView(state: unknown) {
		const s = state as {
			q?: string;
			filters?: Record<string, string>;
			sort?: { key: string; dir: 'asc' | 'desc' };
		};
		q = s.q ?? '';
		filters = s.filters ?? {};
		sort = s.sort ?? { key: '', dir: 'asc' };
		pageNum = 1;
	}

	function removeSelected() {
		const ids = [...selected];
		confirmDelete({
			title: `Delete ${ids.length} ${ids.length === 1 ? def.label : (def.labelPlural ?? `${def.label}s`)}?`,
			description: 'This cannot be undone.',
			onConfirm: async () => {
				try {
					await bulkDeleteRecords({ entity: def.name, ids });
					selected = new Set();
					toast.success(`Deleted ${ids.length}`);
					await query.refresh();
				} catch (err) {
					toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Delete failed');
				}
			}
		});
	}

	const viewState = () => ({ q, filters, sort });
</script>

<PageHeader title={def.labelPlural ?? `${def.label}s`} crumbs={[{ label: 'Home', href: '/' }]}>
	{#snippet actions()}
		<Button size="sm" variant="outline" onclick={() => (showImport = true)}
			><Upload /> Import</Button
		>
		<Button size="sm" onclick={() => (showNew = true)}><Plus /> New {def.label}</Button>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-3 p-4">
	<div class="flex flex-wrap items-center gap-2">
		{#if def.searchFields?.length}
			<div class="relative w-64">
				<Search class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					class="pl-8"
					placeholder={`Search ${(def.labelPlural ?? def.label).toLowerCase()}…`}
					bind:value={q}
					oninput={() => (pageNum = 1)}
				/>
			</div>
		{/if}
		{#each filterFields as f (f.key)}
			<NativeSelect.Root
				class="h-9 w-40"
				aria-label={f.label}
				value={filters[f.key] ?? ''}
				onchange={(e) => setFilter(f.key, (e.target as HTMLSelectElement).value)}
			>
				<NativeSelect.Option value="">{f.label}: all</NativeSelect.Option>
				{#if f.type === 'select'}
					{#each f.options ?? [] as o (o)}<NativeSelect.Option value={o}>{o}</NativeSelect.Option
						>{/each}
				{:else if f.type === 'boolean'}
					<NativeSelect.Option value="true">Yes</NativeSelect.Option>
					<NativeSelect.Option value="false">No</NativeSelect.Option>
				{:else if f.type === 'link'}
					{#each Object.entries(linkTitles[f.key] ?? {}) as [id, title] (id)}<NativeSelect.Option
							value={id}>{title}</NativeSelect.Option
						>{/each}
				{/if}
			</NativeSelect.Root>
		{/each}
		<div class="ml-auto flex items-center gap-2">
			<ViewSwitcher {views} bind:value={view} />
			<SavedViewsMenu page={def.name} current={viewState} onapply={applyView} />
		</div>
	</div>

	{#await query}
		<div class="rounded-md border p-10 text-center text-sm text-muted-foreground">Loading…</div>
	{:then result}
		{#if result.rows.length === 0}
			<Empty.Root class="border">
				<Empty.Header>
					{#if def.icon}<Empty.Media variant="icon"><def.icon /></Empty.Media>{/if}
					<Empty.Title>No {def.labelPlural ?? `${def.label}s`} yet</Empty.Title>
					<Empty.Description
						>{def.description ?? 'Create the first one to get started.'}</Empty.Description
					>
				</Empty.Header>
				<Empty.Content
					><Button size="sm" onclick={() => (showNew = true)}><Plus /> New {def.label}</Button
					></Empty.Content
				>
			</Empty.Root>
		{:else if view === 'kanban' && kanbanQuery}
			{#await kanbanQuery then result}
				<KanbanBoard columns={kanbanCols(result.rows as Record<string, unknown>[])}>
					{#snippet card(row)}
						<button
							type="button"
							class="w-full rounded-md border bg-card p-3 text-left shadow-sm hover:bg-accent/50"
							onclick={() => goto(`/${def.name}/${row.id}`)}
						>
							<p class="line-clamp-2 text-sm font-medium">{recordTitle(def, row)}</p>
							{#if columns[1]}
								<p class="mt-1 line-clamp-1 text-xs text-muted-foreground">
									{cell(columns[1], row)}
								</p>
							{/if}
						</button>
					{/snippet}
				</KanbanBoard>
			{/await}
		{:else}
			<div class="overflow-x-auto rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-10">
								<Checkbox
									checked={result.rows.every((r) => selected.has(r.id as string))}
									onCheckedChange={(v) => {
										const next = new Set(selected);
										for (const r of result.rows)
											if (v) next.add(r.id as string);
											else next.delete(r.id as string);
										selected = next;
									}}
								/>
							</Table.Head>
							{#each columns as f (f.key)}
								<Table.Head>
									{#if f.sortable !== false}
										<button
											type="button"
											class="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-muted"
											onclick={() => toggleSort(f.key)}
										>
											{f.label}
											{#if sort.key === f.key && sort.dir === 'asc'}<ArrowUp class="size-3.5" />
											{:else if sort.key === f.key}<ArrowDown class="size-3.5" />
											{:else}<ArrowUpDown class="size-3.5 opacity-40" />{/if}
										</button>
									{:else}
										{f.label}
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each result.rows as row (row.id)}
							<Table.Row
								class="cursor-pointer"
								onclick={() => goto(`/${def.name}/${row.id}`)}
								data-state={selected.has(row.id as string) ? 'selected' : undefined}
							>
								<Table.Cell onclick={(e) => e.stopPropagation()}>
									<Checkbox
										checked={selected.has(row.id as string)}
										onCheckedChange={(v) => {
											const next = new Set(selected);
											if (v) next.add(row.id as string);
											else next.delete(row.id as string);
											selected = next;
										}}
									/>
								</Table.Cell>
								{#each columns as f (f.key)}
									<Table.Cell class={cn(f === columns[0] && 'font-medium')}>
										{#if f.type === 'select' && row[f.key] != null && row[f.key] !== ''}
											<StatusBadge status={String(row[f.key])} />
										{:else}
											<span class="line-clamp-1">{cell(f, row)}</span>
										{/if}
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
			<div class="flex items-center justify-between text-sm text-muted-foreground">
				<span>{result.count} {result.count === 1 ? 'record' : 'records'}</span>
				<Pagination.Root count={result.count} perPage={PAGE_SIZE} bind:page={pageNum}>
					{#snippet children({ pages })}
						<Pagination.Content>
							{#each pages as p (p.key)}
								<Pagination.Item>
									{#if p.type === 'ellipsis'}<Pagination.Ellipsis />
									{:else}<Pagination.Link page={p} isActive={p.value === pageNum} />{/if}
								</Pagination.Item>
							{/each}
						</Pagination.Content>
					{/snippet}
				</Pagination.Root>
			</div>
		{/if}
	{:catch e}
		<div class="rounded-md border border-destructive/40 p-6 text-sm text-destructive">
			{e?.body?.message ?? 'Could not load records'}
		</div>
	{/await}
</div>

<BulkBar
	count={selected.size}
	total={selected.size}
	onselectall={() => {}}
	onclear={() => (selected = new Set())}
>
	{#snippet actions()}
		<Button variant="destructive" size="sm" onclick={removeSelected}
			><Trash2 class="size-4" /> Delete</Button
		>
	{/snippet}
</BulkBar>

<Modal.Root bind:open={showNew}>
	<Modal.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
		<Modal.Header>
			<Modal.Title>New {def.label}</Modal.Title>
		</Modal.Header>
		<EntityForm
			{def}
			onsaved={() => {
				showNew = false;
				void query.refresh();
			}}
		/>
	</Modal.Content>
</Modal.Root>

<Modal.Root bind:open={showImport}>
	<Modal.Content class="sm:max-w-xl">
		<Modal.Header>
			<Modal.Title>Import {def.labelPlural ?? `${def.label}s`}</Modal.Title>
			<Modal.Description>
				Paste CSV — the first row must be field keys, e.g.
				<code class="text-xs">{csvHeader}</code>. Up to 500 rows.
			</Modal.Description>
		</Modal.Header>
		<Textarea
			class="min-h-40 font-mono text-xs"
			placeholder={`${csvHeader}\n…`}
			bind:value={csv}
		/>
		<Modal.Footer>
			<Button variant="outline" onclick={() => (showImport = false)}>Cancel</Button>
			<Button onclick={runImport} disabled={importing}>
				{importing ? 'Importing…' : 'Import'}
			</Button>
		</Modal.Footer>
	</Modal.Content>
</Modal.Root>
