<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			confirmed
		});

	export let title: string;
</script>

<Modal open={true} size="sm" dismissable={false} title="Confirm">
	<div class="text-center">
		<h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
			{title}
		</h3>
		<Button onclick={() => resolve(true)} color="red" class="me-2">Yes</Button>
		<Button onclick={() => resolve(false)} color="alternative">Cancel</Button>
	</div>
</Modal>
