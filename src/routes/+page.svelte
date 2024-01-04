<script lang="ts">
	import '../app.postcss';

	import { Button, Dropdown, DropdownDivider, DropdownItem } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { Circle, Image, Layer, Rect, Stage } from 'svelte-konva';

	import { base } from '$app/paths';
	import FileDropzone from '$components/FileDropzone.svelte';
	import ModalCircleSettings from '$components/ModalCircleSettings.svelte';
	import ModalConfirm from '$components/ModalConfirm.svelte';
	import ModalMeshDisplay from '$components/ModalMeshDisplay.svelte';
	import ModalPanelSettings from '$components/ModalPanelSettings.svelte';
	import ModalRectangleSettings from '$components/ModalRectangleSettings.svelte';
	import { generateMesh, polygonsToVertexArray } from '$lib/3d/mesh';
	import { generateStl } from '$lib/3d/stl';
	import { virtualDownload } from '$lib/download';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import { LEG_SIZE, type LegData } from '$types/LegData';
	import type { PanelSettings } from '$types/PanelSettings';
	import { Project } from '$types/Project';
	import type { RectangleData } from '$types/RectangleData';

	import { preferencesStore } from '../store/projectStore';

	onMount(() => {
		const preferences = get(preferencesStore);
		if (preferences.image && preferences.filename) {
			circles = preferences.circles || [];
			rectangles = preferences.rectangles || [];
			legs = preferences.legs || [];
			onFileUpload(preferences.image, preferences.filename, false, false);
			panelSettings = preferences.panelSettings;
		}
	});

	let circles: CircleData[] = [];
	let rectangles: RectangleData[] = [];
	let legs: LegData[] = [];

	let pcbImage: HTMLImageElement | undefined;
	let imageData: string;
	let filename: string = '';
	let imageSize: ImageSize | undefined;

	let modalConfirm: ModalConfirm;
	let modalPanelSettings: ModalPanelSettings;
	let modalCircleSettings: ModalCircleSettings;
	let modalRectangleSettings: ModalRectangleSettings;
	let modalMeshDisplay: ModalMeshDisplay;

	let panelSettings: PanelSettings = {
		width: 100,
		height: 80,
		pcbThickness: 1.6,
		smdHeight: 3
	};

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
					circles = isValid.data.circles || [];
					rectangles = isValid.data.rectangles || [];
					legs = isValid.data.legs || [];
					onFileUpload(isValid.data.image, isValid.data.filename, false, true);
					panelSettings = isValid.data.panelSettings;

					preferencesStore.update((value) => {
						value.circles = circles;
						value.rectangles = rectangles;
						value.legs = legs;
						value.panelSettings = panelSettings;
						return value;
					});
					return;
				}
			} catch {
				document;
			}

		pcbImage = document.createElement('img');
		pcbImage.addEventListener('load', () => {
			filename = _filename;
			if (pcbImage) {
				imageSize = { width: pcbImage.width, height: pcbImage.height };
				if (isManualUpload)
					panelSettings.height = Math.round(
						panelSettings.width * (imageSize.height / imageSize.width)
					);
				imageData = _fileData;
			}
			if (isManualUpload || forceSaveToStore) {
				preferencesStore.update((value) => {
					value.image = _fileData;
					value.filename = _filename;
					return value;
				});
			}
			if (isManualUpload) openPanelSettings();
		});
		pcbImage.addEventListener('error', () => {
			pcbImage = undefined;
			imageData = '';
			filename = '';
		});
		pcbImage.src = _fileData;
	};

	const downloadProjectFile = () => {
		const projectData: Project = {
			image: imageData,
			filename,
			panelSettings,
			circles,
			rectangles,
			legs
		};
		const projectDataJsonString = JSON.stringify(projectData, undefined, 2);

		virtualDownload(
			filename.slice(0, Math.max(0, filename.lastIndexOf('.'))) + '.tht3d',
			projectDataJsonString
		);
	};

	const reset = () => {
		if (!pcbImage && !filename) return;

		modalConfirm.open('Are you sure to reset PCB panel?', () => {
			pcbImage = undefined;
			filename = '';
			imageSize = undefined;
			circles = [];
			rectangles = [];
			legs = [];
			preferencesStore.update((value) => {
				value.image = '';
				value.filename = '';
				value.circles = [];
				value.rectangles = [];
				value.legs = [];
				return value;
			});
		});
	};

	const openPanelSettings = () =>
		modalPanelSettings.open(panelSettings, (recentSettings) => {
			panelSettings = recentSettings;
			preferencesStore.update((value) => {
				value.panelSettings = recentSettings;
				return value;
			});
		});

	const addCircle = () => {
		const circle: CircleData = {
			depth: 5,
			diameter: 10,
			konvaConfig: {
				draggable: true,
				fill: 'orange',
				opacity: 0.75,
				x: panelSettings.width / 2,
				y: panelSettings.height / 2,
				radius: 10
			}
		};
		circles.push(circle);
		circles = circles;
		storeCircleChanges();
		modalCircleSettings.open(circle, (recent) => {
			circle.diameter = recent.diameter;
			circle.depth = recent.depth;
			circle.konvaConfig.radius = circle.diameter / 2;
			circles = circles;
			storeCircleChanges();
		});
	};
	const dblClickCircle = (circle: CircleData) => {
		modalCircleSettings.open(
			circle,
			(recent) => {
				circle.diameter = recent.diameter;
				circle.depth = recent.depth;
				circle.konvaConfig.radius = circle.diameter / 2;
				circles = circles;
				storeCircleChanges();
			},
			() => {
				circles = circles.filter((c) => c != circle);
				storeCircleChanges();
			}
		);
	};
	const storeCircleChanges = () =>
		preferencesStore.update((value) => {
			value.circles = circles;
			return value;
		});

	const addRectangle = () => {
		const rectangle: RectangleData = {
			depth: 5,
			sizeX: 10,
			sizeY: 5,
			konvaConfig: {
				draggable: true,
				fill: 'green',
				opacity: 0.75,
				x: panelSettings.width / 2,
				y: panelSettings.height / 2,
				width: 10,
				height: 5
			}
		};
		rectangles.push(rectangle);
		rectangles = rectangles;
		storeRectangleChanges();
		modalRectangleSettings.open(rectangle, (recent) => {
			rectangle.sizeX = recent.sizeX;
			rectangle.sizeY = recent.sizeY;
			rectangle.depth = recent.depth;
			rectangle.konvaConfig.width = rectangle.sizeX;
			rectangle.konvaConfig.height = rectangle.sizeY;
			rectangles = rectangles;
			storeRectangleChanges();
		});
	};
	const dblClickRectangle = (rectangle: RectangleData) => {
		modalRectangleSettings.open(
			rectangle,
			(recent) => {
				rectangle.sizeX = recent.sizeX;
				rectangle.sizeY = recent.sizeY;
				rectangle.depth = recent.depth;
				rectangle.konvaConfig.width = rectangle.sizeX;
				rectangle.konvaConfig.height = rectangle.sizeY;
				rectangles = rectangles;
				storeRectangleChanges();
			},
			() => {
				rectangles = rectangles.filter((r) => r != rectangle);
				storeRectangleChanges();
			}
		);
	};
	const storeRectangleChanges = () =>
		preferencesStore.update((value) => {
			value.rectangles = rectangles;
			return value;
		});

	const addLeg = () => {
		const leg: LegData = {
			konvaConfig: {
				draggable: true,
				fill: 'gray',
				opacity: 0.75,
				x: panelSettings.width / 2,
				y: panelSettings.height / 2,
				width: LEG_SIZE,
				height: LEG_SIZE
			}
		};
		legs.push(leg);
		legs = legs;
		storeLegChanges();
	};
	const dblClickLeg = (leg: LegData) => {
		legs = legs.filter((l) => l != leg);
		storeLegChanges();
	};
	const storeLegChanges = () =>
		preferencesStore.update((value) => {
			value.legs = legs;
			return value;
		});

	const openDisplay = () => {
		if (!imageSize) return;
		const meshPolygons = generateMesh({ panelSettings, rectangles, circles, legs, imageSize });
		const vertices = polygonsToVertexArray(meshPolygons.polygons);
		const stl = generateStl(meshPolygons.polygons);
		modalMeshDisplay.open(filename, meshPolygons.dimensions, vertices, stl);
	};
</script>

<ModalConfirm bind:this={modalConfirm} />
<ModalPanelSettings bind:this={modalPanelSettings} />
<ModalCircleSettings bind:this={modalCircleSettings} />
<ModalRectangleSettings bind:this={modalRectangleSettings} />
<ModalMeshDisplay bind:this={modalMeshDisplay} />

<Navbar>
	<NavBrand href="#">
		<img src="{base}/favicon.png" class="me-3 h-6 sm:h-9" alt="PCB THT Holder Logo" />
		<span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white"
			>PCB THT Holder</span
		>
	</NavBrand>
	<div class="flex md:order-2">
		<Button disabled={!pcbImage} on:click={() => openDisplay()}>Display 3D</Button>
		<NavHamburger />
	</div>
	<NavUl class="order-1">
		{#if pcbImage}
			<NavLi class="cursor-pointer">
				File<ChevronDownOutline class="w-3 h-3 ms-2 text-primary-800 dark:text-white inline" />
			</NavLi>
			<Dropdown class="w-44 z-20">
				<DropdownItem href="#" on:click={reset}>New</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="#" on:click={downloadProjectFile}>Export project</DropdownItem>
			</Dropdown>
			<NavLi class="cursor-pointer">
				Component<ChevronDownOutline class="w-3 h-3 ms-2 text-primary-800 dark:text-white inline" />
			</NavLi>
			<Dropdown class="w-44 z-20">
				<DropdownItem href="#" on:click={addCircle}>Add circle</DropdownItem>
				<DropdownItem href="#" on:click={addRectangle}>Add rectangle</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="#" on:click={addLeg}>Add leg</DropdownItem>
			</Dropdown>
			<NavLi href="#" on:click={openPanelSettings}>Panel settings</NavLi>
		{/if}
	</NavUl>
</Navbar>

<div class="flex justify-center">
	<p class="text-sm">{filename}</p>
	{#if imageSize}
		<p class="text-sm text-gray-500">({imageSize.width}x{imageSize.height})</p>
	{/if}
</div>
<div class="flex justify-center">
	{#if !pcbImage}
		<FileDropzone onUpload={(imgData, filename) => onFileUpload(imgData, filename, true, false)} />
	{:else if typeof window !== 'undefined' && imageSize}
		<Stage
			config={{
				width: imageSize.width,
				height: imageSize.height,
				scaleX: imageSize.width / panelSettings.width,
				scaleY: imageSize.height / panelSettings.height
			}}
		>
			<Layer>
				<Image
					config={{
						image: pcbImage,
						scaleX: panelSettings.width / imageSize.width,
						scaleY: (-1 * panelSettings.height) / imageSize.height,
						offsetY: imageSize.height,
						opacity: 0.25
					}}
				/>
				{#each circles as circle}
					<Circle
						bind:config={circle.konvaConfig}
						on:dblclick={() => dblClickCircle(circle)}
						on:dragend={storeCircleChanges}
					/>
				{/each}
				{#each rectangles as rectangle}
					<Rect
						bind:config={rectangle.konvaConfig}
						on:dblclick={() => dblClickRectangle(rectangle)}
						on:dragend={storeRectangleChanges}
					/>
				{/each}
				{#each legs as leg}
					<Rect
						bind:config={leg.konvaConfig}
						on:dblclick={() => dblClickLeg(leg)}
						on:dragend={storeLegChanges}
					/>
				{/each}
			</Layer>
		</Stage>
	{/if}
</div>
