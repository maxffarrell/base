<script lang="ts">
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { getAiStatus } from '#lib/remote/ai.remote.ts';
	import Sparkles from '@lucide/svelte/icons/sparkles';

	const status = $derived(await getAiStatus());

	const features = [
		{
			name: 'Record summaries',
			detail:
				'A one-paragraph brief on any record — what it is, what stands out, what to follow up. On every record page.'
		},
		{
			name: 'Draft from text',
			detail:
				'Describe a record in words ("Jane at Acme, lead, jane@acme.com") and the form prefills from your field definitions.'
		},
		{
			name: 'Ask your data',
			detail:
				'Natural-language questions over an entity’s records — answered from the data, inside the app.'
		}
	];
</script>

{#if !status.licensed}
	<Alert.Root>
		<Alert.Title>Enterprise feature</Alert.Title>
		<Alert.Description>
			AI features are included in Base Cloud and available on self-hosted installs with an
			Enterprise license key (<code>BASE_ENTERPRISE_KEY</code>).
		</Alert.Description>
	</Alert.Root>
{/if}

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2"><Sparkles class="size-4" /> AI provider</Card.Title>
		<Card.Description>
			Base never ships a model or key — point it at any OpenAI-compatible endpoint (OpenAI, Ollama,
			vLLM, a gateway) or Anthropic. The key stays server-side.
		</Card.Description>
	</Card.Header>
	<Card.Content class="space-y-3">
		<div class="flex items-center gap-2 text-sm">
			Status:
			{#if status.configured}
				<Badge class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
					Connected · {status.provider}{status.model ? ` · ${status.model}` : ''}
				</Badge>
			{:else}
				<Badge variant="secondary">Not configured</Badge>
			{/if}
		</div>
		{#if !status.configured}
			<div class="rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
				AI_PROVIDER=openai <span class="text-muted-foreground"># or anthropic</span><br />
				AI_API_KEY=…<br />
				AI_MODEL=gpt-4o-mini <span class="text-muted-foreground"># or claude-haiku-4-5</span><br />
				AI_BASE_URL=
				<span class="text-muted-foreground"># optional, e.g. http://localhost:11434/v1</span>
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root>
	<Card.Header>
		<Card.Title>What you get</Card.Title>
		<Card.Description
			>Each feature works on every entity — no per-entity configuration.</Card.Description
		>
	</Card.Header>
	<Card.Content>
		<ul class="divide-y text-sm">
			{#each features as f (f.name)}
				<li class="py-3 first:pt-0 last:pb-0">
					<p class="font-medium">{f.name}</p>
					<p class="mt-0.5 text-muted-foreground">{f.detail}</p>
				</li>
			{/each}
		</ul>
	</Card.Content>
</Card.Root>
