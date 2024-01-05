<script lang="ts" context="module">
	export type RectangleSettings = {
		sizeX: number;
		sizeY: number;
		depth: number;
	};
</script>

<script lang="ts">
	import { Button, Label, Modal } from 'flowbite-svelte';

	import NumberInputBound from '$components/NumberInputBound.svelte';

	let _settings: RectangleSettings;
	let _onOK: (settings: RectangleSettings) => void;
	let _onDelete: (() => void) | undefined;
	let isOpen: boolean = false;

	export const open = (
		settings: RectangleSettings,
		onOK: (settings: RectangleSettings) => void,
		onDelete?: () => void
	): void => {
		_settings = settings;
		_onOK = onOK;
		_onDelete = onDelete;
		isOpen = true;
	};
</script>

<Modal open={isOpen} size="xs" dismissable={false}>
	<div class="flex flex-col space-y-6">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">Rectangle settings</h3>
		<div class="grid gap-6 mb-6 md:grid-cols-2">
			<div>
				<Label for="sizeX" class="mb-2">Size X (mm)</Label>
				<NumberInputBound id="sizeX" min={0.5} max={99} bind:value={_settings.sizeX} />
			</div>
			<div>
				<Label for="sizeY" class="mb-2">Size Y (mm)</Label>
				<NumberInputBound id="sizeY" min={0.5} max={99} bind:value={_settings.sizeY} />
			</div>
			<div>
				<Label for="depth" class="mb-2">Depth (mm)</Label>
				<NumberInputBound id="depth" min={0.5} max={99} bind:value={_settings.depth} />
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
		<Button on:click={() => (isOpen = false)} color="alternative" class="me-2">Cancel</Button>
		{#if _onDelete}
			<Button
				on:click={() => {
					isOpen = false;
					_onDelete && _onDelete();
				}}
				color="red"
				class="me-2 float-right">Remove</Button
			>
		{/if}
	</div>
</Modal>
