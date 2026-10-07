<script lang="ts">
	import { page } from '$app/state';
	import EntityList from '#lib/components/app/entity-list.svelte';
	import { getEntityDef } from '#lib/entities.ts';
	import '#lib/modules/index.ts';

	const def = $derived(getEntityDef(page.params.entity ?? ''));
</script>

{#if def}
	{#if def.listComponent}
		<def.listComponent {def} />
	{:else}
		<EntityList {def} />
	{/if}
{:else}
	<div class="p-8 text-center text-sm text-muted-foreground">Unknown entity.</div>
{/if}
