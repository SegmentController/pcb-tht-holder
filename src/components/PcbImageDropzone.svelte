<script lang="ts" context="module">
	export type ImageSize = { width: number; height: number };
</script>

<script lang="ts">
	import { Dropzone } from 'flowbite-svelte';
	import { onMount } from 'svelte';

	export let onUpload: (image: HTMLImageElement, filename: string, size: ImageSize) => void;

	onMount(() => {});

	const loadPCBImageFile = (file: File) => {
		const pcbImage = document.createElement('img');

		const reader = new FileReader();
		reader.addEventListener('load', (event_) => {
			if (
				pcbImage &&
				event_.target &&
				event_.target.result &&
				!(event_.target.result instanceof ArrayBuffer)
			) {
				pcbImage.src = event_.target.result;
				pcbImage.addEventListener('load', () =>
					onUpload(pcbImage, file.name, { width: pcbImage.width, height: pcbImage.height })
				);
			}
		});
		reader.readAsDataURL(file);
	};

	const dropHandle = (event: DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer)
			if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
				if (event.dataTransfer.items[0].kind === 'file') {
					const file = event.dataTransfer.items[0].getAsFile();
					if (file) loadPCBImageFile(file);
				}
			} else if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
				const file = event.dataTransfer.files[0];
				if (file) loadPCBImageFile(file);
			}
	};

	const handleChange = (event: Event) => {
		const files = (event.target as HTMLInputElement).files;
		if (files && files.length > 0) loadPCBImageFile(files[0]);
	};
</script>

<Dropzone
	on:dragover={(event) => event.preventDefault()}
	on:drop={dropHandle}
	on:change={handleChange}
	class="max-w-96"
>
	<p class="mb-2 text-lg text-gray-500 dark:text-gray-400"><b>Top view</b> PCB image</p>
	<svg
		aria-hidden="true"
		class="mb-3 w-10 h-10 text-gray-400"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
		><path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
		/></svg
	>
	<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
		<span class="font-semibold">Click to upload</span> or drag and drop an image
	</p>
	<p class="text-xs text-gray-500 dark:text-gray-400">PNG, JPG or SVG</p>
</Dropzone>
