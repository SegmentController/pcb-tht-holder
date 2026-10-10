<script lang="ts">
	import { Label, Range } from 'flowbite-svelte';

	import { ZOOM_DEFAULT, ZOOM_STEP } from '$lib/constants';
	import { MathMinMax } from '$lib/Math';
	import { shortcut } from '$lib/shortcut';

	let aClass = '';
	export { aClass as class };

	export let value: number = ZOOM_DEFAULT;
	export let min: number = 0;
	export let max: number = 100;
	export let step: number = 1;

	const updateValue = (currentValue: number) => {
		value = MathMinMax(currentValue, min, max);
	};
</script>

<svelte:window
	use:shortcut={{
		trigger: [
			{
				key: '+',
				callback: () => {
					updateValue(value + ZOOM_STEP);
				},
				preventDefault: true
			},
			{
				key: '-',
				callback: () => {
					updateValue(value - ZOOM_STEP);
				},
				preventDefault: true
			},
			{
				key: '*',
				callback: () => {
					updateValue(ZOOM_DEFAULT);
				},
				preventDefault: true
			}
		]
	}}
/>

<div class={aClass + ' flex items-center space-x-2'}>
	<Label
		class="text-sm whitespace-nowrap cursor-pointer"
		onclick={() => {
			value = ZOOM_DEFAULT;
		}}
		title="Reset zoom">Zoom: <span class="font-semibold">{value}</span>%</Label
	>
	<Range id="imageZoom" {max} {min} {step} bind:value />
</div>
