<!--
  Partner Badge Component

  Shows the SkipTheCAD partner badge. From the `xl` breakpoint up it is fixed in the top-right corner
  (4px margin from top and right). Below `xl` the header is wide enough to collide with it, so the
  badge hangs directly under the header instead (zero-height in-flow wrapper: no layout shift).
  Opens the partner page in a new window and hides itself after DURATION_MS.

  **Integration:**
  - Add once to App.svelte, directly after AppNavigation (the in-flow wrapper must follow the header)
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
	<div class="relative z-40 h-0 xl:fixed xl:top-1 xl:right-1 xl:h-auto">
		<a
			class="absolute top-1 right-1 xl:static"
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
	</div>
{/if}
