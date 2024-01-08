<script lang="ts">
	import { Modal } from '@svelte-put/modal';
	import { Button, Card, Label } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/NumberInputBound.svelte';
	import type { PanelSettings } from '$types/PanelSettings';

	const dispatch = createEventDispatcher<{
		resolve: {
			trigger: 'custom';
			confirmed: boolean;
			settings: PanelSettings;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			trigger: 'custom',
			confirmed,
			settings
		});
	export let settings: PanelSettings;
</script>

<Modal>
	<Card>
		<div class="flex flex-col space-y-6">
			<h3 class="text-xl font-medium text-gray-900 dark:text-white">PCB settings</h3>
			<div class="grid gap-6 mb-6 md:grid-cols-2">
				<div>
					<Label for="width" class="mb-2">Panel width (mm)</Label>
					<NumberInputBound id="width" min={10} max={999} bind:value={settings.width} />
				</div>
				<div>
					<Label for="height" class="mb-2">Panel height (mm)</Label>
					<NumberInputBound id="height" min={10} max={999} bind:value={settings.height} />
				</div>
				<div>
					<Label for="pcbThickness" class="mb-2">PCB thickness (mm)</Label>
					<NumberInputBound
						id="pcbThickness"
						min={0.1}
						max={10}
						bind:value={settings.pcbThickness}
					/>
				</div>
				<div>
					<Label for="smdHeight" class="mb-2">SMD height (mm)</Label>
					<NumberInputBound id="smdHeight" min={0.1} max={10} bind:value={settings.smdHeight} />
				</div>
			</div>
		</div>
		<div class="text-center mt-4">
			<Button on:click={() => resolve(true)} color="green" class="me-2">OK</Button>
			<Button on:click={() => resolve(false)} color="alternative" class="me-2">Cancel</Button>
		</div>
	</Card>
</Modal>
