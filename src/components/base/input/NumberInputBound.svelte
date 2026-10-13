<script lang="ts">
	import { Input, Tooltip } from 'flowbite-svelte';

	interface Properties {
		id: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
	}

	// step 1 (the browser default) would reject every value with a decimal digit
	let { id, value = $bindable(), min, max, step = 0.1 }: Properties = $props();

	// Clamp on change as well as blur: Enter submits a form without blurring the input
	const clamp = () => {
		if (min !== undefined && value < min) value = min;
		if (max !== undefined && value > max) value = max;
	};

	const isError = $derived(
		(min !== undefined && value < min) || (max !== undefined && value > max)
	);
</script>

<Input
	{id}
	color={isError ? 'red' : 'default'}
	onblur={clamp}
	onchange={clamp}
	{step}
	type="number"
	bind:value
/>
<Tooltip placement="bottom-end" type="light">{min} - {max}</Tooltip>
