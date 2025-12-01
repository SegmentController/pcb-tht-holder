<script lang="ts" module>
	export type RectangleSettings = {
		width: number;
		height: number;
		depth: number;
		rotation: number;
	};
</script>

<script lang="ts">
	import { Button, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/base/input/NumberInputBound.svelte';
	import AutoFocus from '$components/modal/util/AutoFocus.svelte';
	import EscapeClose from '$components/modal/util/EscapeClose.svelte';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
			settings: RectangleSettings;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			confirmed,
			settings
		});
	export let settings: RectangleSettings;
</script>

<EscapeClose on:escape={() => resolve(false)}>
	<Modal dismissable={false} open={true} size="sm" title="Rectangle settings">
		<AutoFocus />
		<div class="flex flex-col">
			<div class="grid gap-6 md:grid-cols-2">
				<div>
					<Label class="mb-2" for="width">Width (mm)</Label>
					<NumberInputBound id="width" max={99} min={0.5} bind:value={settings.width} />
				</div>
				<div>
					<Label class="mb-2" for="height">Height (mm)</Label>
					<NumberInputBound id="height" max={99} min={0.5} bind:value={settings.height} />
				</div>
				<div>
					<Label class="mb-2" for="depth">Depth (mm)</Label>
					<NumberInputBound id="depth" max={99} min={0.5} bind:value={settings.depth} />
				</div>
				<div>
					<Label class="mb-2" for="rotation">Rotation (°)</Label>
					<NumberInputBound id="rotation" max={359} min={0} bind:value={settings.rotation} />
				</div>
			</div>
		</div>
		<div class="text-center mt-4 space-y-6">
			<Button class="me-2" color="green" onclick={() => resolve(true)}>OK</Button>
			<Button class="me-2" color="alternative" onclick={() => resolve(false)}>Cancel</Button>
		</div>
	</Modal>
</EscapeClose>
