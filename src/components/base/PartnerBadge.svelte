<!--
  Partner Badge Component

  Shows the SkipTheCAD partner badge in the top-right corner (4px margin from top and right).
  Opens the partner page in a new window and hides itself after DURATION_MS.

  **Integration:**
  - Add once to App.svelte at root level
  - No props required
-->
<script lang="ts">
	import { onMount } from 'svelte';

	/** Time the badge stays visible after mount */
	const DURATION_MS = 7000;

	let visible = true;

	onMount(() => {
		const timer = setTimeout(() => (visible = false), DURATION_MS);
		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<a
		class="fixed top-1 right-1 z-40"
		href="https://skipthecad.com/generators/pcb-tht-holder/"
		rel="noopener noreferrer"
		target="_blank"
	>
		<img
			alt="Listed on SkipTheCAD"
			height="56"
			src="https://skipthecad.com/badge/listed-light.svg"
			width="220"
		/>
	</a>
{/if}
