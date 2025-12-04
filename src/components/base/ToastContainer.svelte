<!--
  Toast Notification Container Component

  Displays toast notifications in a fixed bottom-right position.
  Subscribes to toastStore and renders each active toast using Flowbite Svelte.

  **Features:**
  - Fixed bottom-right positioning with z-50 (above most elements)
  - Vertical stacking of multiple toasts with gap spacing
  - Color-coded by toast type (success: green, error: red, warning: orange, info: blue)
  - Icons from Iconify matching toast type
  - Dismissable by user click on X button
  - Auto-dismissal handled by toastStore timeout

  **Integration:**
  - Add once to App.svelte at root level
  - Toasts appear automatically when toastStore.push() is called
  - No props required - entirely driven by store subscription
-->
<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Toast } from 'flowbite-svelte';

	import { toastStore } from '$stores/toastStore';

	/**
	 * Icon mapping for different toast types
	 * Uses Material Design Icons from Iconify
	 */
	const icons = {
		success: 'mdi:check-circle',
		error: 'mdi:alert-circle',
		warning: 'mdi:alert',
		info: 'mdi:information'
	};

	/**
	 * Color mapping for Flowbite Toast component
	 * Matches toast type to Flowbite color scheme
	 */
	const colors = {
		success: 'green',
		error: 'red',
		warning: 'orange',
		info: 'blue'
	} as const;
</script>

<!--
  Fixed container positioned in bottom-right corner
  z-50 ensures toasts appear above most UI elements
  Flex column for vertical stacking with 2-unit gap
-->
<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
	{#each $toastStore as toast (toast.id)}
		<Toast color={colors[toast.type]} dismissable>
			<div class="flex items-center gap-2">
				<Icon class="h-5 w-5" icon={icons[toast.type]} />
				<span>{toast.message}</span>
			</div>
		</Toast>
	{/each}
</div>
