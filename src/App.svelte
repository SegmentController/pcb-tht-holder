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

	let pcbImage: HTMLImageElement | undefined;
	let imageSize: ImageSize | undefined;

	onMount(() => {
		const preferences = getProjectStoreValue();
		if (preferences.image) dropzone.onFileUpload(preferences.image, preferences.name, false, false);
	});

	const reset = () => (imageSize = pcbImage = undefined);

	let dropzone: AppDropzone;
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
