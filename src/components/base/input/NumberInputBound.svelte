<script lang="ts">
	import { Input, Tooltip } from 'flowbite-svelte';

	export let id: string;

	export let value: number;
	export let min: number | undefined;
	export let max: number | undefined;

	$: isError = (min && value < min) || (max && value > max) || false;
</script>

<Input
	{id}
	color={isError ? 'red' : 'default'}
	onblur={() => {
		if (min && value < min) value = min;
		if (max && value > max) value = max;
	}}
	bind:value
/>
<Tooltip placement="bottom-end" type="light">{min} - {max}</Tooltip>
