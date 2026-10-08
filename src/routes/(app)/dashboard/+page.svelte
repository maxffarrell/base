<script lang="ts">
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import PageHeader from '#lib/components/app/page-header.svelte';
	import { getEntityDef, listEntityDefs } from '#lib/entities.ts';
	import { formatRelative } from '#lib/format.ts';
	import '#lib/modules/index.ts';
	import { getAuditLog } from '#lib/remote/audit.remote.ts';
	import { listEntityRecords } from '#lib/remote/entities.remote.ts';
	import { getFavorites } from '#lib/remote/favorites.remote.ts';

	const defs = listEntityDefs();
	const org = $derived(page.data.org?.name ?? 'Workspace');
	const audit = $derived(await getAuditLog({}));

	/** First select field per def — used for the status breakdown bar on each card. */
	const groupFieldOf = (name: string) =>
		getEntityDef(name)?.fields.find((f) => f.type === 'select' && (f.options?.length ?? 0) > 1);

	async function breakdown(entity: string) {
		const gf = groupFieldOf(entity);
		if (!gf) return [];
		const { rows } = await listEntityRecords({ entity, limit: 500 });
		const counts: Record<string, number> = {};
		for (const r of rows) {
			const v = (r[gf.key] as string) || 'none';
			counts[v] = (counts[v] ?? 0) + 1;
		}
		return (gf.options ?? [])
			.map((o) => ({ key: o, count: counts[o] ?? 0 }))
			.concat([{ key: 'none', count: counts['none'] ?? 0 }])
			.filter((x) => x.count > 0);
	}

	const favorites = $derived(await getFavorites());
	const me = $derived(page.data.user?.id ?? '');
	/** Defs with a `user` field — each becomes an "Assigned to me" section. */
	const assignable = $derived(
		defs
			.map((d) => ({ def: d, field: d.fields.find((f) => f.type === 'user') }))
			.filter((x) => x.field)
	);

	async function myRecords(entity: string, field: string) {
		const { rows } = await listEntityRecords({
			entity,
			filters: { [field]: me },
			limit: 8
		});
		return rows;
	}
</script>

<PageHeader title="Dashboard" />

<div class="flex flex-col gap-4 p-4">
	<div>
		<h1 class="text-xl font-semibold">{org}</h1>
		<p class="text-sm text-muted-foreground">
			Your workspace entities. Everything below is generated from the entity registry — no
			per-entity pages exist.
		</p>
	</div>
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each defs as d (d.name)}
			{@const count = await listEntityRecords({ entity: d.name, limit: 1 }).then((r) => r.count)}
			<a href="/{d.name}">
				<Card.Root class="h-full transition-colors hover:bg-muted/50">
					<Card.Header class="flex-row items-center gap-3 space-y-0">
						{#if d.icon}
							<div
								class="flex size-9 items-center justify-center rounded-lg bg-muted [&_svg]:size-4"
							>
								<d.icon />
							</div>
						{/if}
						<div class="min-w-0">
							<Card.Title class="text-base">{d.labelPlural ?? `${d.label}s`}</Card.Title>
							<Card.Description class="truncate">{d.description}</Card.Description>
						</div>
					</Card.Header>
					<Card.Content>
						<p class="text-2xl font-semibold tabular-nums">{count}</p>
						{#if groupFieldOf(d.name)}
							{#await breakdown(d.name) then parts}
								{#if parts.length}
									<div class="mt-3 space-y-1">
										{#each parts as p (p.key)}
											<div class="flex items-center gap-2 text-xs">
												<span class="w-20 truncate text-muted-foreground">{p.key}</span>
												<div class="h-1.5 flex-1 rounded-full bg-muted">
													<div
														class="h-full rounded-full bg-primary"
														style="width: {count ? (p.count / count) * 100 : 0}%"
													></div>
												</div>
												<span class="w-6 text-right tabular-nums">{p.count}</span>
											</div>
										{/each}
									</div>
								{/if}
							{/await}
						{/if}
					</Card.Content>
				</Card.Root>
			</a>
		{/each}
	</div>

	{#if favorites.length}
		<Card.Root>
			<Card.Header><Card.Title class="text-base">Starred</Card.Title></Card.Header>
			<Card.Content>
				<ul class="divide-y">
					{#each favorites as f (f.entity + f.id)}
						<li class="flex items-baseline justify-between gap-3 py-2 text-sm">
							<a class="min-w-0 truncate font-medium hover:underline" href="/{f.entity}/{f.id}"
								>{f.title}</a
							>
							<span class="shrink-0 text-xs text-muted-foreground">{f.label}</span>
						</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		{#each assignable as { def: d, field } (d.name)}
			{#if field && me}
				{#await myRecords(d.name, field.key) then mine}
					{#if mine.length}
						<Card.Root>
							<Card.Header class="flex-row items-center justify-between space-y-0">
								<Card.Title class="text-base">My {d.labelPlural ?? `${d.label}s`}</Card.Title>
								<a
									class="text-xs text-muted-foreground hover:underline"
									href="/{d.name}?filter_{field.key}={me}">View all →</a
								>
							</Card.Header>
							<Card.Content>
								<ul class="divide-y">
									{#each mine as r (r.id)}
										<li>
											<a
												class="block truncate py-2 text-sm font-medium hover:underline"
												href="/{d.name}/{r.id}">{r[d.titleField ?? 'id'] ?? r.id}</a
											>
										</li>
									{/each}
								</ul>
							</Card.Content>
						</Card.Root>
					{/if}
				{/await}
			{/if}
		{/each}
	</div>

	{#if audit.rows.length}
		<Card.Root class="max-w-3xl">
			<Card.Header class="flex-row items-center justify-between space-y-0">
				<Card.Title class="text-base">Recent activity</Card.Title>
				<a href="/settings/audit" class="text-xs text-muted-foreground hover:underline"
					>Audit log →</a
				>
			</Card.Header>
			<Card.Content>
				<ul class="divide-y">
					{#each audit.rows.slice(0, 12) as a (a.id)}
						<li class="flex items-baseline justify-between gap-3 py-2 text-sm">
							<span class="min-w-0 truncate">
								<a class="font-medium hover:underline" href="/{a.entityType}/{a.entityId}"
									>{a.summary ?? a.action}</a
								>
								<span class="text-muted-foreground"> · {a.actorName ?? 'System'}</span>
							</span>
							<span class="shrink-0 text-xs text-muted-foreground"
								>{formatRelative(a.createdAt)}</span
							>
						</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
