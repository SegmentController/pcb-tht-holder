<script lang="ts">
	import Icon from '@iconify/svelte/dist/OfflineIcon.svelte';
	import { Button, Input, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import NumberInputBound from '$components/base/input/NumberInputBound.svelte';
	import AutoFocus from '$components/modal/util/AutoFocus.svelte';
	import EscapeClose from '$components/modal/util/EscapeClose.svelte';
	import type { PanelSettings } from '$types/PanelSettings';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
			panelSettings: PanelSettings;
			name: string;
			label: string;
		};
	}>();
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			confirmed,
			panelSettings,
			name,
			label
		});
	export let panelSettings: PanelSettings;
	export let name: string;
	export let label: string;
</script>

<EscapeClose on:escape={() => resolve(false)}>
	<Modal dismissable={false} open={true} size="sm" title="Project settings">
		<AutoFocus />
		<!-- Enter confirms (inputs commit/clamp their value on change before submit) -->
		<form
			onsubmit={(event) => {
				event.preventDefault();
				resolve(true);
			}}
		>
			<div class="flex flex-col">
				<div class="grid gap-6 grid-cols-2">
					<div class="col-span-2">
						<Label class="mb-2" for="name">Project name</Label>
						<Input id="name" bind:value={name} />
					</div>
					<div>
						<Label class="mb-2" for="width">Panel width (mm)</Label>
						<NumberInputBound id="width" max={999} min={10} bind:value={panelSettings.width} />
					</div>
					<div>
						<Label class="mb-2" for="height">Panel height (mm)</Label>
						<NumberInputBound id="height" max={999} min={10} bind:value={panelSettings.height} />
					</div>
					<div>
						<Label class="mb-2" for="pcbThickness">PCB thickness (mm)</Label>
						<NumberInputBound
							id="pcbThickness"
							max={10}
							min={0.1}
							bind:value={panelSettings.pcbThickness}
						/>
					</div>
					<div>
						<Label class="mb-2" for="smdHeight">SMD height (mm)</Label>
						<NumberInputBound
							id="smdHeight"
							max={10}
							min={0.1}
							bind:value={panelSettings.smdHeight}
						/>
					</div>
					<div class="col-span-2">
						<Label class="mb-2" for="printTolerance">Print tolerance (mm)</Label>
						<NumberInputBound
							id="printTolerance"
							max={2}
							min={0}
							step={0.1}
							bind:value={panelSettings.printTolerance}
						/>
					</div>
					<div class="col-span-2">
						<Label class="mb-2" for="label">Print label</Label>
						<div class="flex gap-2">
							<Input id="label" bind:value={label} />
							<Button
								class="shrink-0 px-3"
								aria-label="Copy project name to label"
								color="alternative"
								disabled={!!label.trim() || !name.trim()}
								onclick={() => (label = name)}
								title="Copy the project name to the label (only while the label is empty)"
							>
								<Icon icon="mdi:content-copy" width={20} />
							</Button>
						</div>
					</div>
				</div>
			</div>
			<div class="text-center mt-4 space-y-6">
				<Button class="me-2" color="green" type="submit">OK</Button>
				<Button class="me-2" color="alternative" onclick={() => resolve(false)}>Cancel</Button>
			</div>
		</form>
	</Modal>
</EscapeClose>
