<script lang="ts">
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import AutoFocus from '$components/modal/util/AutoFocus.svelte';
	import EscapeClose from '$components/modal/util/EscapeClose.svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
			name: string;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			confirmed,
			name
		});

	export let name: string;
</script>

<EscapeClose on:escape={() => resolve(false)}>
	<Modal dismissable={false} open={true} size="sm">
		<AutoFocus />
		<div class="flex flex-col space-y-6">
			<div>
				<Label class="mb-2" for="name">Name</Label>
				<Input id="name" bind:value={name} />
			</div>
		</div>
		<div class="text-center mt-4 space-y-6">
			<Button class="me-2" color="green" onclick={() => resolve(true)}>OK</Button>
			<Button class="me-2" color="alternative" onclick={() => resolve(false)}>Cancel</Button>
		</div>
	</Modal>
</EscapeClose>
