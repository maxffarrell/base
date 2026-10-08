<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { listEntityDefs } from '#lib/entities.ts';
	import { listEntityRecords } from '#lib/remote/entities.remote.ts';
	import '#lib/modules/index.ts';

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
