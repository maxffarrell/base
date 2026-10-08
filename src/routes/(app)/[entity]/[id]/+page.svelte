<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Printer from '@lucide/svelte/icons/printer';
	import Star from '@lucide/svelte/icons/star';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Modal from '#lib/components/ui/modal/index.js';
	import { aiSummarize, getAiStatus } from '#lib/remote/ai.remote.ts';
	import EntityForm from '#lib/components/app/entity-form.svelte';
	import PageHeader from '#lib/components/app/page-header.svelte';
	import RecordAttachments from '#lib/components/app/record-attachments.svelte';
	import RecordComments from '#lib/components/app/record-comments.svelte';
	import RecordFields from '#lib/components/app/record-fields.svelte';
	import { confirmDelete } from '#lib/components/ui/confirm-delete-dialog/index.js';
	import { getEntityDef, recordTitle } from '#lib/entities.ts';
	import { formatDate, formatRelative } from '#lib/format.ts';
	import '#lib/modules/index.ts';
	import {
		deleteEntityRecord,
		getEntityRecord,
		getRecordActivity,
		getRelatedRecords,
		setEntityArchived
	} from '#lib/remote/entities.remote.ts';
	import { isFavorite, toggleFavorite } from '#lib/remote/favorites.remote.ts';
	import { getShares, shareEntityRecord, unshareEntityRecord } from '#lib/remote/shares.remote.ts';
	import { getMembers } from '#lib/remote/workspace.remote.ts';
	import * as NativeSelect from '#lib/components/ui/native-select/index.js';
	import { pushRecent } from '#lib/recents.ts';

	const def = $derived(getEntityDef(page.params.entity ?? ''));
	const id = $derived(page.params.id ?? '');
	const recordQuery = $derived(def ? getEntityRecord({ entity: def.name, id }) : null);
	const activityQuery = $derived(def ? getRecordActivity({ entity: def.name, id }) : null);
	const relatedQuery = $derived(def ? getRelatedRecords({ entity: def.name, id }) : null);
	const aiStatus = $derived(await getAiStatus());
	const favQuery = $derived(def ? isFavorite({ entity: def.name, id }) : null);
	let aiSummary = $state<string | null>(null);
	let aiBusy = $state(false);
	let showDup = $state(false);
	let showShare = $state(false);
	const sharesQuery = $derived(def ? getShares({ entity: def.name, id }) : null);
	const members = $derived(await getMembers());
	let shareTarget = $state('');
	const meId = $derived(page.data.user?.id ?? '');
	const canWrite = $derived(!def?.adminOnly || page.data.role !== 'member');
	const shareableMembers = $derived(
		members.filter(
			(m) => m.userId !== meId && !sharesQuery?.current?.some((s) => s.toUserId === m.userId)
		)
	);

	$effect(() => {
		const r = recordQuery?.current;
		if (def && r)
			pushRecent({ entity: def.name, label: def.label, id, title: recordTitle(def, r) });
	});

	/** Pre-fill the create form from this record — no id, so it creates a copy. */
	const dupSeed = $derived.by(() => {
		const r = recordQuery?.current;
		if (!def || !r) return null;
		const copy: Record<string, unknown> = { ...r };
		delete copy.id;
		delete copy.createdAt;
		delete copy.updatedAt;
		if (def.titleField && typeof copy[def.titleField] === 'string')
			copy[def.titleField] = `${copy[def.titleField]} (copy)`;
		return copy;
	});

	async function toggleArchive(record: Record<string, unknown>) {
		if (!def) return;
		try {
			await setEntityArchived({ entity: def.name, id, archived: !record.archivedAt });
			toast.success(record.archivedAt ? `${def.label} restored` : `${def.label} archived`);
			await recordQuery?.refresh();
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Failed');
		}
	}

	async function summarize() {
		if (!def || aiBusy) return;
		aiBusy = true;
		aiSummary = '';
		try {
			aiSummary = await aiSummarize({ entity: def.name, id });
		} catch (err) {
			aiSummary = null;
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'AI summary failed');
		} finally {
			aiBusy = false;
		}
	}

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
					<Button
						variant="ghost"
						size="sm"
						aria-label="Toggle star"
						onclick={async () => {
							const res = await toggleFavorite({ entity: def.name, id });
							toast.success(res.favorited ? 'Starred' : 'Unstarred');
						}}
					>
						<Star class={favQuery?.current ? 'fill-amber-400 text-amber-400' : ''} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						aria-label="Copy link"
						onclick={() => {
							void navigator.clipboard.writeText(page.url.href);
							toast.success('Link copied');
						}}
					>
						<Link2 />
					</Button>
					<Button variant="ghost" size="sm" aria-label="Share" onclick={() => (showShare = true)}>
						<Share2 />
					</Button>
					{#if def.archivable && canWrite}
						<Button variant="outline" size="sm" onclick={() => toggleArchive(record)}>
							{#if record.archivedAt}<ArchiveRestore /> Restore{:else}<Archive /> Archive{/if}
						</Button>
					{/if}
					{#if aiStatus.licensed && aiStatus.configured}
						<Button variant="outline" size="sm" onclick={summarize} disabled={aiBusy}
							><Sparkles class="size-4" /> {aiBusy ? 'Summarizing…' : 'Summarize'}</Button
						>
					{/if}
					<Button variant="outline" size="sm" href={`/print/${def.name}/${id}`} target="_blank"
						><Printer /> Print</Button
					>
					{#if canWrite}
						<Button variant="outline" size="sm" onclick={() => (showDup = true)}
							><Copy /> Duplicate</Button
						>
						<Button variant="destructive" size="sm" onclick={remove}><Trash2 /> Delete</Button>
					{/if}
				{/if}
			{/snippet}
		</PageHeader>

		{#if record}
			{#if record.archivedAt}
				<div class="border-b bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
					This {def.label.toLowerCase()} is archived — it is hidden from lists until restored.
				</div>
			{/if}
			<div class="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
				<div class="space-y-4">
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
					<RecordComments entity={def.name} recordId={id} />
				</div>
				<div class="space-y-4">
					<RecordFields entity={def.name} recordId={id} />
					<RecordAttachments entity={def.name} recordId={id} />
					{#await relatedQuery then related}
						{#if related && related.length}
							<Card.Root>
								<Card.Header><Card.Title class="text-base">Related</Card.Title></Card.Header>
								<Card.Content class="space-y-3">
									{#each related as section (section.entity)}
										<div>
											<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
												{section.label}
											</p>
											<ul class="mt-1 space-y-1">
												{#each section.rows as row (row.id)}
													<li>
														<a
															class="block truncate text-sm hover:underline"
															href="/{section.entity}/{row.id}">{row.title}</a
														>
													</li>
												{/each}
											</ul>
											{#if section.count > section.rows.length}
												<a
													class="mt-1 inline-block text-xs text-muted-foreground hover:underline"
													href="/{section.entity}?filter_{section.field}={id}"
													>View all {section.count} →</a
												>
											{/if}
										</div>
									{/each}
								</Card.Content>
							</Card.Root>
						{/if}
					{/await}
					{#await activityQuery then activity}
						{#if activity && activity.rows.length}
							<Card.Root>
								<Card.Header><Card.Title class="text-base">Activity</Card.Title></Card.Header>
								<Card.Content>
									<ul class="space-y-3">
										{#each activity.rows as a (a.id)}
											<li class="text-sm">
												<p class="leading-snug">{a.summary ?? a.action}</p>
												<p class="mt-0.5 text-xs text-muted-foreground">
													{a.actorName ?? 'System'} · {formatRelative(a.createdAt)}
												</p>
											</li>
										{/each}
									</ul>
								</Card.Content>
							</Card.Root>
						{/if}
					{/await}
				</div>
			</div>
		{:else}
			<div class="p-8 text-center text-sm text-muted-foreground">Record not found.</div>
		{/if}
	{/await}
{:else}
	<div class="p-8 text-center text-sm text-muted-foreground">Unknown entity.</div>
{/if}

<Modal.Root bind:open={showDup}>
	<Modal.Content class="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
		<Modal.Header>
			<Modal.Title>Duplicate {def?.label ?? 'record'}</Modal.Title>
		</Modal.Header>
		{#if def && dupSeed}
			<EntityForm
				{def}
				record={dupSeed}
				onsaved={(r) => {
					showDup = false;
					goto(`/${def.name}/${r.id}`);
				}}
			/>
		{/if}
	</Modal.Content>
</Modal.Root>

<Modal.Root bind:open={showShare}>
	<Modal.Content class="sm:max-w-md">
		<Modal.Header>
			<Modal.Title>Share {def?.label ?? 'record'}</Modal.Title>
			<Modal.Description
				>Shared members get an inbox notice and see it under “Shared with me”.</Modal.Description
			>
		</Modal.Header>
		<div class="space-y-3">
			{#if shareableMembers.length}
				<div class="flex gap-2">
					<NativeSelect.Root
						class="h-9 flex-1"
						value={shareTarget}
						onchange={(e) => (shareTarget = (e.target as HTMLSelectElement).value)}
					>
						<NativeSelect.Option value="">Pick a member…</NativeSelect.Option>
						{#each shareableMembers as m (m.userId)}
							<NativeSelect.Option value={m.userId}>{m.name ?? m.email}</NativeSelect.Option>
						{/each}
					</NativeSelect.Root>
					<Button
						size="sm"
						disabled={!shareTarget}
						onclick={async () => {
							if (!def || !shareTarget) return;
							await shareEntityRecord({ entity: def.name, id, toUserId: shareTarget });
							shareTarget = '';
							toast.success('Shared');
						}}>Share</Button
					>
				</div>
			{/if}
			{#if sharesQuery?.current?.length}
				<ul class="divide-y">
					{#each members.filter( (m) => sharesQuery.current?.some((s) => s.toUserId === m.userId) ) as m (m.userId)}
						<li class="flex items-center justify-between py-2 text-sm">
							<span class="min-w-0 truncate">{m.name ?? m.email}</span>
							<Button
								variant="ghost"
								size="sm"
								onclick={async () => {
									if (!def) return;
									await unshareEntityRecord({ entity: def.name, id, toUserId: m.userId });
								}}>Remove</Button
							>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">Not shared with anyone yet.</p>
			{/if}
		</div>
	</Modal.Content>
</Modal.Root>

<Modal.Root open={aiSummary !== null} onOpenChange={(v) => !v && (aiSummary = null)}>
	<Modal.Content class="sm:max-w-lg">
		<Modal.Header>
			<Modal.Title class="flex items-center gap-2"
				><Sparkles class="size-4" /> AI summary</Modal.Title
			>
		</Modal.Header>
		{#if aiBusy || aiSummary === ''}
			<p class="text-sm text-muted-foreground">Summarizing…</p>
		{:else}
			<p class="text-sm leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
		{/if}
	</Modal.Content>
</Modal.Root>
