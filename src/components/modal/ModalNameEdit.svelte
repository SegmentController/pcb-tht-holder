<script lang="ts">
	import { Button, Input, Label, Modal } from 'flowbite-svelte';

	let _name: string;
	let _onOK: (name: string) => void;
	let isOpen: boolean = false;

	export const open = (name: string, onOK: (name: string) => void): void => {
		_name = name;
		_onOK = onOK;
		isOpen = true;
	};
</script>

<Modal open={isOpen} size="xs" dismissable={false}>
	<div class="flex flex-col space-y-6">
		<div>
			<Label for="name" class="mb-2">Name</Label>
			<Input id="name" bind:value={_name} />
		</div>
	</div>
	<div class="text-center">
		<Button
			on:click={() => {
				isOpen = false;
				_onOK(_name);
			}}
			color="green"
			class="me-2">OK</Button
		>
		<Button on:click={() => (isOpen = false)} color="alternative" class="me-2">Cancel</Button>
	</div>
</Modal>
