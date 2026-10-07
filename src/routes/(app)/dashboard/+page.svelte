<script lang="ts">
	import { page } from '$app/state';
	import * as Card from '#lib/components/ui/card/index.js';
	import PageHeader from '#lib/components/app/page-header.svelte';
	import { listEntityDefs } from '#lib/entities.ts';
	import '#lib/modules/index.ts';
	import { listEntityRecords } from '#lib/remote/entities.remote.ts';

	const defs = listEntityDefs();
	const org = $derived(page.data.org?.name ?? 'Workspace');
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
					</Card.Content>
				</Card.Root>
			</a>
		{/each}
	</div>
</div>
