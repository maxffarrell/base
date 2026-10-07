<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '#lib/auth-client.ts';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { toast } from 'svelte-sonner';
	import GraduationCap from '@lucide/svelte/icons/graduation-cap';

	const user = $derived(page.data.user!);
	let name = $state(page.data.user!.name);
	let saving = $state(false);

	async function save(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		const { error } = await authClient.updateUser({ name });
		saving = false;
		if (error) return toast.error(error.message ?? 'Could not save');
		toast.success('Saved');
		await invalidateAll();
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Profile</Card.Title>
		<Card.Description>Your name and account email across this workspace.</Card.Description>
	</Card.Header>
	<Card.Content>
		<form class="flex items-end gap-3" onsubmit={save}>
			<Field.Field class="flex-1">
				<Field.Label for="profile-name">Name</Field.Label>
				<Input id="profile-name" bind:value={name} required />
			</Field.Field>
			<Field.Field class="flex-1">
				<Field.Label for="profile-email">Email</Field.Label>
				<Input id="profile-email" value={user.email} disabled />
			</Field.Field>
			<Button type="submit" disabled={saving || name === user.name}>Save</Button>
		</form>
	</Card.Content>
</Card.Root>
<Card.Root>
	<Card.Header>
		<Card.Title>Get familiar</Card.Title>
		<Card.Description>
			Take the guided tour of the interface again — it opens on the dashboard.
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<Button variant="outline" onclick={() => goto('/dashboard?tour=1')}
			><GraduationCap /> Replay the tour</Button
		>
	</Card.Content>
</Card.Root>
