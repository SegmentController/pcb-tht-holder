<script lang="ts">
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/base/input/NumberInputBound.svelte';
	import AutoFocus from '$components/modal/util/AutoFocus.svelte';
	import type { PanelSettings } from '$types/PanelSettings';

	const dispatch = createEventDispatcher<{
		resolve: {
			trigger: 'custom';
			confirmed: boolean;
			panelSettings: PanelSettings;
			name: string;
			label: string;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			trigger: 'custom',
			confirmed,
			panelSettings,
			name,
			label
		});
	export let panelSettings: PanelSettings;
	export let name: string;
	export let label: string;
</script>

<Modal open={true} size="sm" bodyClass="space-y-0" dismissable={false} title="Project settings">
	<AutoFocus />
	<div class="flex flex-col">
		<div class="grid gap-6 grid-cols-2">
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
			<div class="col-span-2">
				<Label for="label" class="mb-2">Print label</Label>
				<Input id="label" bind:value={label} />
			</div>
		</div>
	</div>
	<div class="text-center mt-4 space-y-6">
		<Button on:click={() => resolve(true)} color="green" class="me-2">OK</Button>
		<Button on:click={() => resolve(false)} color="alternative" class="me-2">Cancel</Button>
	</div>
</Modal>
