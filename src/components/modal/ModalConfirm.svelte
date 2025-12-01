<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import EscapeClose from './util/EscapeClose.svelte';

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

<EscapeClose on:escape={() => resolve(false)}>
	<Modal dismissable={false} open={true} size="sm" title="Confirm">
		<div class="text-center">
			<h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
				{title}
			</h3>
			<Button class="me-2" color="red" onclick={() => resolve(true)}>Yes</Button>
			<Button color="alternative" onclick={() => resolve(false)}>Cancel</Button>
		</div>
	</Modal>
</EscapeClose>
