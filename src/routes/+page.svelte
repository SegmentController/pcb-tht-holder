<script lang="ts">
	import '../app.postcss';

	import { Button, Dropdown, DropdownDivider, DropdownItem } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { Circle, Image, Layer, Rect, Stage } from 'svelte-konva';

	import { base } from '$app/paths';
	import ModalCircleSettings from '$components/ModalCircleSettings.svelte';
	import ModalConfirm from '$components/ModalConfirm.svelte';
	import ModalMeshDisplay from '$components/ModalMeshDisplay.svelte';
	import ModalPanelSettings, { type PanelSettings } from '$components/ModalPanelSettings.svelte';
	import ModalRectangleSettings from '$components/ModalRectangleSettings.svelte';
	import PcbImageDropzone from '$components/PcbImageDropzone.svelte';
	import { generateMesh, polygonsToVertexArray } from '$lib/3d/mesh';
	import { generateStl } from '$lib/3d/stl';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import type { RectangleData } from '$types/RectangleData';

	import { preferencesStore } from '../store/projectStore';

	onMount(() => {
		const preferences = get(preferencesStore);
		if (preferences.image && preferences.filename) {
			circles = preferences.circles;
			rectangles = preferences.rectangles;

			onImageUpload(preferences.image, preferences.filename, false);

			panelSettings = preferences.panelSettings;
		}
	});

	let circles: CircleData[] = [];
	let rectangles: RectangleData[] = [];

	let pcbImage: HTMLImageElement | undefined;
	let filename: string = '';
	let size: ImageSize | undefined;

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

	const onImageUpload = (_imageData: string, _filename: string, isManualUpload = true) => {
		pcbImage = document.createElement('img');
		pcbImage.addEventListener('load', () => {
			filename = _filename;
			if (pcbImage) {
				size = { width: pcbImage.width, height: pcbImage.height };
				if (isManualUpload)
					panelSettings.height = Math.round(panelSettings.width * (size.height / size.width));
			}
			if (isManualUpload) {
				preferencesStore.update((value) => {
					value.image = _imageData;
					value.filename = _filename;
					return value;
				});
				openPanelSettings();
			}
		});
		pcbImage.addEventListener('error', () => {
			pcbImage = undefined;
			filename = '';
		});
		pcbImage.src = _imageData;
	};

	const reset = () =>
		modalConfirm.open('Are you sure to reset PCB panel?', () => {
			pcbImage = undefined;
			filename = '';
			size = undefined;
			circles = [];
			rectangles = [];
			preferencesStore.update((value) => {
				value.image = '';
				value.filename = '';
				value.circles = [];
				value.rectangles = [];
				return value;
			});
		});

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
		modalCircleSettings.open(circle, (recent) => {
			circle.diameter = recent.diameter;
			circle.depth = recent.depth;
			circle.konvaConfig.radius = circle.diameter / 2;
			circles = circles;
			storeCircleChanges();
		});
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
	const storeRectangleChanges = () =>
		preferencesStore.update((value) => {
			value.rectangles = rectangles;
			return value;
		});

	const openDisplay = () => {
		const meshPolygons = generateMesh({ panelSettings, rectangles, circles });
		const vertices = polygonsToVertexArray(meshPolygons);
		const stl = generateStl(meshPolygons);
		modalMeshDisplay.open(filename, vertices, stl);
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
				Add<ChevronDownOutline class="w-3 h-3 ms-2 text-primary-800 dark:text-white inline" />
			</NavLi>
			<Dropdown class="w-44 z-20">
				<DropdownItem href="#" on:click={addCircle}>Circle</DropdownItem>
				<DropdownItem href="#" on:click={addRectangle}>Rectangle</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="#">Leg</DropdownItem>
			</Dropdown>
			<NavLi href="#" on:click={openPanelSettings}>Panel settings</NavLi>
			<NavLi href="#" on:click={reset}>Reset</NavLi>
		{/if}
	</NavUl>
</Navbar>

<div class="flex justify-center">
	<p class="text-sm">{filename}</p>
	{#if size}
		<p class="text-sm text-gray-500">({size.width}x{size.height})</p>
	{/if}
</div>
<div class="flex justify-center">
	{#if !pcbImage}
		<PcbImageDropzone onUpload={onImageUpload} />
	{:else if typeof window !== 'undefined' && size}
		<Stage
			config={{
				width: size.width,
				height: size.height,
				scaleX: size.width / panelSettings.width,
				scaleY: size.height / panelSettings.height
			}}
		>
			<Layer>
				<Image
					config={{
						image: pcbImage,
						scaleX: panelSettings.width / size.width,
						scaleY: (-1 * panelSettings.height) / size.height,
						offsetY: size.height,
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
			</Layer>
		</Stage>
	{/if}
</div>
