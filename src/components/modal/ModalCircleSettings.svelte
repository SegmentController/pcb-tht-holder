<script lang="ts" context="module">
	export type CircleSettings = {
		diameter: number;
		depth: number;
	};
</script>

<script lang="ts">
	import { Button, Label, Modal } from 'flowbite-svelte';

	import NumberInputBound from '$components/NumberInputBound.svelte';

	let _settings: CircleSettings;
	let _onOK: (settings: CircleSettings) => void;
	let isOpen: boolean = false;

	export const open = (
		settings: CircleSettings,
		onOK: (settings: CircleSettings) => void
	): void => {
		_settings = settings;
		_onOK = onOK;
		isOpen = true;
	};
</script>

<Modal open={isOpen} size="xs" dismissable={false}>
	<div class="flex flex-col space-y-6">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">Circle settings</h3>
		<div class="grid gap-6 mb-6 md:grid-cols-2">
			<div>
				<Label for="diameter" class="mb-2">Diameter (mm)</Label>
				<NumberInputBound id="diameter" min={0.5} max={99} bind:value={_settings.diameter} />
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
	</div>
</Modal>
