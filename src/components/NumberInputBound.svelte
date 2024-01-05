<script lang="ts">
	import { NumberInput } from 'flowbite-svelte';

	export let id: string;

	export let value: number;
	export let min: number | undefined;
	export let max: number | undefined;
</script>

<NumberInput
	{id}
	bind:value
	on:input={() => {
		if (min && value < min) value = min;
		if (max && value > max) value = max;
	}}
/>
