<script lang="ts">
	import { NumberInput, Tooltip } from 'flowbite-svelte';

	export let id: string;

	export let value: number;
	export let min: number | undefined;
	export let max: number | undefined;

	$: isError = () => (min && value < min) || (max && value > max) || false;
</script>

<NumberInput
	{id}
	bind:value
	on:blur={() => {
		if (min && value < min) value = min;
		if (max && value > max) value = max;
	}}
	color={isError() ? 'red' : 'base'}
/>
<Tooltip type="light" placement="bottom-end">{min} - {max}</Tooltip>
