<script lang="ts">
	/* Comment thread for a record — works for every registered entity. */
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { confirmDelete } from '#lib/components/ui/confirm-delete-dialog/index.js';
	import { formatRelative } from '#lib/format.ts';
	import { createComment, getRecordComments, removeComment } from '#lib/remote/comments.remote.ts';

	let { entity, recordId }: { entity: string; recordId: string } = $props();

	const commentsQuery = $derived(getRecordComments({ entity, id: recordId }));
	let body = $state('');
	let posting = $state(false);
	const isAdmin = $derived(page.data.role !== 'member');
	const myId = $derived(page.data.user?.id);

	async function post() {
		if (!body.trim() || posting) return;
		posting = true;
		try {
			await createComment({ entity, id: recordId, body });
			body = '';
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Post failed');
		} finally {
			posting = false;
		}
	}

	function remove(id: string) {
		confirmDelete({
			title: 'Delete this comment?',
			description: 'This cannot be undone.',
			onConfirm: async () => {
				try {
					await removeComment(id);
					await commentsQuery.refresh();
				} catch (err) {
					toast.error(
						(err as { body?: { message?: string } })?.body?.message ?? 'Could not delete'
					);
				}
			}
		});
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2 text-base"
			><MessageSquare class="size-4" /> Comments</Card.Title
		>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="space-y-2">
			<Textarea
				class="min-h-16 text-sm"
				placeholder="Write a comment…"
				bind:value={body}
				onkeydown={(e) => {
					if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void post();
				}}
			/>
			<div class="flex justify-end">
				<Button size="sm" onclick={post} disabled={posting || !body.trim()}
					>{posting ? 'Posting…' : 'Comment'}</Button
				>
			</div>
		</div>
		{#await commentsQuery then comments}
			{#if comments.length}
				<ul class="space-y-3">
					{#each comments as c (c.id)}
						<li class="group text-sm">
							<div class="flex items-baseline justify-between gap-2">
								<span class="font-medium">{c.authorName ?? 'Former member'}</span>
								<span class="flex items-center gap-1">
									<span class="text-xs text-muted-foreground">{formatRelative(c.createdAt)}</span>
									{#if isAdmin || c.authorId === myId}
										<Button
											size="icon-sm"
											variant="ghost"
											class="opacity-0 group-hover:opacity-100"
											aria-label="Delete comment"
											onclick={() => remove(c.id)}><Trash2 class="size-3.5" /></Button
										>
									{/if}
								</span>
							</div>
							<p class="mt-0.5 whitespace-pre-wrap text-muted-foreground">{c.body}</p>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">No comments yet.</p>
			{/if}
		{/await}
	</Card.Content>
</Card.Root>
