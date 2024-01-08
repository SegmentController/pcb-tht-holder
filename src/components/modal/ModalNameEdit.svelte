<script lang="ts">
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			trigger: 'custom';
			confirmed: boolean;
			name: string;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			trigger: 'custom',
			confirmed,
			name
		});

	export let name: string;
</script>

<Modal open={true} size="sm">
	<div class="flex flex-col space-y-6">
		<div>
			<Label for="name" class="mb-2">Name</Label>
			<Input id="name" bind:value={name} />
		</div>
	</div>
	<div class="text-center mt-4">
		<Button on:click={() => resolve(true)} color="green" class="me-2">OK</Button>
		<Button on:click={() => resolve(false)} color="alternative" class="me-2">Cancel</Button>
	</div>
</Modal>
