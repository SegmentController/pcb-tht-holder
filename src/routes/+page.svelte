<script lang="ts">
	import '../app.postcss';

	import { shortcut } from '@svelte-put/shortcut';
	import { Button, Dropdown, DropdownDivider, DropdownItem, Kbd } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { ChevronDownOutline, ChevronRightSolid, VideoSolid } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		Circle,
		Image,
		type KonvaDragTransformEvent,
		type KonvaMouseEvent,
		Layer,
		Rect,
		Stage
	} from 'svelte-konva';

	import { base } from '$app/paths';
	import ContextMenu from '$components/ContextMenu.svelte';
	import Dropzone from '$components/Dropzone.svelte';
	import { generateMeshLazy } from '$lib/3d/mesh';
	import { virtualDownload } from '$lib/download';
	import {
		addNewCircle,
		getContextMenuItemForCircle,
		modifyCircle,
		updateCircleChanges
	} from '$lib/elements/circle';
	import {
		addNewLeg,
		deleteLeg,
		getContextMenuItemForLeg,
		updateLegChanges
	} from '$lib/elements/leg';
	import {
		addNewRectangle,
		getContextMenuItemForRectangle,
		modifyRectangle,
		updateRectangleChanges
	} from '$lib/elements/rectangle';
	import { libraryStore } from '$stores/libraryStore';
	import {
		showModalConfirm,
		showModalLibrary,
		showModalMesh,
		showModalPanelSettings
	} from '$stores/modalStore';
	import { projectJsonSerializer, projectStore } from '$stores/projectStore';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import { LEG_SIZE, type LegData } from '$types/LegData';
	import { LibraryItem } from '$types/Library';
	import { Project } from '$types/Project';
	import { RectangleData } from '$types/RectangleData';

	onMount(() => {
		const preferences = get(projectStore);
		if (preferences.image && preferences.filename) {
			onFileUpload(preferences.image, preferences.filename, false, false);
		}
	});
	/*global __PKG_VERSION__*/
	const APP_VERSION = __PKG_VERSION__;

	let pcbImage: HTMLImageElement | undefined;
	let imageSize: ImageSize | undefined;

	const onFileUpload = (
		_fileData: string,
		_filename: string,
		isManualUpload: boolean,
		forceSaveToStore: boolean
	) => {
		if (isManualUpload && _fileData.startsWith('data:application/octet-stream'))
			try {
				const fileDataRaw = atob(_fileData.replace('data:application/octet-stream;base64,', ''));

				const projectFileData = JSON.parse(fileDataRaw);
				const isValid = Project.safeParse(projectFileData);
				if (isValid.success) {
					$projectStore.circles = isValid.data.circles || [];
					$projectStore.rectangles = isValid.data.rectangles || [];
					$projectStore.legs = isValid.data.legs || [];
					onFileUpload(isValid.data.image, isValid.data.filename, false, true);
					$projectStore.panelSettings = isValid.data.panelSettings;
					return;
				}
			} catch {
				document;
			}

		pcbImage = document.createElement('img');
		pcbImage.addEventListener('load', () => {
			$projectStore.filename = _filename;
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
					value.filename = _filename;
					return value;
				});
			}
			if (isManualUpload) openPanelSettings();
		});
		pcbImage.addEventListener('error', () => {
			pcbImage = undefined;
			$projectStore.image = '';
			$projectStore.filename = '';
		});
		pcbImage.src = _fileData;
	};

	const downloadProjectFile = () => {
		const projectData: Project = {
			image: $projectStore.image,
			filename: $projectStore.filename,
			panelSettings: $projectStore.panelSettings,
			circles: $projectStore.circles,
			rectangles: $projectStore.rectangles,
			legs: $projectStore.legs
		};
		const projectDataJsonString = projectJsonSerializer.stringify(projectData);

		virtualDownload(
			$projectStore.filename.slice(0, Math.max(0, $projectStore.filename.lastIndexOf('.'))) +
				'.tht3d',
			projectDataJsonString
		);
	};

	const reset = async () => {
		const { confirmed } = await showModalConfirm('Are you sure to reset PCB panel?');
		if (confirmed) {
			pcbImage = undefined;
			imageSize = undefined;
			projectStore.update((value) => {
				value.image = '';
				value.filename = '';
				value.circles = [];
				value.rectangles = [];
				value.legs = [];
				return value;
			});
		}
	};

	const openPanelSettings = async () => {
		const { confirmed, settings } = await showModalPanelSettings($projectStore.panelSettings);
		if (confirmed) {
			projectStore.update((value) => {
				value.panelSettings = settings;
				return value;
			});
		}
	};

	const addItemFromLibrary = (libraryItem: LibraryItem) => {
		switch (libraryItem.type) {
			case 'circle': {
				addNewCircle({
					radius: libraryItem.radius,
					depth: libraryItem.depth
				});
				break;
			}
			case 'rectangle': {
				addNewRectangle({
					width: libraryItem.width,
					height: libraryItem.height,
					depth: libraryItem.depth
				});
				break;
			}
		}
	};

	const openDisplay = () => {
		if (!imageSize) return;
		const meshInfo = generateMeshLazy({
			panelSettings: $projectStore.panelSettings,
			rectangles: $projectStore.rectangles,
			circles: $projectStore.circles,
			legs: $projectStore.legs
		});
		showModalMesh($projectStore.filename, meshInfo);
	};

	const limitBox = (event: KonvaDragTransformEvent, box: RectangleData | LegData) => {
		const target = event.detail.target;
		const maxX = $projectStore.panelSettings.width - ('sizeX' in box ? box.width : LEG_SIZE);
		const maxY = $projectStore.panelSettings.height - ('sizeY' in box ? box.height : LEG_SIZE);

		if (target.x() < 0) target.x(0);
		if (target.x() > maxX) target.x(maxX);
		if (target.y() < 0) target.y(0);
		if (target.y() > maxY) target.y(maxY);
	};
	const limitCircle = (event: KonvaDragTransformEvent, circle: CircleData) => {
		const target = event.detail.target;
		const minX = circle.radius;
		const minY = circle.radius;
		const maxX = $projectStore.panelSettings.width - circle.radius;
		const maxY = $projectStore.panelSettings.height - circle.radius;

		if (target.x() < minX) target.x(minX);
		if (target.x() > maxX) target.x(maxX);
		if (target.y() < minY) target.y(minY);
		if (target.y() > maxY) target.y(maxY);
	};

	let contextMenu: ContextMenu;
	const stageClick = (event: KonvaMouseEvent) => {
		if (event.detail.evt.button === 2) {
			const id = event.detail.target.id();

			for (const retriever of [
				getContextMenuItemForCircle,
				getContextMenuItemForRectangle,
				getContextMenuItemForLeg
			]) {
				const items = retriever(id);
				if (items !== undefined) {
					contextMenu.setItems(items);
					contextMenu.toggleAt(event.detail.evt.pageX, event.detail.evt.pageY);
					return;
				}
			}
		}
	};
</script>

<svelte:window
	use:shortcut={{
		trigger: [
			{ key: 'C', modifier: ['shift'], callback: () => addNewCircle() },
			{ key: 'R', modifier: ['shift'], callback: () => addNewRectangle() },
			{ key: 'L', modifier: ['shift'], callback: () => addNewLeg() },
			{ key: 'P', modifier: ['shift'], callback: () => openPanelSettings() },
			{ key: 'd', callback: () => openDisplay() }
		]
	}}
/>

<Navbar>
	<NavBrand href="#">
		<img src="{base}/favicon.png" class="me-3 h-6 sm:h-9" alt="PCB THT Holder Logo" />
		<span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white"
			>PCB THT Holder</span
		>
		<span class="ml-2 self-center whitespace-nowrap text-sm dark:text-white">v{APP_VERSION}</span>
	</NavBrand>
	{#if pcbImage}
		<div class="flex md:order-2">
			<Button disabled={!pcbImage} on:click={() => openDisplay()}>
				<VideoSolid class="mr-2" />
				Display 3D
				<Kbd class="ml-4 px-2 py-1">D</Kbd>
			</Button>
			<NavHamburger />
		</div>
		<NavUl class="order-1">
			<NavLi class="cursor-pointer">
				File<ChevronDownOutline class="w-3 h-3 ms-2 text-primary-800 dark:text-white inline" />
			</NavLi>
			<Dropdown class="w-60 z-20">
				<DropdownItem href="#" on:click={() => reset()}>New</DropdownItem>
				<DropdownItem href="#" on:click={() => downloadProjectFile()}>Save project</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="#" on:click={() => openPanelSettings()}>
					Panel settings...
					<Kbd class="float-right px-2">shift + P</Kbd>
				</DropdownItem>
			</Dropdown>
			<NavLi class="cursor-pointer">
				Component<ChevronDownOutline class="w-3 h-3 ms-2 text-primary-800 dark:text-white inline" />
			</NavLi>
			<Dropdown class="w-60 z-20">
				<DropdownItem href="#" on:click={() => addNewCircle()}>
					Add circle...
					<Kbd class="float-right px-2">shift + C</Kbd>
				</DropdownItem>
				<DropdownItem href="#" on:click={() => addNewRectangle()}>
					Add rectangle...
					<Kbd class="float-right px-2">shift + R</Kbd>
				</DropdownItem>
				<DropdownItem href="#" on:click={() => addNewLeg()}>
					Add leg
					<Kbd class="float-right px-2">shift + L</Kbd>
				</DropdownItem>
				{#if $libraryStore.length}
					<DropdownItem class="flex items-center justify-between">
						Add from library<ChevronRightSolid
							class="w-3 h-3 ms-2 text-primary-700 dark:text-white"
						/>
					</DropdownItem>
					<Dropdown class="w-auto min-w-44 z-20" placement="right-start">
						{#each $libraryStore.sort((a, b) => a.name.localeCompare(b.name)) as libraryItem}
							<DropdownItem on:click={() => addItemFromLibrary(libraryItem)}
								>{libraryItem.name} ({libraryItem.type})</DropdownItem
							>
						{/each}
					</Dropdown>
				{/if}
				<DropdownDivider />
				<DropdownItem href="#" on:click={() => showModalLibrary()}>Library...</DropdownItem>
			</Dropdown>
		</NavUl>
	{/if}
</Navbar>

<div class="flex justify-center">
	<p class="text-sm">{$projectStore.filename}</p>
	{#if imageSize}
		<p class="text-sm text-gray-500">({imageSize.width}x{imageSize.height})</p>
	{/if}
</div>
<div class="flex justify-center">
	{#if !pcbImage}
		<Dropzone
			title="Top view of PCB image or a project file"
			description="Click to upload or drag and drop a file. Image file (png, jpg) begins a new project, a .tht3d file restores a previously saved project."
			onUpload={(imgData, filename) => onFileUpload(imgData, filename, true, false)}
		/>
	{:else if imageSize}
		<Stage
			on:click={stageClick}
			config={{
				width: imageSize.width,
				height: imageSize.height,
				scaleX: imageSize.width / $projectStore.panelSettings.width,
				scaleY: imageSize.height / $projectStore.panelSettings.height
			}}
		>
			<Layer>
				<Image
					config={{
						image: pcbImage,
						scaleX: $projectStore.panelSettings.width / imageSize.width,
						scaleY: (-1 * $projectStore.panelSettings.height) / imageSize.height,
						offsetY: imageSize.height,
						opacity: 0.25
					}}
				/>
				<ContextMenu bind:this={contextMenu} />
				{#each $projectStore.circles as circle}
					<Circle
						bind:config={circle}
						on:dblclick={() => modifyCircle(circle)}
						on:dragmove={(event) => limitCircle(event, circle)}
						on:dragend={() => updateCircleChanges()}
					/>
				{/each}
				{#each $projectStore.rectangles as rectangle}
					<Rect
						bind:config={rectangle}
						on:dblclick={() => modifyRectangle(rectangle)}
						on:dragmove={(event) => limitBox(event, rectangle)}
						on:dragend={() => updateRectangleChanges()}
					/>
				{/each}
				{#each $projectStore.legs as leg}
					<Rect
						bind:config={leg}
						on:dblclick={() => deleteLeg(leg)}
						on:dragmove={(event) => limitBox(event, leg)}
						on:dragend={() => updateLegChanges()}
					/>
				{/each}
			</Layer>
		</Stage>
	{/if}
</div>
