<script lang="ts">
	import { Button, Label, Modal, Range } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
			width: number;
		};
	}>();
	const resolve = (confirmed: boolean, width: number) =>
		dispatch('resolve', {
			confirmed,
			width
		});

	export let width: number;
	export let height: number;

	let recentWidth = width;
</script>

<Modal open={true} size="sm" classBackdrop="bg-black/50" dismissable={false} title="Resize image">
	<div class="text-center">
		<div class="flex flex-col items-center gap-4 mb-6">
			<Label defaultClass="text-sm whitespace-nowrap"
				>New size: <span class="font-semibold"
					>{recentWidth} x {Math.round((height / width) * recentWidth)}px</span
				></Label
			>
			<Range min={100} max={width} step={64} bind:value={recentWidth} id="resize" />
		</div>
		<Button onclick={() => resolve(true, 1000)} color="green" class="me-2">Resize</Button>
		<Button onclick={() => resolve(false, 0)} color="alternative">Cancel</Button>
	</div>
</Modal>
