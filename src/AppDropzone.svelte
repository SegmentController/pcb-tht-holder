<script lang="ts">
	import { createCanvas, loadImage } from 'canvas';

	import Dropzone from '$components/base/input/Dropzone.svelte';
	import { showModalResizeImage } from '$stores/modalStore';
	import { projectStore } from '$stores/projectStore';
	import type { ImageSize } from '$types/ImageSize';
	import { Project } from '$types/Project';

	import { openProjectSettings } from './AppNavigation.svelte';

	export let pcbImage: HTMLImageElement | undefined;
	export let imageSize: ImageSize | undefined;

	let errorMessage: string = '';

	export const onFileUpload = (
		_fileData: string,
		_name: string,
		isManualUpload: boolean,
		forceSaveToStore: boolean
	) => {
		if (isManualUpload && _fileData.startsWith('data:application/octet-stream')) {
			try {
				const fileDataRaw = atob(_fileData.replace('data:application/octet-stream;base64,', ''));

				const projectFileData = JSON.parse(fileDataRaw);
				const isValid = Project.safeParse(projectFileData);
				if (isValid.success) {
					$projectStore.circles = isValid.data.circles || [];
					$projectStore.rectangles = isValid.data.rectangles || [];
					$projectStore.legs = isValid.data.legs || [];
					onFileUpload(isValid.data.image, isValid.data.name, false, true);
					$projectStore.panelSettings = isValid.data.panelSettings;
					errorMessage = '';
					return;
				}
				errorMessage = 'Cannot load project file: Invalid format';
			} catch (error) {
				errorMessage = `Cannot load project file: ${error instanceof Error ? error.message : error}`;
			}
			return;
		}

		pcbImage = document.createElement('img');
		pcbImage.addEventListener('load', async () => {
			$projectStore.name = _name;
			if (pcbImage) {
				imageSize = { width: pcbImage.width, height: pcbImage.height };
				if (isManualUpload)
					$projectStore.panelSettings.height = Math.round(
						$projectStore.panelSettings.width * (imageSize.height / imageSize.width)
					);
				$projectStore.image = _fileData;
			}
			if (isManualUpload || forceSaveToStore) {
				projectStore.update((value) => {
					value.image = _fileData;
					value.name = _name;
					return value;
				});
			}
			if (isManualUpload && pcbImage && (pcbImage.width > 1280 || pcbImage.height > 1024)) {
				const { confirmed, width } = await showModalResizeImage(pcbImage.width, pcbImage.height);
				if (confirmed) {
					const height = width * (pcbImage.height / pcbImage.width);
					try {
						const image = await loadImage(_fileData.toString());
						const canvas = createCanvas(width, height);
						const context = canvas.getContext('2d');
						context.drawImage(image, 0, 0, width, height);

						// emulate load again
						isManualUpload = false;
						_fileData = canvas.toDataURL('image/jpeg', 0.9);
						if (pcbImage) pcbImage.src = _fileData;
						canvas.width = 0;
						canvas.height = 0;
					} catch {
						errorMessage = 'Failed to resize image';
						return;
					}
				}
			}
			if (isManualUpload) {
				const confirmed = await openProjectSettings();
				if (!confirmed) {
					pcbImage = undefined;
					imageSize = undefined;
					$projectStore.image = '';
					$projectStore.name = '';
				}
			}
		});
		pcbImage.addEventListener('error', () => {
			pcbImage = undefined;
			$projectStore.image = '';
			$projectStore.name = '';
			errorMessage = 'Cannot load image';
		});
		pcbImage.src = _fileData;
		errorMessage = '';
	};
</script>

<Dropzone
	title="Top view of PCB image or a project file"
	description="Click to upload or drag and drop a file. Image file (png, jpg) begins a new project, a .tht3d file restores a previously saved project."
	{errorMessage}
	onUpload={(imgData, filename) =>
		onFileUpload(imgData, filename.slice(0, Math.max(0, filename.lastIndexOf('.'))), true, false)}
/>
