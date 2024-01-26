<script lang="ts" context="module">
	export type CircleSettings = {
		radius: number;
		depth: number;
	};
</script>

<script lang="ts">
	import { Button, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/base/input/NumberInputBound.svelte';
	import AutoFocus from '$components/modal/util/AutoFocus.svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			trigger: 'custom';
			confirmed: boolean;
			settings: CircleSettings;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			trigger: 'custom',
			confirmed,
			settings
		});

	export let settings: CircleSettings;
</script>

<Modal open={true} size="sm" bodyClass="space-y-0" dismissable={false} title="Circle settings">
	<AutoFocus />
	<div class="flex flex-col">
		<div class="grid gap-6 md:grid-cols-2">
			<div>
				<Label for="radius" class="mb-2">Radius (mm)</Label>
				<NumberInputBound id="radius" min={0.5} max={99} bind:value={settings.radius} />
			</div>
			<div>
				<Label for="depth" class="mb-2">Depth (mm)</Label>
				<NumberInputBound id="depth" min={0.5} max={99} bind:value={settings.depth} />
			</div>
		</div>
	</div>
	<div class="text-center mt-4 space-y-6">
		<Button on:click={() => resolve(true)} color="green" class="me-2">OK</Button>
		<Button on:click={() => resolve(false)} color="alternative" class="me-2">Cancel</Button>
	</div>
</Modal>
