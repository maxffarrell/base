<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import X from '@lucide/svelte/icons/x';

	/** Chip editor for `tags` fields; Enter or comma commits a tag. */
	let {
		value = $bindable<string[]>([]),
		id,
		placeholder = 'Add tag'
	}: { value?: string[]; id?: string; placeholder?: string } = $props();

	let draft = $state('');

	function commit() {
		const t = draft.replace(/,+$/, '').trim();
		if (t && !value.includes(t)) value = [...value, t];
		draft = '';
	}
</script>

<div class="flex flex-col gap-1.5">
	{#if value.length}
		<div class="flex flex-wrap gap-1">
			{#each value as t (t)}
				<Badge variant="secondary" class="gap-1 pr-1">
					{t}
					<button
						type="button"
						class="rounded-sm hover:text-destructive"
						aria-label="Remove {t}"
						onclick={() => (value = value.filter((x) => x !== t))}><X class="size-3" /></button
					>
				</Badge>
			{/each}
		</div>
	{/if}
	<Input
		{id}
		{placeholder}
		bind:value={draft}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ',') {
				e.preventDefault();
				commit();
			} else if (e.key === 'Backspace' && !draft && value.length) {
				value = value.slice(0, -1);
			}
		}}
		onblur={commit}
	/>
</div>
