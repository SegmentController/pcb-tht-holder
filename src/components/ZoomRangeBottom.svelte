<script lang="ts">
	import { shortcut } from '@svelte-put/shortcut';
	import { Label, Range } from 'flowbite-svelte';

	import { MathMinMax } from '$lib/Math';

	const DEFAULT_VALUE = 100;

	let aClass = '';
	export { aClass as class };

	export let value: number = DEFAULT_VALUE;
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
					updateValue(value + 10);
				},
				preventDefault: true
			},
			{
				key: '-',
				callback: () => {
					updateValue(value - 10);
				},
				preventDefault: true
			},
			{
				key: '*',
				callback: () => {
					updateValue(DEFAULT_VALUE);
				},
				preventDefault: true
			}
		]
	}}
/>

<div class="absolute bottom-4 w-full">
	<div class="flex justify-center">
		<div class={aClass}>
			<Label defaultClass="font-normal text-sm"
				>Zoom: <span class="font-semibold">{value}</span>%</Label
			>
			<Range {min} {max} {step} bind:value id="imageZoom" />
		</div>
	</div>
</div>
