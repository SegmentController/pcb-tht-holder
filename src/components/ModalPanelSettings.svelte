<script lang="ts" context="module">
	export type PanelSettings = {
		width: number;
		height: number;
		pcbThickness: number;
		smdHeight: number;
	};
</script>

<script lang="ts">
	import { Button, Label, Modal, NumberInput } from 'flowbite-svelte';

	let _settings: PanelSettings;
	let _onOK: (settings: PanelSettings) => void;
	let isOpen: boolean = false;

	export const open = (settings: PanelSettings, onOK: (settings: PanelSettings) => void): void => {
		_settings = settings;
		_onOK = onOK;
		isOpen = true;
	};
</script>

<Modal open={isOpen} size="xs" dismissable={false}>
	<div class="flex flex-col space-y-6">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">PCB settings</h3>
		<div class="grid gap-6 mb-6 md:grid-cols-2">
			<div>
				<Label for="width" class="mb-2">Panel width (mm)</Label>
				<NumberInput id="width" bind:value={_settings.width} />
			</div>
			<div>
				<Label for="height" class="mb-2">Panel height (mm)</Label>
				<NumberInput id="height" bind:value={_settings.height} />
			</div>
			<div>
				<Label for="pcbThickness" class="mb-2">PCB thickness (mm)</Label>
				<NumberInput id="pcbThickness" bind:value={_settings.pcbThickness} />
			</div>
			<div>
				<Label for="smdHeight" class="mb-2">SMD height (mm)</Label>
				<NumberInput id="smdHeight" bind:value={_settings.smdHeight} />
			</div>
		</div>
	</div>
	<div class="text-center">
		<Button
			on:click={() => {
				isOpen = false;
				_onOK(_settings);
			}}
			color="green"
			class="me-2">OK</Button
		>
		<Button on:click={() => (isOpen = false)} color="alternative">Cancel</Button>
	</div>
</Modal>
