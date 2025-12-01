<script lang="ts">
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/base/input/NumberInputBound.svelte';
	import AutoFocus from '$components/modal/util/AutoFocus.svelte';
	import EscapeClose from '$components/modal/util/EscapeClose.svelte';
	import type { PanelSettings } from '$types/PanelSettings';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
			panelSettings: PanelSettings;
			name: string;
			label: string;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			confirmed,
			panelSettings,
			name,
			label
		});
	export let panelSettings: PanelSettings;
	export let name: string;
	export let label: string;
</script>

<EscapeClose on:escape={() => resolve(false)}>
	<Modal dismissable={false} open={true} size="sm" title="Project settings">
		<AutoFocus />
		<div class="flex flex-col">
			<div class="grid gap-6 grid-cols-2">
				<div class="col-span-2">
					<Label class="mb-2" for="name">Project name</Label>
					<Input id="name" bind:value={name} />
				</div>
				<div>
					<Label class="mb-2" for="width">Panel width (mm)</Label>
					<NumberInputBound id="width" max={999} min={10} bind:value={panelSettings.width} />
				</div>
				<div>
					<Label class="mb-2" for="height">Panel height (mm)</Label>
					<NumberInputBound id="height" max={999} min={10} bind:value={panelSettings.height} />
				</div>
				<div>
					<Label class="mb-2" for="pcbThickness">PCB thickness (mm)</Label>
					<NumberInputBound
						id="pcbThickness"
						max={10}
						min={0.1}
						bind:value={panelSettings.pcbThickness}
					/>
				</div>
				<div>
					<Label class="mb-2" for="smdHeight">SMD height (mm)</Label>
					<NumberInputBound
						id="smdHeight"
						max={10}
						min={0.1}
						bind:value={panelSettings.smdHeight}
					/>
				</div>
				<div class="col-span-2">
					<Label class="mb-2" for="printTolerance">Print tolerance (mm)</Label>
					<NumberInputBound
						id="printTolerance"
						max={2}
						min={0}
						step={0.1}
						bind:value={panelSettings.printTolerance}
					/>
				</div>
				<div class="col-span-2">
					<Label class="mb-2" for="label">Print label</Label>
					<Input id="label" bind:value={label} />
				</div>
			</div>
		</div>
		<div class="text-center mt-4 space-y-6">
			<Button class="me-2" color="green" onclick={() => resolve(true)}>OK</Button>
			<Button class="me-2" color="alternative" onclick={() => resolve(false)}>Cancel</Button>
		</div>
	</Modal>
</EscapeClose>
