<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import Printer from '@lucide/svelte/icons/printer';
	import { getEntityDef, recordTitle, type EntityField } from '#lib/entities.ts';
	import { formatDate, formatMoney } from '#lib/format.ts';
	import '#lib/modules/index.ts';
	import { getEntityRecord, getLinkOptions } from '#lib/remote/entities.remote.ts';
	import { getRecordFields } from '#lib/remote/fields.remote.ts';
	import { getMembers } from '#lib/remote/workspace.remote.ts';

	const def = $derived(getEntityDef(page.params.entity ?? ''));
	const id = $derived(page.params.id ?? '');
	const recordQuery = $derived(def ? getEntityRecord({ entity: def.name, id }) : null);
	const fieldsQuery = $derived(def ? getRecordFields({ entity: def.name, recordId: id }) : null);

	let linkTitles = $state<Record<string, Record<string, string>>>({});
	let userNames = $state<Record<string, string>>({});

	$effect(() => {
		if (!def) return;
		for (const f of def.fields) {
			if (f.type === 'link' && f.linkTo && !linkTitles[f.key]) {
				void getLinkOptions(f.linkTo).then((opts) => {
					linkTitles[f.key] = Object.fromEntries(opts.map((o) => [o.id, o.title]));
				});
			}
		}
		if (def.fields.some((f) => f.type === 'user')) {
			void getMembers().then((ms) => {
				userNames = Object.fromEntries(ms.map((m) => [m.userId, m.name ?? m.email]));
			});
		}
	});

	function cell(f: EntityField, row: Record<string, unknown>) {
		const v = row[f.key];
		if (v == null || v === '') return '—';
		if (f.type === 'currency') return formatMoney(v as number);
		if (f.type === 'date') return formatDate(v as string);
		if (f.type === 'boolean') return v ? 'Yes' : 'No';
		if (f.type === 'link') return linkTitles[f.key]?.[v as string] ?? '…';
		if (f.type === 'user') return userNames[v as string] ?? '…';
		return String(v);
	}
</script>

<svelte:head>
	{#if def && recordQuery?.current}
		<title>{recordTitle(def, recordQuery.current)} — {def.label}</title>
	{/if}
</svelte:head>

{#if !def}
	<p class="p-8 text-sm text-muted-foreground">Unknown entity.</p>
{:else}
	{#await recordQuery}
		<p class="p-8 text-sm text-muted-foreground">Loading…</p>
	{:then record}
		{#if record}
			<div class="mx-auto max-w-3xl p-6 sm:p-10">
				<div class="mb-6 flex items-start justify-between gap-4">
					<div>
						<p class="text-xs tracking-wide text-muted-foreground uppercase">{def.label}</p>
						<h1 class="text-2xl font-semibold">{recordTitle(def, record)}</h1>
						<p class="mt-1 text-xs text-muted-foreground">
							Printed {formatDate(new Date().toISOString().slice(0, 10))}
						</p>
					</div>
					<Button class="print:hidden" variant="outline" size="sm" onclick={() => window.print()}
						><Printer class="size-4" /> Print</Button
					>
				</div>

				<table class="w-full border-collapse text-sm">
					<tbody>
						{#each def.fields as f (f.key)}
							<tr class="border-b">
								<th class="w-48 py-2 pr-4 text-left align-top font-medium text-muted-foreground"
									>{f.label}</th
								>
								<td class="py-2 whitespace-pre-wrap">{cell(f, record)}</td>
							</tr>
						{/each}
						{#if fieldsQuery?.current?.length}
							{#each fieldsQuery.current as cf (cf.id)}
								<tr class="border-b">
									<th class="w-48 py-2 pr-4 text-left align-top font-medium text-muted-foreground"
										>{cf.name}</th
									>
									<td class="py-2 whitespace-pre-wrap">
										{cf.type === 'checkbox'
											? cf.value === 'true'
												? 'Yes'
												: 'No'
											: (cf.value ?? '—')}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="p-8 text-sm text-muted-foreground">Record not found.</p>
		{/if}
	{:catch}
		<p class="p-8 text-sm text-muted-foreground">Sign in to print this record.</p>
	{/await}
{/if}

<style>
	@media print {
		@page {
			margin: 16mm;
		}
	}
</style>
