<script lang="ts" context="module">
	export type RectangleSettings = {
		width: number;
		height: number;
		depth: number;
	};
</script>

<script lang="ts">
	import { Button, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/NumberInputBound.svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			trigger: 'custom';
			confirmed: boolean;
			settings: RectangleSettings;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			trigger: 'custom',
			confirmed,
			settings
		});
	export let settings: RectangleSettings;
</script>

<Modal open={true} size="sm">
	<div class="flex flex-col space-y-6">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">Rectangle settings</h3>
		<div class="grid gap-6 mb-6 md:grid-cols-2">
			<div>
				<Label for="width" class="mb-2">Width (mm)</Label>
				<NumberInputBound id="width" min={0.5} max={99} bind:value={settings.width} />
			</div>
			<div>
				<Label for="height" class="mb-2">Height (mm)</Label>
				<NumberInputBound id="height" min={0.5} max={99} bind:value={settings.height} />
			</div>
			<div>
				<Label for="depth" class="mb-2">Depth (mm)</Label>
				<NumberInputBound id="depth" min={0.5} max={99} bind:value={settings.depth} />
			</div>
		</div>
	</div>
	<div class="text-center mt-4">
		<Button on:click={() => resolve(true)} color="green" class="me-2">OK</Button>
		<Button on:click={() => resolve(false)} color="alternative" class="me-2">Cancel</Button>
	</div>
</Modal>
