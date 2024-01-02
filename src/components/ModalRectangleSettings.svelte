<script lang="ts" context="module">
	export type RectangleSettings = {
		sizeX: number;
		sizeY: number;
		depth: number;
	};
</script>

<script lang="ts">
	import { Button, Label, Modal, NumberInput } from 'flowbite-svelte';

	let _settings: RectangleSettings;
	let _onOK: (settings: RectangleSettings) => void;
	let isOpen: boolean = false;

	export const open = (
		settings: RectangleSettings,
		onOK: (settings: RectangleSettings) => void
	): void => {
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
				<Label class="mb-2">Size X (mm)</Label>
				<NumberInput bind:value={_settings.sizeX} />
			</div>
			<div>
				<Label class="mb-2">Size Y (mm)</Label>
				<NumberInput bind:value={_settings.sizeY} />
			</div>
			<div>
				<Label class="mb-2">Depth (mm)</Label>
				<NumberInput bind:value={_settings.depth} />
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
