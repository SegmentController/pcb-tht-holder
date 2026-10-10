<script lang="ts">
	import { Button, Label, Modal, Range } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import EscapeClose from '$components/modal/util/EscapeClose.svelte';

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
	const MAX_HEIGHT = 1024;

	// The offered sizes must satisfy both limits, so tall images do not stay above the max height
	const maxWidth = Math.max(64, Math.min(MAX_WIDTH, Math.floor((MAX_HEIGHT * width) / height)));
	const minWidth = Math.min(MIN_WIDTH, maxWidth);

	let recentWidth = Math.min(width, maxWidth);
</script>

<EscapeClose on:escape={() => resolve(false)}>
	<Modal
		dismissable={false}
		open={true}
		size="sm"
		title={`Resize image from ${width} x ${height} px`}
	>
		<div class="text-center">
			<div class="flex flex-col items-center gap-4 mb-6">
				<Label class="text-sm whitespace-nowrap"
					>New size: <span class="font-semibold"
						>{recentWidth} x {Math.round((height / width) * recentWidth)}px</span
					></Label
				>
				<Range id="resize" max={maxWidth} min={minWidth} step={64} bind:value={recentWidth} />
			</div>
			<Button class="me-2" color="green" onclick={() => resolve(true)}>Resize</Button>
			<Button color="alternative" onclick={() => resolve(false)}>Cancel</Button>
		</div>
	</Modal>
</EscapeClose>
