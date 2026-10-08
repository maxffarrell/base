<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { page } from '$app/state';
	import { listEntityDefs } from '#lib/entities.ts';
	import { listEntityRecords } from '#lib/remote/entities.remote.ts';
	import { Button } from '#lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';
	import Copy from '@lucide/svelte/icons/copy';
	import '#lib/modules/index.ts';

	function curl(name: string) {
		return `curl -H "Authorization: Bearer $API_KEY" ${page.url.origin}/api/v1/${name}`;
	}

	const defs = listEntityDefs();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Entities</Card.Title>
		<Card.Description
			>Every entity registered in this workspace. Modules define these in code; the list, form, API
			and workflow UIs are all generated from them.</Card.Description
		>
	</Card.Header>
	<Card.Content class="px-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Entity</Table.Head>
					<Table.Head class="hidden md:table-cell">Fields</Table.Head>
					<Table.Head class="hidden sm:table-cell">Traits</Table.Head>
					<Table.Head class="hidden lg:table-cell">REST</Table.Head>
					<Table.Head class="text-right">Records</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each defs as d (d.name)}
					<Table.Row>
						<Table.Cell>
							<a href="/{d.name}" class="flex items-center gap-2 font-medium hover:underline">
								{#if d.icon}<d.icon class="size-4 text-muted-foreground" />{/if}
								<span>
									{d.labelPlural ?? `${d.label}s`}
									<span class="ml-1 font-mono text-xs text-muted-foreground">{d.name}</span>
								</span>
							</a>
							{#if d.description}
								<p class="mt-0.5 truncate text-xs text-muted-foreground">{d.description}</p>
							{/if}
						</Table.Cell>
						<Table.Cell class="hidden text-muted-foreground md:table-cell">
							{d.fields.length}
							{#if d.fields.some((f) => f.type === 'link')}
								· {d.fields.filter((f) => f.type === 'link').length} link{/if}
						</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">
							<div class="flex flex-wrap gap-1">
								{#if d.searchFields?.length}<Badge variant="secondary">search</Badge>{/if}
								{#if d.archivable}<Badge variant="secondary">archivable</Badge>{/if}
								{#if d.fields.some((f) => f.transitions)}<Badge variant="secondary"
										>state machine</Badge
									>{/if}
								{#if d.fields.some((f) => f.type === 'user')}<Badge variant="secondary"
										>assignable</Badge
									>{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="hidden lg:table-cell">
							<div class="flex items-center gap-1">
								<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
									>/api/v1/{d.name}</code
								>
								<Button
									size="icon-sm"
									variant="ghost"
									aria-label="Copy curl"
									onclick={() =>
										navigator.clipboard.writeText(curl(d.name)).then(() => toast.success('Copied'))}
									><Copy /></Button
								>
							</div>
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">
							{#await listEntityRecords({ entity: d.name, limit: 1 }) then r}
								{r.count}
							{/await}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>
