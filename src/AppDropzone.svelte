<script lang="ts">
	import Alert from '$components/base/Alert.svelte';
	import Dropzone from '$components/base/input/Dropzone.svelte';
	import { projectStore } from '$stores/projectStore';
	import type { ImageSize } from '$types/ImageSize';
	import { Project } from '$types/Project';

	import { openProjectSettings } from './AppCommon';

	export let pcbImage: HTMLImageElement | undefined;
	export let imageSize: ImageSize | undefined;

	let alert: Alert;

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
					alert.hide();
					return;
				}
				alert.showError('Cannot load project file', 'Invalid format');
			} catch (error) {
				alert.showError(
					'Cannot load project file',
					`${error instanceof Error ? error.message : error}`
				);
			}
			return;
		}

		pcbImage = document.createElement('img');
		pcbImage.addEventListener('load', () => {
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
			if (isManualUpload) openProjectSettings();
		});
		pcbImage.addEventListener('error', () => {
			pcbImage = undefined;
			$projectStore.image = '';
			$projectStore.name = '';
			alert.showError('Cannot load image', '');
		});
		pcbImage.src = _fileData;
		alert.hide();
	};
</script>

<Alert bind:this={alert} />

<Dropzone
	title="Top view of PCB image or a project file"
	description="Click to upload or drag and drop a file. Image file (png, jpg) begins a new project, a .tht3d file restores a previously saved project."
	onUpload={(imgData, filename) =>
		onFileUpload(imgData, filename.slice(0, Math.max(0, filename.lastIndexOf('.'))), true, false)}
/>
