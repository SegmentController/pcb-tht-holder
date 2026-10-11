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

	Demo projects:
	- <DemoPicker> under the dropzone lists the boards from lib/demos.ts
	- A click fetches public/demo/<file>.tht3d and loads it through loadProjectData(),
	  the same path as an uploaded .tht3d file (validation, store write, embedded image)

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
	import Dropzone from '$components/base/input/Dropzone.svelte';
	import DemoPicker from '$components/DemoPicker.svelte';
	import { type Demo, demoUrl } from '$lib/demos';
	import { showModalResizeImage } from '$stores/modalStore';
	import { projectStore } from '$stores/projectStore';
	import type { ImageSize } from '$types/ImageSize';
	import { Project } from '$types/Project';

	import { openProjectSettings } from './AppNavigation.svelte';
	/*global __BASE_URL__*/
	const BASE_URL = __BASE_URL__;

	/** Bound to parent - receives loaded image element */
	export let pcbImage: HTMLImageElement | undefined;

	/** Bound to parent - triggers state transition to designer when set */
	export let imageSize: ImageSize | undefined;

	/** Error message displayed below dropzone */
	let errorMessage: string = '';

	/**
	 * Validates parsed project JSON and restores it: elements and panel settings are written to the
	 * store, then the embedded image goes through the regular image path (no resize / settings prompt).
	 * Shared by `.tht3d` uploads and demo projects. Sets `errorMessage` on invalid data.
	 */
	const loadProjectData = (projectFileData: unknown) => {
		const isValid = Project.safeParse(projectFileData);
		if (!isValid.success) {
			errorMessage = 'Cannot load project file: Invalid format';
			return;
		}

		// Restore all project elements, panel settings, label and zoom in a single store write
		projectStore.update((value) => {
			value.circles = isValid.data.circles || [];
			value.rectangles = isValid.data.rectangles || [];
			value.legs = isValid.data.legs || [];
			value.panelSettings = isValid.data.panelSettings;
			value.label = isValid.data.label;
			value.zoom = isValid.data.zoom;
			return value;
		});

		// Recursively load embedded image (isManualUpload=false to skip prompts)
		onFileUpload(isValid.data.image, isValid.data.name, false, true);
		errorMessage = '';
	};

	/** Id of the demo being fetched, empty when idle */
	let loadingDemoId = '';

	/** Fetches a demo project from `public/demo/` and loads it like an uploaded project file */
	const loadDemo = async (demo: Demo) => {
		if (loadingDemoId) return;
		loadingDemoId = demo.id;
		try {
			const response = await fetch(demoUrl(BASE_URL, demo.file));
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			loadProjectData(await response.json());
		} catch (error) {
			errorMessage = `Cannot load demo: ${error instanceof Error ? error.message : error}`;
		} finally {
			loadingDemoId = '';
		}
	};

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
				loadProjectData(JSON.parse(fileDataRaw));
			} catch (error) {
				errorMessage = `Cannot load project file: ${error instanceof Error ? error.message : error}`;
			}
			return;
		}

		// Handle image file uploads
		pcbImage = document.createElement('img');

		// Image load success handler
		pcbImage.addEventListener('load', async () => {
			if (pcbImage) {
				imageSize = { width: pcbImage.width, height: pcbImage.height };

				// Persist once (the multi-MB image is serialized on every store write).
				// Auto-restore from localStorage already has image and name in the store: no write.
				if (isManualUpload || forceSaveToStore) {
					const { width, height } = imageSize;
					projectStore.update((value) => {
						// A new project starts from the image: aspect-ratio based panel height, no leftover label
						if (isManualUpload) {
							value.panelSettings.height = Math.round(value.panelSettings.width * (height / width));
							value.label = '';
						}
						value.image = _fileData;
						value.name = _name;
						return value;
					});
				}
			}

			// Offer to resize large images (only for manual uploads)
			if (isManualUpload && pcbImage && (pcbImage.width > 1280 || pcbImage.height > 1024)) {
				const { confirmed, width } = await showModalResizeImage(pcbImage.width, pcbImage.height);
				if (confirmed) {
					const height = width * (pcbImage.height / pcbImage.width);
					try {
						// Use canvas API to resize (the loaded element already holds the decoded image)
						const canvas = document.createElement('canvas');
						canvas.width = Math.round(width);
						canvas.height = Math.round(height);
						const context = canvas.getContext('2d');
						if (!context) throw new Error('2D canvas not available');
						context.drawImage(pcbImage, 0, 0, canvas.width, canvas.height);

						// Emulate load again with resized image
						isManualUpload = false; // Skip resize prompt on recursive call
						forceSaveToStore = true; // ...but persist the resized image on that load
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
					projectStore.update((value) => {
						value.image = '';
						value.name = '';
						return value;
					});
				}
			}
		});

		// Image load error handler
		pcbImage.addEventListener('error', () => {
			pcbImage = undefined;
			projectStore.update((value) => {
				value.image = '';
				value.name = '';
				return value;
			});
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
<DemoPicker loadingId={loadingDemoId} onSelect={loadDemo} />
