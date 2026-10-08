<script lang="ts" generics="T extends { id: string }">
	import type { Snippet } from 'svelte';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import { cn } from '#lib/utils.ts';

	let {
		columns,
		card,
		onmove
	}: {
		columns: { key: string; label: string; items: T[]; tone?: string }[];
		card: Snippet<[T]>;
		/** Called when a card is dropped on another column. Omit to disable dragging. */
		onmove?: (item: T, to: string) => void;
	} = $props();

	let dragging = $state<T | null>(null);
	let over = $state<string | null>(null);
</script>

<div class="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
	{#each columns as col (col.key)}
		<div
			class={cn(
				'flex min-h-40 flex-col rounded-lg border bg-muted/30',
				over === col.key && dragging && 'border-primary ring-1 ring-primary'
			)}
			role="list"
			ondragover={(e) => {
				if (!dragging) return;
				e.preventDefault();
				over = col.key;
			}}
			ondragleave={() => (over = null)}
			ondrop={(e) => {
				e.preventDefault();
				over = null;
				if (dragging) onmove?.(dragging, col.key);
				dragging = null;
			}}
		>
			<div class="flex items-center justify-between px-3 py-2">
				<h3 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
					{col.label}
				</h3>
				<span class="text-xs text-muted-foreground tabular-nums">{col.items.length}</span>
			</div>
			<ScrollArea class="flex-1">
				<div class="space-y-2 p-2 pt-0">
					{#each col.items as item (item.id)}
						<div
							role="listitem"
							draggable={onmove ? 'true' : undefined}
							ondragstart={(e) => {
								dragging = item;
								e.dataTransfer?.setData('text/plain', item.id);
								if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
							}}
							ondragend={() => {
								dragging = null;
								over = null;
							}}
							class={cn(onmove && 'cursor-grab', dragging === item && 'opacity-50')}
						>
							{@render card(item)}
						</div>
					{:else}
						<p class="px-2 py-4 text-center text-xs text-muted-foreground">Nothing here</p>
					{/each}
				</div>
			</ScrollArea>
		</div>
	{/each}
</div>
