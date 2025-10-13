<!--
	File Upload and Project Loading Component

	Handles dual-purpose file uploads for PCB THT Holder application:

	1. **Image Files** (PNG, JPG, etc.):
	   - New project creation from PCB top-view image
	   - Automatic aspect ratio calculation for panel dimensions
	   - Optional automatic resizing for large images (>1280x1024px)
	   - Image processing: flip Y-axis, set transparency for overlay

	2. **Project Files** (.tht3d):
	   - Restore previously saved projects with all component placements
	   - Zod schema validation ensures data integrity
	   - Preserves circles, rectangles, legs, and panel settings
	   - Base64-encoded JSON format with image embedded

	Image Processing Pipeline:
	┌─────────────┐
	│ File Upload │
	└──────┬──────┘
	       │
	       ├─ Is .tht3d? ──Yes──> Parse JSON ──> Validate with Zod ──> Load Project
	       │                                          │
	       │                                          └─ Fail ──> Show Error
	       │
	       └─ Is Image? ───Yes──> Load Image ──> Check Size ──> Auto-resize Dialog
	                                  │                              │
	                                  │                              ├─ Accept ──> Resize via Canvas API
	                                  │                              │
	                                  │                              └─ Decline ──> Use Original
	                                  │
	                                  └──> Calculate Aspect Ratio ──> Open Settings Dialog

	Image Resizing Logic:
	- Triggered when width > 1280px OR height > 1024px
	- Uses canvas API for high-quality downscaling
	- Maintains aspect ratio
	- Converts to JPEG at 90% quality to reduce file size
	- User can decline and use original size

	Auto-load from localStorage:
	- onFileUpload() is called programmatically on mount if previous project exists
	- isManualUpload=false skips resize dialog and settings prompt
	- forceSaveToStore=false prevents unnecessary localStorage writes

	Error Handling:
	- Invalid project files show descriptive error messages
	- Failed image loads clear state and display error
	- JSON parsing errors are caught and reported
-->
<script lang="ts">
	import { createCanvas, loadImage } from 'canvas';

	import Dropzone from '$components/base/input/Dropzone.svelte';
	import { showModalResizeImage } from '$stores/modalStore';
	import { projectStore } from '$stores/projectStore';
	import type { ImageSize } from '$types/ImageSize';
	import { Project } from '$types/Project';

	import { openProjectSettings } from './AppNavigation.svelte';

	/** Bound to parent - receives loaded image element */
	export let pcbImage: HTMLImageElement | undefined;

	/** Bound to parent - triggers state transition to designer when set */
	export let imageSize: ImageSize | undefined;

	/** Error message displayed below dropzone */
	let errorMessage: string = '';

	/**
	 * Core file upload handler - processes both images and project files
	 *
	 * Supports two upload paths:
	 * 1. Manual upload from user drag/drop or file picker (isManualUpload=true)
	 * 2. Programmatic load from localStorage on mount (isManualUpload=false)
	 *
	 * @param _fileData - Base64-encoded data URL or project JSON
	 * @param _name - Filename without extension, becomes project name
	 * @param isManualUpload - True for user uploads, false for auto-restore
	 * @param forceSaveToStore - Force save to localStorage even when isManualUpload=false
	 *
	 * Flow for .tht3d project files:
	 * 1. Detect data:application/octet-stream MIME type
	 * 2. Base64 decode → Parse JSON
	 * 3. Validate with Zod Project schema
	 * 4. Load circles, rectangles, legs, panel settings
	 * 5. Recursively call onFileUpload with embedded image data
	 *
	 * Flow for image files:
	 * 1. Create HTMLImageElement and set src to data URL
	 * 2. On load: extract width/height, calculate aspect ratio
	 * 3. If large (>1280x1024): prompt user to resize
	 * 4. If resize accepted: use canvas API to downscale
	 * 5. If manual upload: open project settings dialog
	 * 6. Update projectStore with image and name
	 */
	export const onFileUpload = (
		_fileData: string,
		_name: string,
		isManualUpload: boolean,
		forceSaveToStore: boolean
	) => {
		// Handle .tht3d project file uploads
		if (isManualUpload && _fileData.startsWith('data:application/octet-stream')) {
			try {
				const fileDataRaw = atob(_fileData.replace('data:application/octet-stream;base64,', ''));

				const projectFileData = JSON.parse(fileDataRaw);
				const isValid = Project.safeParse(projectFileData);
				if (isValid.success) {
					// Restore all project elements
					$projectStore.circles = isValid.data.circles || [];
					$projectStore.rectangles = isValid.data.rectangles || [];
					$projectStore.legs = isValid.data.legs || [];

					// Recursively load embedded image (isManualUpload=false to skip prompts)
					onFileUpload(isValid.data.image, isValid.data.name, false, true);

					// Restore panel settings
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

		// Handle image file uploads
		pcbImage = document.createElement('img');

		// Image load success handler
		pcbImage.addEventListener('load', async () => {
			$projectStore.name = _name;
			if (pcbImage) {
				imageSize = { width: pcbImage.width, height: pcbImage.height };

				// Auto-calculate panel height based on aspect ratio for new uploads
				if (isManualUpload)
					$projectStore.panelSettings.height = Math.round(
						$projectStore.panelSettings.width * (imageSize.height / imageSize.width)
					);
				$projectStore.image = _fileData;
			}

			// Save to localStorage when needed
			if (isManualUpload || forceSaveToStore) {
				projectStore.update((value) => {
					value.image = _fileData;
					value.name = _name;
					return value;
				});
			}

			// Offer to resize large images (only for manual uploads)
			if (isManualUpload && pcbImage && (pcbImage.width > 1280 || pcbImage.height > 1024)) {
				const { confirmed, width } = await showModalResizeImage(pcbImage.width, pcbImage.height);
				if (confirmed) {
					const height = width * (pcbImage.height / pcbImage.width);
					try {
						// Use canvas API to resize
						const image = await loadImage(_fileData.toString());
						const canvas = createCanvas(width, height);
						const context = canvas.getContext('2d');
						context.drawImage(image, 0, 0, width, height);

						// Emulate load again with resized image
						isManualUpload = false; // Skip resize prompt on recursive call
						_fileData = canvas.toDataURL('image/jpeg', 0.9);
						if (pcbImage) pcbImage.src = _fileData;

						// Clean up canvas memory
						canvas.width = 0;
						canvas.height = 0;
					} catch {
						errorMessage = 'Failed to resize image';
						return;
					}
				}
			}

			// Open project settings dialog for manual uploads
			if (isManualUpload) {
				const confirmed = await openProjectSettings();
				if (!confirmed) {
					// User cancelled - reset state
					pcbImage = undefined;
					imageSize = undefined;
					$projectStore.image = '';
					$projectStore.name = '';
				}
			}
		});

		// Image load error handler
		pcbImage.addEventListener('error', () => {
			pcbImage = undefined;
			$projectStore.image = '';
			$projectStore.name = '';
			errorMessage = 'Cannot load image';
		});

		// Trigger image load
		pcbImage.src = _fileData;
		errorMessage = '';
	};
</script>

<Dropzone
	description="Click to upload or drag and drop a file. Image file (png, jpg) begins a new project, a .tht3d file restores a previously saved project."
	{errorMessage}
	onUpload={(imgData, filename) =>
		onFileUpload(imgData, filename.slice(0, Math.max(0, filename.lastIndexOf('.'))), true, false)}
	title="Top view of PCB image or a project file"
/>
