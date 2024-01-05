<script lang="ts">
	import '../app.postcss';

	import { Button, Dropdown, DropdownDivider, DropdownItem } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { ChevronDownOutline, VideoSolid } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { Circle, Image, type KonvaDragTransformEvent, Layer, Rect, Stage } from 'svelte-konva';

	import { base } from '$app/paths';
	import Dropzone from '$components/Dropzone.svelte';
	import ModalCircleSettings from '$components/modal/ModalCircleSettings.svelte';
	import ModalConfirm from '$components/modal/ModalConfirm.svelte';
	import ModalMeshDisplay from '$components/modal/ModalMeshDisplay.svelte';
	import ModalPanelSettings from '$components/modal/ModalPanelSettings.svelte';
	import ModalRectangleSettings from '$components/modal/ModalRectangleSettings.svelte';
	import { generateMeshLazy } from '$lib/3d/mesh';
	import { virtualDownload } from '$lib/download';
	import { preferencesStore } from '$stores/projectStore';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import { LEG_SIZE, type LegData } from '$types/LegData';
	import type { PanelSettings } from '$types/PanelSettings';
	import { Project } from '$types/Project';
	import { RectangleData } from '$types/RectangleData';

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
	/*global __PKG_VERSION__*/
	const APP_VERSION = __PKG_VERSION__;

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
		const meshInfo = generateMeshLazy({ panelSettings, rectangles, circles, legs, imageSize });
		modalMeshDisplay.open(filename, meshInfo);
	};

	const limitBox = (event: KonvaDragTransformEvent, box: RectangleData | LegData) => {
		const target = event.detail.target;
		const maxX = panelSettings.width - ('sizeX' in box ? box.sizeX : LEG_SIZE);
		const maxY = panelSettings.height - ('sizeY' in box ? box.sizeY : LEG_SIZE);

		if (target.x() < 0) target.x(0);
		if (target.x() > maxX) target.x(maxX);
		if (target.y() < 0) target.y(0);
		if (target.y() > maxY) target.y(maxY);
	};
	const limitCircle = (event: KonvaDragTransformEvent, circle: CircleData) => {
		const target = event.detail.target;
		const minX = circle.diameter / 2;
		const minY = circle.diameter / 2;
		const maxX = panelSettings.width - circle.diameter / 2;
		const maxY = panelSettings.height - circle.diameter / 2;

		if (target.x() < minX) target.x(minX);
		if (target.x() > maxX) target.x(maxX);
		if (target.y() < minY) target.y(minY);
		if (target.y() > maxY) target.y(maxY);
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
		<span class="ml-2 self-center whitespace-nowrap text-sm dark:text-white">v{APP_VERSION}</span>
	</NavBrand>
	<div class="flex md:order-2">
		<Button disabled={!pcbImage} on:click={() => openDisplay()}
			><VideoSolid class="mr-2" /> Display 3D</Button
		>
		<NavHamburger />
	</div>
	<NavUl class="order-1">
		{#if pcbImage}
			<NavLi class="cursor-pointer">
				File<ChevronDownOutline class="w-3 h-3 ms-2 text-primary-800 dark:text-white inline" />
			</NavLi>
			<Dropdown class="w-44 z-20">
				<DropdownItem href="#" on:click={reset}>New</DropdownItem>
				<DropdownItem href="#" on:click={downloadProjectFile}>Save project...</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="#" on:click={openPanelSettings}>Panel settings</DropdownItem>
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
		<Dropzone
			title="Top view of PCB image or a project file"
			description="Click to upload or drag and drop a file. Image files (png, jpg) begin a new project, a .tht3d file restores a previously saved project."
			onUpload={(imgData, filename) => onFileUpload(imgData, filename, true, false)}
		/>
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
						on:dragmove={(event) => limitCircle(event, circle)}
					/>
				{/each}
				{#each rectangles as rectangle}
					<Rect
						bind:config={rectangle.konvaConfig}
						on:dblclick={() => dblClickRectangle(rectangle)}
						on:dragend={storeRectangleChanges}
						on:dragmove={(event) => limitBox(event, rectangle)}
					/>
				{/each}
				{#each legs as leg}
					<Rect
						bind:config={leg.konvaConfig}
						on:dblclick={() => dblClickLeg(leg)}
						on:dragend={storeLegChanges}
						on:dragmove={(event) => limitBox(event, leg)}
					/>
				{/each}
			</Layer>
		</Stage>
	{/if}
</div>
