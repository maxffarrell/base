<script lang="ts">
	import { toast } from 'svelte-sonner';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import Download from '@lucide/svelte/icons/download';
	import { exportOrgData } from '#lib/remote/entities.remote.ts';

	let busy = $state(false);

	async function download() {
		busy = true;
		try {
			const data = await exportOrgData();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = `base-export-${data.exportedAt.slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(a.href);
		} catch (err) {
			toast.error((err as { body?: { message?: string } })?.body?.message ?? 'Export failed');
		} finally {
			busy = false;
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Workspace data</Card.Title>
		<Card.Description>
			Download every entity's records — live and archived — as one JSON file. Owners and admins
			only.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<Button onclick={download} disabled={busy}>
			<Download />
			{busy ? 'Exporting…' : 'Export all records'}
		</Button>
	</Card.Content>
</Card.Root>
