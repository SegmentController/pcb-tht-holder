<script lang="ts">
	import { Input, Tooltip } from 'flowbite-svelte';

	interface Properties {
		id: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
	}

	let { id, value = $bindable(), min, max, step }: Properties = $props();

	const isError = $derived((min && value < min) || (max && value > max) || false);
</script>

<Input
	{id}
	color={isError ? 'red' : 'default'}
	onblur={() => {
		if (min && value < min) value = min;
		if (max && value > max) value = max;
	}}
	{step}
	type="number"
	bind:value
/>
<Tooltip placement="bottom-end" type="light">{min} - {max}</Tooltip>
