<script lang="ts">
	import { Dropzone } from 'flowbite-svelte';

	export let title: string;
	export let description: string;
	export let onUpload: (data: string, filename: string) => void;

	const loadFile = (file: File) => {
		const reader = new FileReader();
		reader.addEventListener('load', (event_) => {
			if (event_.target && event_.target.result && !(event_.target.result instanceof ArrayBuffer))
				onUpload(event_.target.result, file.name);
		});
		reader.readAsDataURL(file);
	};

	const dropHandleItem = (items: DataTransferItemList) => {
		if (items[0].kind === 'file') {
			const file = items[0].getAsFile();
			if (file) loadFile(file);
		}
	};
	const dropHandle = (event: DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer)
			if (event.dataTransfer.items && event.dataTransfer.items.length > 0)
				dropHandleItem(event.dataTransfer.items);
			else if (event.dataTransfer.files && event.dataTransfer.files.length > 0)
				loadFile(event.dataTransfer.files[0]);
	};

	const handleChange = (event: Event) => {
		const files = (event.target as HTMLInputElement).files;
		if (files && files.length > 0) loadFile(files[0]);
	};
</script>

<Dropzone
	on:dragover={(event) => event.preventDefault()}
	on:drop={dropHandle}
	on:change={handleChange}
	class="m-4"
>
	<p class="mb-2 text-lg text-gray-500 dark:text-gray-400 font-semibold">{title}</p>
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
	<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
</Dropzone>
