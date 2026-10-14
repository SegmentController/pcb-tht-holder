<!--
  Demo Picker

  Row of ready-made demo projects shown under the dropzone while no project is loaded.
  Picking one calls `onSelect`; fetching and loading is up to the parent (AppDropzone).
-->
<script lang="ts">
	import { Button, Card } from 'flowbite-svelte';

	import { type Demo, DEMOS, demoUrl } from '$lib/demos';
	/*global __BASE_URL__*/
	const BASE_URL = __BASE_URL__;

	interface Properties {
		onSelect: (demo: Demo) => void;
		/** Id of the demo being fetched, disables the buttons meanwhile */
		loadingId?: string;
	}

	const { onSelect, loadingId = '' }: Properties = $props();
</script>

<section class="m-4 mt-2" aria-labelledby="demo-heading">
	<h2 id="demo-heading" class="mb-3 text-center text-lg font-semibold text-gray-700">
		No PCB at hand? Try a demo
	</h2>
	<div class="grid gap-4 sm:grid-cols-3">
		{#each DEMOS as demo (demo.id)}
			<Card class="max-w-none p-4 bg-white" color="gray">
				<img
					class="mb-3 h-40 w-full rounded bg-gray-100 object-contain"
					alt="Top view of the {demo.title} PCB"
					loading="lazy"
					src={demoUrl(BASE_URL, demo.thumbnail)}
				/>
				<h3 class="text-md font-bold tracking-tight text-gray-900">
					{demo.title}
					{#if demo.gerbers}
						<span
							class="ms-1 rounded-full bg-green-100 px-2 py-0.5 align-middle text-xs font-medium text-green-800"
							>Gerber</span
						>
					{/if}
				</h3>
				<p class="mb-1 text-sm text-gray-500">{demo.size}</p>
				<p class="mb-3 grow text-sm text-gray-700">{demo.description}</p>
				<p class="mb-3 text-xs text-gray-500">
					Design by
					{#if demo.sourceUrl}
						<a class="underline" href={demo.sourceUrl} rel="noopener noreferrer" target="_blank"
							>{demo.author}</a
						>
					{:else}
						{demo.author}
					{/if}{demo.licence ? `, ${demo.licence}` : ''}
				</p>
				{#if demo.gerbers}
					<p class="mb-3 text-xs text-gray-700">
						<strong>Try the drag and drop:</strong>
						<a class="underline" download href={demoUrl(BASE_URL, demo.gerbers)}>{demo.gerbers}</a>
						onto the dropzone above.
					</p>
				{/if}
				<Button
					aria-label="Load demo {demo.title}"
					disabled={!!loadingId}
					onclick={() => onSelect(demo)}
				>
					{loadingId === demo.id ? 'Loading…' : 'Load demo'}
				</Button>
			</Card>
		{/each}
	</div>
</section>
