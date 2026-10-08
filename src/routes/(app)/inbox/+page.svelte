<script lang="ts">
	import { goto } from '$app/navigation';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import PageHeader from '#lib/components/app/page-header.svelte';
	import { getInboxPage, markInboxRead } from '#lib/remote/notifications.remote.ts';
	import { formatRelative } from '#lib/format.ts';
	import { cn } from '#lib/utils.js';
	import { getEntityDef } from '#lib/entities.ts';
	import '#lib/modules/index.ts';
	import InboxIcon from '@lucide/svelte/icons/inbox';

	const inbox = $derived(await getInboxPage());
	let unreadOnly = $state(false);
	let entityFilter = $state('');
	const entityOf = (href?: string | null) => href?.split('/').filter(Boolean)[0] ?? '';
	const kinds = $derived([...new Set(inbox.items.map((n) => entityOf(n.href)).filter(Boolean))]);
	const items = $derived(
		inbox.items.filter(
			(n) => (!unreadOnly || !n.readAt) && (!entityFilter || entityOf(n.href) === entityFilter)
		)
	);

	async function read(id: string, href?: string | null) {
		await markInboxRead({ ids: [id] });
		if (href) goto(href);
	}

	async function markAll() {
		await markInboxRead({ ids: [], all: true });
	}
</script>

<PageHeader title="Inbox" />

<div class="flex flex-col gap-3 p-4">
	<div class="flex items-center justify-between gap-2">
		<label class="flex items-center gap-2 text-sm text-muted-foreground">
			<input type="checkbox" bind:checked={unreadOnly} class="size-4 accent-primary" />
			Unread only
		</label>
		{#if inbox.unread}
			<Button variant="outline" size="sm" onclick={markAll}>
				<CheckCheck class="size-4" /> Mark all read
			</Button>
		{/if}
	</div>
	{#if kinds.length > 1}
		<div class="flex flex-wrap gap-1.5">
			<Button
				size="sm"
				variant={entityFilter === '' ? 'default' : 'outline'}
				onclick={() => (entityFilter = '')}>All</Button
			>
			{#each kinds as k (k)}
				<Button
					size="sm"
					variant={entityFilter === k ? 'default' : 'outline'}
					onclick={() => (entityFilter = k)}>{getEntityDef(k)?.labelPlural ?? k}</Button
				>
			{/each}
		</div>
	{/if}
	{#if inbox.items.length === 0}
		<Empty.Root class="border">
			<Empty.Header>
				<Empty.Media variant="icon"><InboxIcon /></Empty.Media>
				<Empty.Title>All caught up</Empty.Title>
				<Empty.Description
					>Notifications from record events, assignments, and workflows land here.</Empty.Description
				>
			</Empty.Header>
		</Empty.Root>
	{:else}
		{#if items.length === 0}
			<p class="py-8 text-center text-sm text-muted-foreground">No unread notifications.</p>
		{:else}
			<ul class="divide-y rounded-lg border">
				{#each items as n (n.id)}
					<li>
						<button
							class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
							onclick={() => read(n.id, n.href)}
						>
							<span
								class={cn(
									'mt-1.5 size-2 shrink-0 rounded-full',
									n.readAt ? 'bg-transparent' : 'bg-primary'
								)}
							></span>
							<span class="min-w-0 flex-1">
								<span
									class={cn('block text-sm', n.readAt ? 'text-muted-foreground' : 'font-medium')}
									>{n.title}</span
								>
								{#if n.body}
									<span class="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
								{/if}
								<span class="mt-1 block text-[11px] text-muted-foreground/70"
									>{formatRelative(n.createdAt)} · {n.kind}</span
								>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
