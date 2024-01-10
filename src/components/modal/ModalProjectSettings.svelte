<script lang="ts">
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/NumberInputBound.svelte';
	import type { PanelSettings } from '$types/PanelSettings';

	const dispatch = createEventDispatcher<{
		resolve: {
			trigger: 'custom';
			confirmed: boolean;
			panelSettings: PanelSettings;
			name: string;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			trigger: 'custom',
			confirmed,
			panelSettings,
			name
		});
	export let panelSettings: PanelSettings;
	export let name: string;
</script>

<Modal open={true} size="sm" dismissable={false} title="Project settings">
	<div class="flex flex-col space-y-6">
		<div class="grid gap-6 mb-6 grid-cols-2">
			<div class="col-span-2">
				<Label for="name" class="mb-2">Project name</Label>
				<Input id="name" bind:value={name} />
			</div>
			<div>
				<Label for="width" class="mb-2">Panel width (mm)</Label>
				<NumberInputBound id="width" min={10} max={999} bind:value={panelSettings.width} />
			</div>
			<div>
				<Label for="height" class="mb-2">Panel height (mm)</Label>
				<NumberInputBound id="height" min={10} max={999} bind:value={panelSettings.height} />
			</div>
			<div>
				<Label for="pcbThickness" class="mb-2">PCB thickness (mm)</Label>
				<NumberInputBound
					id="pcbThickness"
					min={0.1}
					max={10}
					bind:value={panelSettings.pcbThickness}
				/>
			</div>
			<div>
				<Label for="smdHeight" class="mb-2">SMD height (mm)</Label>
				<NumberInputBound id="smdHeight" min={0.1} max={10} bind:value={panelSettings.smdHeight} />
			</div>
		</div>
	</div>
	<div class="text-center mt-4">
		<Button on:click={() => resolve(true)} color="green" class="me-2">OK</Button>
		<Button on:click={() => resolve(false)} color="alternative" class="me-2">Cancel</Button>
	</div>
</Modal>
