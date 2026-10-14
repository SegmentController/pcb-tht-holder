<script lang="ts">
	import Icon from '@iconify/svelte/dist/OfflineIcon.svelte';
	import { Dropzone } from 'flowbite-svelte';

	export let title: string;
	export let description: string;
	export let errorMessage: string = '';
	export let onUpload: (data: string, filename: string) => void;
	/**
	 * Gets every dropped / selected file first; returning true consumes them. Otherwise only the
	 * first file goes through `onUpload` (as a data URL).
	 */
	export let claimFiles: ((files: File[]) => boolean) | undefined;

	const handleFiles = (files: File[]) => {
		if (files.length === 0 || claimFiles?.(files)) return;
		loadFile(files[0]);
	};

	const loadFile = (file: File) => {
		const reader = new FileReader();
		reader.addEventListener('load', (event_) => {
			if (event_.target && event_.target.result && !(event_.target.result instanceof ArrayBuffer))
				onUpload(event_.target.result, file.name);
		});
		reader.readAsDataURL(file);
	};

	const dropHandle = (event: DragEvent) => {
		event.preventDefault();
		if (event.dataTransfer?.files) handleFiles([...event.dataTransfer.files]);
	};

	const handleChange = (event: Event) => {
		const files = (event.target as HTMLInputElement).files;
		if (files) handleFiles([...files]);
	};
</script>

<Dropzone
	class="m-4 w-auto"
	multiple={!!claimFiles}
	onchange={handleChange}
	ondragover={(event) => event.preventDefault()}
	ondrop={dropHandle}
	oninput={handleChange}
>
	<p class="mb-2 text-lg text-gray-500 dark:text-gray-400 font-semibold">{title}</p>
	<Icon class="inline-flex" color="gray" icon="mdi:cloud-upload-outline" width={48} />
	{#if errorMessage}
		<p class="text-red-700 text-center text-lg font-semibold">
			{errorMessage}
		</p>
	{/if}
	<p class="mb-2 px-4 text-sm text-gray-500 dark:text-gray-400">{description}</p>
</Dropzone>
