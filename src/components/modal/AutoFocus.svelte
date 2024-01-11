<script lang="ts">
	import { onMount, tick } from 'svelte';

	let div: HTMLElement;

	onMount(async () => {
		await tick();

		const parent = div.parentElement;
		if (!parent) return;

		const inputs = parent.querySelectorAll('input');
		for (const input of inputs)
			if (input.checkVisibility() && !input.disabled) {
				input.focus();
				break;
			}
	});
</script>

<div bind:this={div}>
	<slot />
</div>
