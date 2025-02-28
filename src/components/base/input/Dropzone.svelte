<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Dropzone } from 'flowbite-svelte';

	export let title: string;
	export let description: string;
	export let errorMessage: string = '';
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
	class="m-4"
	onchange={handleChange}
	ondragover={(event) => event.preventDefault()}
	ondrop={dropHandle}
>
	<p class="mb-2 text-lg text-gray-500 dark:text-gray-400 font-semibold">{title}</p>
	<Icon class="inline-flex" color="gray" icon="mdi:cloud-upload-outline" width={48} />
	{#if errorMessage}
		<p class="text-red-700 text-center text-lg font-semibold">
			{errorMessage}
		</p>
	{/if}
	<p class="mb-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
</Dropzone>
