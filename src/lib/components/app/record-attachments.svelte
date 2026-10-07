<script lang="ts">
	/* Per-record attachments: uploads are tagged {entityType, entityId} on the
	 * document row, so every registered entity gets a files panel for free. */
	import { toast } from 'svelte-sonner';
	import FileIcon from '@lucide/svelte/icons/file';
	import FileImage from '@lucide/svelte/icons/file-image';
	import FileText from '@lucide/svelte/icons/file-text';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as FileDropZone from '#lib/components/ui/file-drop-zone/index.js';
	import { confirmDelete } from '#lib/components/ui/confirm-delete-dialog/index.js';
	import { formatRelative } from '#lib/format.ts';
	import { deleteDocument, getRecordDocuments } from '#lib/remote/documents.remote.ts';

	let { entity, recordId }: { entity: string; recordId: string } = $props();

	const docsQuery = $derived(getRecordDocuments({ entity, id: recordId }));
	let uploading = $state(false);
	const inputId = $derived(`rec-att-${entity}-${recordId}`.replace(/[^a-zA-Z0-9_-]/g, ''));

	const size = (n: number) =>
		n < 1024
			? `${n} B`
			: n < 1048576
				? `${(n / 1024).toFixed(0)} KB`
				: `${(n / 1048576).toFixed(1)} MB`;
	const icon = (type: string) =>
		type.startsWith('image/')
			? FileImage
			: type === 'application/pdf' || type.startsWith('text/')
				? FileText
				: FileIcon;

	async function upload(files: File[]) {
		if (!files.length) return;
		uploading = true;
		const body = new FormData();
		for (const f of files) body.append('file', f);
		body.append('entityType', entity);
		body.append('entityId', recordId);
		const res = await fetch('/api/documents', { method: 'POST', body });
		uploading = false;
		if (!res.ok) {
			toast.error((await res.json().catch(() => null))?.message ?? 'Upload failed');
			return;
		}
		toast.success(files.length === 1 ? 'File attached' : `${files.length} files attached`);
		await docsQuery.refresh();
	}

	function remove(id: string, name: string) {
		confirmDelete({
			title: `Delete ${name}?`,
			description: 'This file is permanently removed from the workspace.',
			onConfirm: async () => {
				await deleteDocument(id).catch(() => toast.error('Could not delete'));
				await docsQuery.refresh();
			}
		});
	}
</script>

{#await docsQuery then docs}
	<Card.Root>
		<Card.Header class="flex-row items-center justify-between space-y-0">
			<Card.Title class="flex items-center gap-2 text-base"
				><Paperclip class="size-4" /> Attachments</Card.Title
			>
			<Button
				size="sm"
				variant="outline"
				disabled={uploading}
				onclick={() => document.getElementById(inputId)?.click()}
				><Upload /> {uploading ? 'Uploading…' : 'Attach'}</Button
			>
		</Card.Header>
		<Card.Content>
			<FileDropZone.Root
				id={inputId}
				maxFileSize={10 * FileDropZone.MEGABYTE}
				onUpload={upload}
				onFileRejected={(e) => toast.error(`${e.file.name}: ${e.reason}`)}
			>
				{#if !docs.length}
					<FileDropZone.Trigger>
						<div
							class="flex w-full flex-col items-center gap-1 rounded-md border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/40"
						>
							<Upload class="size-5 text-muted-foreground" />
							<span class="text-sm font-medium">Drop files here</span>
							<span class="text-xs text-muted-foreground">or click to browse — up to 10 MB</span>
						</div>
					</FileDropZone.Trigger>
				{:else}
					<ul class="space-y-1.5">
						{#each docs as d (d.id)}
							{@const Icon = icon(d.contentType)}
							<li class="flex items-center gap-2 text-sm">
								<a
									class="flex min-w-0 flex-1 items-center gap-2 font-medium hover:underline"
									href="/api/documents/{d.id}"
									target="_blank"
									rel="noopener"
								>
									<Icon class="size-4 shrink-0 text-muted-foreground" />
									<span class="truncate">{d.name}</span>
								</a>
								<span class="shrink-0 text-xs text-muted-foreground tabular-nums"
									>{size(d.size)}</span
								>
								<span class="hidden shrink-0 text-xs text-muted-foreground sm:inline"
									>{formatRelative(d.createdAt)}</span
								>
								<Button
									size="icon-sm"
									variant="ghost"
									aria-label="Delete {d.name}"
									onclick={() => remove(d.id, d.name)}><Trash2 /></Button
								>
							</li>
						{/each}
					</ul>
					<FileDropZone.Trigger>
						<p class="mt-3 text-center text-xs text-muted-foreground">
							Drop more files anywhere on this card
						</p>
					</FileDropZone.Trigger>
				{/if}
			</FileDropZone.Root>
		</Card.Content>
	</Card.Root>
{/await}
