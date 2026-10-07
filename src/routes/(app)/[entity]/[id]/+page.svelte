<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import EntityForm from '#lib/components/app/entity-form.svelte';
	import PageHeader from '#lib/components/app/page-header.svelte';
	import RecordFields from '#lib/components/app/record-fields.svelte';
	import { confirmDelete } from '#lib/components/ui/confirm-delete-dialog/index.js';
	import { getEntityDef, recordTitle } from '#lib/entities.ts';
	import { formatDate } from '#lib/format.ts';
	import '#lib/modules/index.ts';
	import { deleteEntityRecord, getEntityRecord } from '#lib/remote/entities.remote.ts';

	const def = $derived(getEntityDef(page.params.entity ?? ''));
	const id = $derived(page.params.id ?? '');
	const recordQuery = $derived(def ? getEntityRecord({ entity: def.name, id }) : null);

	function remove() {
		if (!def) return;
		confirmDelete({
			title: `Delete this ${def.label.toLowerCase()}?`,
			description: 'This cannot be undone.',
			onConfirm: async () => {
				try {
					await deleteEntityRecord({ entity: def.name, id });
					toast.success(`${def.label} deleted`);
					goto(`/${def.name}`);
				} catch (err) {
					toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Delete failed');
				}
			}
		});
	}
</script>

{#if def}
	{#await recordQuery then record}
		<PageHeader
			title={record ? recordTitle(def, record) : 'Not found'}
			crumbs={[
				{ label: 'Home', href: '/' },
				{ label: def.labelPlural ?? `${def.label}s`, href: `/${def.name}` }
			]}
		>
			{#snippet actions()}
				<Button variant="ghost" size="sm" href={`/${def.name}`}><ArrowLeft /> Back</Button>
				{#if record}
					<Button variant="destructive" size="sm" onclick={remove}><Trash2 /> Delete</Button>
				{/if}
			{/snippet}
		</PageHeader>

		{#if record}
			<div class="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
				<Card.Root>
					<Card.Header>
						<Card.Title>Details</Card.Title>
						<Card.Description class="text-xs"
							>Created {formatDate(record.createdAt as string)} · Updated {formatDate(
								record.updatedAt as string
							)}</Card.Description
						>
					</Card.Header>
					<Card.Content>
						{#if def.formComponent}
							<def.formComponent {def} {record} onsaved={() => recordQuery?.refresh()} />
						{:else}
							<EntityForm {def} {record} onsaved={() => recordQuery?.refresh()} />
						{/if}
					</Card.Content>
				</Card.Root>
				<RecordFields entity={def.name} recordId={id} />
			</div>
		{:else}
			<div class="p-8 text-center text-sm text-muted-foreground">Record not found.</div>
		{/if}
	{/await}
{:else}
	<div class="p-8 text-center text-sm text-muted-foreground">Unknown entity.</div>
{/if}
