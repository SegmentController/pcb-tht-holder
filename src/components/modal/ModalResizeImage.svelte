<script lang="ts">
	import { Button, Label, Modal, Range } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
			width: number;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			confirmed,
			width: recentWidth
		});

	export let width: number;
	export let height: number;

	const MIN_WIDTH = 640;
	const MAX_WIDTH = 1280;

	let recentWidth = Math.min(width, MAX_WIDTH);
</script>

<Modal
	open={true}
	size="sm"
	dismissable={false}
	title={`Resize image from ${width} x ${height} px`}
>
	<div class="text-center">
		<div class="flex flex-col items-center gap-4 mb-6">
			<Label defaultClass="text-sm whitespace-nowrap"
				>New size: <span class="font-semibold"
					>{recentWidth} x {Math.round((height / width) * recentWidth)}px</span
				></Label
			>
			<Range min={MIN_WIDTH} max={MAX_WIDTH} step={64} bind:value={recentWidth} id="resize" />
		</div>
		<Button onclick={() => resolve(true)} color="green" class="me-2">Resize</Button>
		<Button onclick={() => resolve(false)} color="alternative">Cancel</Button>
	</div>
</Modal>
