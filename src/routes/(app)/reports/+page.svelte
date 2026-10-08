<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as NativeSelect from '#lib/components/ui/native-select/index.js';
	import PageHeader from '#lib/components/app/page-header.svelte';
	import { listEntityDefs } from '#lib/entities.ts';
	import { formatMoney } from '#lib/format.ts';
	import { getEntityReport, getLinkOptions } from '#lib/remote/entities.remote.ts';
	import { getMembers } from '#lib/remote/workspace.remote.ts';
	import '#lib/modules/index.ts';

	const defs = listEntityDefs();
	const groupable = (d: (typeof defs)[number]) =>
		d.fields.filter(
			(f) => f.type === 'select' || f.type === 'boolean' || f.type === 'link' || f.type === 'user'
		);
	const summable = (d: (typeof defs)[number]) =>
		d.fields.filter((f) => f.type === 'currency' || f.type === 'number');

	let entity = $state(page.url.searchParams.get('entity') ?? defs[0]?.name ?? '');
	let groupBy = $state(page.url.searchParams.get('groupBy') ?? '');
	let sumField = $state(page.url.searchParams.get('sum') ?? '');

	const def = $derived(defs.find((d) => d.name === entity));
	const groupFields = $derived(def ? groupable(def) : []);
	const sumFields = $derived(def ? summable(def) : []);

	$effect(() => {
		if (def && !groupFields.some((f) => f.key === groupBy)) groupBy = groupFields[0]?.key ?? '';
		if (sumField && !sumFields.some((f) => f.key === sumField)) sumField = '';
	});

	// Resolve link/user group keys to display titles.
	let titles = $state<Record<string, string>>({});
	let userNames = $state<Record<string, string>>({});
	$effect(() => {
		const gf = groupFields.find((f) => f.key === groupBy);
		titles = {};
		if (gf?.type === 'link' && gf.linkTo)
			void getLinkOptions(gf.linkTo).then(
				(opts) => (titles = Object.fromEntries(opts.map((o) => [o.id, o.title])))
			);
		else if (gf?.type === 'user')
			void getMembers().then(
				(ms) => (userNames = Object.fromEntries(ms.map((m) => [m.userId, m.name ?? m.email])))
			);
	});
	const label = (key: string) => {
		const gf = groupFields.find((f) => f.key === groupBy);
		if (!key) return '—';
		if (gf?.type === 'boolean') return key === 'true' ? 'Yes' : 'No';
		if (gf?.type === 'link') return titles[key] ?? key;
		if (gf?.type === 'user') return userNames[key] ?? key;
		return key;
	};

	const report = $derived(
		entity && groupBy ? getEntityReport({ entity, groupBy, sumField: sumField || undefined }) : null
	);
	const maxCount = (rows: { count: number }[]) => Math.max(1, ...rows.map((r) => r.count));
	const isCurrency = $derived(sumFields.find((f) => f.key === sumField)?.type === 'currency');
</script>

<PageHeader title="Reports" />

<div class="flex flex-col gap-4 p-4">
	<Card.Root>
		<Card.Header>
			<Card.Title>Group-by report</Card.Title>
			<Card.Description>
				Aggregate any entity by a field — pick an optional numeric column to sum.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex flex-wrap gap-2">
				<NativeSelect.Root
					class="h-9 w-44"
					value={entity}
					onchange={(e) => (entity = (e.target as HTMLSelectElement).value)}
				>
					{#each defs as d (d.name)}<NativeSelect.Option value={d.name}
							>{d.labelPlural ?? `${d.label}s`}</NativeSelect.Option
						>{/each}
				</NativeSelect.Root>
				<NativeSelect.Root
					class="h-9 w-44"
					value={groupBy}
					onchange={(e) => (groupBy = (e.target as HTMLSelectElement).value)}
				>
					{#each groupFields as f (f.key)}<NativeSelect.Option value={f.key}
							>By {f.label}</NativeSelect.Option
						>{/each}
				</NativeSelect.Root>
				<NativeSelect.Root
					class="h-9 w-44"
					value={sumField}
					onchange={(e) => (sumField = (e.target as HTMLSelectElement).value)}
				>
					<NativeSelect.Option value="">Count only</NativeSelect.Option>
					{#each sumFields as f (f.key)}<NativeSelect.Option value={f.key}
							>Sum {f.label}</NativeSelect.Option
						>{/each}
				</NativeSelect.Root>
			</div>

			{#if report}
				{#await report then rows}
					{#if rows.length === 0}
						<p class="text-sm text-muted-foreground">No records to report on.</p>
					{:else}
						<div class="space-y-1.5">
							{#each rows as r (r.key)}
								<button
									class="flex w-full items-center gap-3 text-left text-sm"
									onclick={() => goto(`/${entity}?filter_${groupBy}=${r.key}`)}
								>
									<span class="w-40 truncate">{label(r.key)}</span>
									<div class="h-5 flex-1 rounded bg-muted">
										<div
											class="h-full rounded bg-primary/80"
											style="width: {(r.count / maxCount(rows)) * 100}%"
										></div>
									</div>
									<span class="w-12 text-right tabular-nums">{r.count}</span>
									{#if sumField}
										<span class="w-24 text-right text-muted-foreground tabular-nums"
											>{isCurrency ? formatMoney(r.sum) : r.sum}</span
										>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				{/await}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
