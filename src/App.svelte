<!--
	Root Application Component - PCB THT Holder

	This is the main application component that orchestrates the entire PCB holder design workflow.
	It implements a simple state machine with two primary states:

	1. **Dropzone State** (no image loaded):
	   - Displays file upload interface (AppDropzone)
	   - Accepts PCB images or project files (.tht3d)
	   - Handles project restoration from localStorage on mount

	2. **Designer State** (image loaded):
	   - Displays 2D canvas designer interface (AppDesigner)
	   - Allows component placement and manipulation
	   - Provides navigation bar with tools and shortcuts

	Architecture:
	- State is driven by `imageSize` - undefined = dropzone, defined = designer
	- `pcbImage` holds the loaded image element for canvas rendering
	- `designerMode` controls pointer/measure mode in designer
	- All components share global stores (projectStore, modalStore)

	State Flow:
	1. onMount: Check localStorage → restore previous project if exists
	2. User uploads image → AppDropzone sets pcbImage/imageSize
	3. Triggers conditional switch → AppDesigner becomes visible
	4. User can reset → clears state → returns to Dropzone

	Modal System:
	- ModalPortal renders all modal dialogs at root level
	- Prevents z-index issues and ensures proper overlay behavior
	- Connected to modalStore for centralized modal management
-->
<script lang="ts">
	import './app.postcss';

	import { onMount } from 'svelte';

	import ModalPortal from '$lib/svelteModal/ModalPortal.svelte';
	import { modalStore } from '$stores/modalStore';
	import { getProjectStoreValue } from '$stores/projectStore';
	import type { ImageSize } from '$types/ImageSize';

	import AppDesigner, { type DesignerMode } from './AppDesigner.svelte';
	import AppDropzone from './AppDropzone.svelte';
	import AppNavigation from './AppNavigation.svelte';

	/** Loaded PCB image element for canvas rendering */
	let pcbImage: HTMLImageElement | undefined;

	/**
	 * Image dimensions in pixels
	 * Acts as application state discriminator: undefined = show dropzone, defined = show designer
	 */
	let imageSize: ImageSize | undefined;

	/**
	 * Restore previous project from localStorage on application mount
	 * Automatically loads the last worked-on project if available
	 */
	onMount(() => {
		const preferences = getProjectStoreValue();
		if (preferences.image) dropzone.onFileUpload(preferences.image, preferences.name, false, false);
	});

	/**
	 * Reset application state to dropzone view
	 * Clears loaded image and returns user to file upload interface
	 */
	const reset = () => (imageSize = pcbImage = undefined);

	/** Reference to dropzone component for programmatic file loading */
	let dropzone: AppDropzone;

	/** Current designer interaction mode (pointer for manipulation, measure for distance) */
	let designerMode: DesignerMode = 'pointer';
</script>

<AppNavigation projectLoaded={!!imageSize} bind:mode={designerMode} on:reset={reset} />
<div class="flex flex-col justify-center">
	{#if !!imageSize}
		<AppDesigner bind:pcbImage bind:imageSize bind:mode={designerMode} />
	{:else}
		<AppDropzone bind:this={dropzone} bind:pcbImage bind:imageSize />
	{/if}
</div>

<ModalPortal store={modalStore} />

<style>
	:global(body) {
		background-color: #f3f4f6;
	}

	:global(button) {
		cursor: pointer;
	}
</style>
