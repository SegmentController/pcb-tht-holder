<!--
	Navigation Bar and Global Keyboard Shortcuts Component

	This component serves a dual purpose:

	1. **Navigation UI** (Flowbite Navbar):
	   - Application branding with logo and version number
	   - Mode selection buttons (Pointer/Measure)
	   - Menu system: File, Edit, Library
	   - Display button for 3D mesh preview

	2. **Global Keyboard Shortcut Handler** (svelte:window):
	   - Binds 20+ keyboard shortcuts for efficient workflow
	   - Mode selection: P (pointer), M (measure)
	   - Element creation: Ctrl+C (circle), Ctrl+R (rectangle), Ctrl+L (leg)
	   - Element manipulation: Arrow keys (move), F (flip), R (rotate)
	   - System operations: Ctrl+Z (undo), Ctrl+P (settings), D (display)

	**Keyboard Shortcuts System:**

	All shortcuts are defined using the `shortcut` action from `$lib/shortcut` and bound
	to `svelte:window` for global availability. This architecture ensures shortcuts work
	regardless of which element has focus.

	**Shortcut Categories:**

	1. **Mode Selection** (lines 168-180):
	   - P: Pointer mode (drag/edit elements)
	   - M: Measure mode (distance tool)

	2. **Element Creation** (lines 182-194):
	   - Ctrl+C / Cmd+C: Add circle
	   - Ctrl+R / Cmd+R: Add rectangle
	   - Ctrl+L / Cmd+L: Add leg

	3. **Element Manipulation** (lines 209-272):
	   - Arrow keys: Fine move (0.1mm per press)
	   - Shift+Arrow keys: Move 5x faster (0.5mm per press)
	   - F: Flip rectangle dimensions (swap width/height)
	   - R: Rotate rectangle +5°
	   - Shift+R: Reset rectangle rotation to 0°

	4. **System Operations** (lines 196-207):
	   - Ctrl+Z / Cmd+Z: Undo last operation
	   - Ctrl+P / Cmd+P: Open project settings
	   - D: Display 3D mesh preview

	**Menu Operations:**

	- **File Menu:**
	  - New: Reset project (clears all elements and image)
	  - Save project: Download .tht3d file with all project data

	- **Edit Menu:**
	  - Undo: Restore previous state
	  - Add circle/rectangle/leg: Create new elements with default properties
	  - Auto legs at corner: Generate support legs at panel corners
	  - Delete all legs: Remove all support legs
	  - Add from library: Insert saved component templates

	- **Library:** Manage component templates (circles/rectangles with saved dimensions)

	**Design Pattern:**

	Module-level script exports `openProjectSettings()` for use by other components
	(AppDropzone.svelte calls it after image upload). This allows the modal to be
	triggered both from keyboard shortcut and programmatically.
-->
<script lang="ts" module>
	import { persisted } from 'svelte-persisted-store';

	/**
	 * Persisted alignment toggle state
	 * Stored in localStorage to remember user preference across sessions
	 */
	export const alignmentEnabled = persisted('alignmentEnabled', true);

	/**
	 * Opens project settings modal and updates project store if confirmed
	 *
	 * Module-level function exported for programmatic access from other components.
	 * Used by AppDropzone.svelte after image upload to prompt for panel settings.
	 *
	 * **Modal Fields:**
	 * - Panel dimensions (width, height)
	 * - PCB thickness
	 * - SMD component clearance height
	 * - Print tolerance compensation
	 * - Project name
	 * - Optional text label for 3D engraving
	 *
	 * @returns Promise that resolves to true if user confirmed, false if cancelled
	 */
	export const openProjectSettings = async () => {
		const projectStore = getProjectStoreValue();
		const { confirmed, panelSettings, name, label } = await showModalProjectSettings(
			projectStore.panelSettings,
			projectStore.name,
			projectStore.label
		);
		if (confirmed)
			updateProjectStoreValue((value) => {
				value.panelSettings = panelSettings;
				value.name = name;
				value.label = label;
				return value;
			});
		return confirmed;
	};
</script>

<script lang="ts">
	import Icon from '@iconify/svelte';
	import {
		Button,
		ButtonGroup,
		Dropdown,
		DropdownDivider,
		DropdownItem,
		Kbd,
		Navbar,
		NavBrand,
		NavLi,
		NavUl,
		Toggle,
		Tooltip
	} from 'flowbite-svelte';
	import NavContainer from 'flowbite-svelte/NavContainer.svelte';
	import { createEventDispatcher } from 'svelte';

	import { generateMeshLazy } from '$lib/3d/mesh';
	import { virtualDownload } from '$lib/download';
	import { addNewCircle } from '$lib/elements/circle';
	import { addCornerLegs, addNewLeg, deleteAllLegsWithConfirm } from '$lib/elements/leg';
	import { addNewRectangle } from '$lib/elements/rectangle';
	import {
		finemoveSelectedElement,
		flipSelectedRectangleDimensions,
		resetSelectedRectangleRotation,
		rotateSelectedRectangleDegrees
	} from '$lib/fineMovement';
	import { shortcut } from '$lib/shortcut';
	import { getLibraryStoreValue } from '$stores/libraryStore';
	import {
		showModalConfirm,
		showModalLibrary,
		showModalMesh,
		showModalProjectSettings
	} from '$stores/modalStore';
	import {
		getProjectStoreLegCount,
		getProjectStoreValue,
		projectJsonSerializer,
		projectStore,
		updateProjectStoreValue
	} from '$stores/projectStore';
	import { executeLastUndo, undoStoreLastItem } from '$stores/undoStore';
	import type { LibraryItem } from '$types/Library';
	import type { Project } from '$types/Project';

	import type { DesignerMode } from './AppDesigner.svelte';
	/*global __PKG_VERSION__*/
	const APP_VERSION = __PKG_VERSION__;
	/*global __BASE_URL__*/
	const BASE_URL = __BASE_URL__;

	export let projectLoaded: boolean;
	export let mode: DesignerMode;

	const dispatch = createEventDispatcher<{
		reset: void;
	}>();

	/**
	 * Resets project to initial state after confirmation
	 *
	 * Triggered by File > New menu item. Shows confirmation dialog before:
	 * - Clearing loaded PCB image
	 * - Resetting project name
	 * - Removing all circles, rectangles, and legs
	 * - Resetting zoom to 100%
	 * - Dispatching 'reset' event to parent (App.svelte) to return to dropzone view
	 *
	 * **Panel settings are preserved** (width, height, thickness, SMD height, tolerance)
	 * to allow quick reload of new PCB images with same dimensions.
	 */
	const reset = async () => {
		const { confirmed } = await showModalConfirm('Are you sure to reset PCB panel?');
		if (confirmed) {
			dispatch('reset');
			updateProjectStoreValue((value) => {
				value.image = '';
				value.name = '';
				value.zoom = 100;
				value.circles = [];
				value.rectangles = [];
				value.legs = [];
				return value;
			});
		}
	};

	/**
	 * Adds a component from the library to the current project
	 *
	 * Triggered from Edit > Add from library submenu. Creates a new circle or
	 * rectangle element using saved dimensions from the library.
	 *
	 * **Library Item Properties:**
	 * - **Circle**: radius, depth
	 * - **Rectangle**: width, height, depth, rotation
	 *
	 * New element is positioned at default location (center of panel) and can
	 * be immediately dragged to desired position.
	 *
	 * @param libraryItem - Saved component template from library store
	 */
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
					depth: libraryItem.depth,
					rotation: libraryItem.rotation
				});
				break;
			}
		}
	};

	/**
	 * Downloads complete project as .tht3d file
	 *
	 * Triggered by File > Save project menu item. Serializes entire project state
	 * to JSON and initiates browser download.
	 *
	 * **File Format (.tht3d):**
	 * - Base64-encoded JSON containing:
	 *   - PCB image (base64 data URL)
	 *   - Project name and optional label
	 *   - Panel settings (dimensions, thickness, tolerance)
	 *   - All circles, rectangles, and legs
	 * - Can be restored by dragging back into application
	 * - Validated with Zod schema on load
	 *
	 * **JSON Serialization:**
	 * Uses `projectJsonSerializer` to exclude Konva internal properties
	 * (fill, draggable, opacity) that are not part of the data model.
	 */
	const downloadProjectFile = () => {
		const projectData: Project = {
			image: $projectStore.image,
			name: $projectStore.name,
			zoom: $projectStore.zoom,
			label: $projectStore.label,
			panelSettings: $projectStore.panelSettings,
			circles: $projectStore.circles,
			rectangles: $projectStore.rectangles,
			legs: $projectStore.legs
		};
		const projectDataJsonString = projectJsonSerializer.stringify(projectData);

		virtualDownload($projectStore.name + '.tht3d', projectDataJsonString);
	};

	/**
	 * Generates 3D meshes and opens display/export modal
	 *
	 * Triggered by Display button or D keyboard shortcut. Generates three mesh
	 * variants and shows preview modal with export options.
	 *
	 * **Generated Meshes:**
	 * 1. **Main Mesh** (default): Full-depth holder with component holes
	 *    - Height: pcbThickness + smdHeight
	 *    - Component holes: SUBTRACTION operations with full depth
	 *    - Support legs: ADDITION operations at correct height
	 *
	 * 2. **Hollow Mesh**: Material-saving variant with reduced internal depth
	 *    - Outer walls full height, internal cavity reduced
	 *    - Saves filament and print time
	 *
	 * 3. **Positive Mesh** (PCB visualization): Inverted design showing components
	 *    - Components appear as pillars instead of holes
	 *    - Useful for verifying component placement
	 *    - Adjustable distance slider for gap between PCB and holder
	 *
	 * **CSG Operations:**
	 * Uses three-bvh-csg library for boolean operations (ADDITION/SUBTRACTION)
	 * on Three.js BufferGeometry.
	 *
	 * **Export Options:**
	 * Modal provides STL download for each mesh variant in both text and binary formats.
	 */
	const openDisplay = () => {
		if (!projectLoaded) return;

		const meshGenerator = (onProgress: (current: number, total: number) => void) =>
			generateMeshLazy(
				{
					panelSettings: $projectStore.panelSettings,
					zoom: $projectStore.zoom,
					label: $projectStore.label,
					rectangles: $projectStore.rectangles,
					circles: $projectStore.circles,
					legs: $projectStore.legs
				},
				onProgress
			);

		showModalMesh($projectStore.name, meshGenerator);
	};

	/**
	 * Mode selection button configuration
	 *
	 * Defines the two operational modes for the designer canvas:
	 * - Pointer: Default mode for component manipulation
	 * - Measure: Distance measurement tool with grid overlay
	 */
	const ModeButtons = [
		{
			title: 'Pointer',
			shortcut: 'P',
			recentMode: 'pointer' as DesignerMode,
			icon: 'mdi:button-pointer'
		},
		{
			title: 'Measure',
			shortcut: 'M',
			recentMode: 'measure' as DesignerMode,
			icon: 'mdi:tape-measure'
		}
	];
</script>

<svelte:window
	use:shortcut={{
		trigger: [
			{
				key: 'p',
				callback: () => {
					mode = 'pointer';
				},
				preventDefault: true
			},
			{
				key: 'm',
				callback: () => {
					mode = 'measure';
				},
				preventDefault: true
			},

			{
				key: 'c',
				modifier: ['ctrl', 'meta'],
				callback: () => addNewCircle(),
				preventDefault: true
			},
			{
				key: 'r',
				modifier: ['ctrl', 'meta'],
				callback: () => addNewRectangle(),
				preventDefault: true
			},
			{ key: 'l', modifier: ['ctrl', 'meta'], callback: addNewLeg, preventDefault: true },
			{
				key: 'z',
				modifier: ['ctrl', 'meta'],
				callback: executeLastUndo,
				preventDefault: true
			},
			{
				key: 'p',
				modifier: ['ctrl', 'meta'],
				callback: openProjectSettings,
				preventDefault: true
			},
			{ key: 'd', callback: openDisplay, preventDefault: true },
			{
				key: 'ArrowLeft',
				callback: () => finemoveSelectedElement('left'),
				preventDefault: true
			},
			{
				key: 'ArrowRight',
				callback: () => finemoveSelectedElement('right'),
				preventDefault: true
			},
			{
				key: 'ArrowUp',
				callback: () => finemoveSelectedElement('up'),
				preventDefault: true
			},
			{
				key: 'ArrowDown',
				callback: () => finemoveSelectedElement('down'),
				preventDefault: true
			},
			{
				key: 'ArrowLeft',
				modifier: ['shift'],
				callback: () => finemoveSelectedElement('left', 5),
				preventDefault: true
			},
			{
				key: 'ArrowRight',
				modifier: ['shift'],
				callback: () => finemoveSelectedElement('right', 5),
				preventDefault: true
			},
			{
				key: 'ArrowUp',
				modifier: ['shift'],
				callback: () => finemoveSelectedElement('up', 5),
				preventDefault: true
			},
			{
				key: 'ArrowDown',
				modifier: ['shift'],
				callback: () => finemoveSelectedElement('down', 5),
				preventDefault: true
			},
			{
				key: 'f',
				callback: flipSelectedRectangleDimensions,
				preventDefault: true
			},
			{
				key: 'F',
				callback: flipSelectedRectangleDimensions,
				preventDefault: true
			},
			{
				key: 'r',
				callback: () => rotateSelectedRectangleDegrees(5),
				preventDefault: true
			},
			{
				key: 'R',
				modifier: ['shift'],
				callback: resetSelectedRectangleRotation,
				preventDefault: true
			}
		]
	}}
/>

<Navbar class="bg-gray-100">
	<NavContainer class="border border-gray-200 w-3/5 px-5 py-2 rounded-lg bg-gray-50">
		<NavBrand href="#">
			<img class="me-3 h-6 sm:h-9" alt="PCB THT Holder Logo" src="{BASE_URL}/pcb-board-32.png" />
			<span class="self-center whitespace-nowrap font-semibold">
				<div class="text-inherit hover:no-underline">PCB THT Holder</div>
				<div class="text-xs text-gray-500">v{APP_VERSION}</div>
			</span>
		</NavBrand>
		{#if projectLoaded}
			<div class="flex items-center gap-3">
				<ButtonGroup>
					{#each ModeButtons as { title, shortcut, recentMode, icon }}
						<Button
							checked={mode === recentMode}
							color={mode === recentMode ? 'gray' : 'light'}
							onclick={() => (mode = recentMode)}
							size="xs"
						>
							<Icon {icon} width={20} />
							<Tooltip placement="bottom-end" type="light">
								{title}
								<Kbd class="px-2 py-0">{shortcut}</Kbd>
							</Tooltip>
						</Button>
					{/each}
				</ButtonGroup>
				<Toggle id="alignment" size="small" bind:checked={$alignmentEnabled}>Align</Toggle>
			</div>
			<NavUl class="flex">
				<NavLi class="cursor-pointer">
					File
					<Icon class="inline-flex" icon="mdi:chevron-down" />
				</NavLi>
				<Dropdown class="w-60 z-20 -mt-2" simple trigger="hover">
					<DropdownItem class="w-full text-left" onclick={reset}>New</DropdownItem>
					<DropdownItem class="w-full text-left" onclick={downloadProjectFile}
						>Save project</DropdownItem
					>
				</Dropdown>

				<NavLi class="cursor-pointer">
					Edit
					<Icon class="inline-flex" icon="mdi:chevron-down" />
				</NavLi>
				<Dropdown class="w-72 z-20 -mt-2" simple trigger="hover">
					{#if $undoStoreLastItem}
						<DropdownItem class="w-full text-left" onclick={executeLastUndo}
							>Undo: {$undoStoreLastItem}
							<Kbd class="float-right px-2 py-0">ctrl + Z</Kbd>
						</DropdownItem>
						<DropdownDivider />
					{/if}
					<DropdownItem class="w-full text-left" onclick={() => addNewCircle()}>
						Add circle...
						<Kbd class="float-right px-2 py-0">ctrl + C</Kbd>
					</DropdownItem>
					<DropdownItem class="w-full text-left" onclick={() => addNewRectangle()}>
						Add rectangle...
						<Kbd class="float-right px-2 py-0">ctrl + R</Kbd>
					</DropdownItem>
					<DropdownItem class="w-full text-left" onclick={addNewLeg}>
						Add leg
						<Kbd class="float-right px-2 py-0">ctrl + L</Kbd>
					</DropdownItem>
					<DropdownItem class="w-full text-left" onclick={addCornerLegs}
						>Auto legs at corner</DropdownItem
					>
					{#if getProjectStoreLegCount()}
						<DropdownItem class="w-full text-left" onclick={deleteAllLegsWithConfirm}
							>Delete all legs</DropdownItem
						>
					{/if}
					{#if getLibraryStoreValue().length}
						<DropdownItem class="flex items-center justify-between">
							Add from library
							<Icon class="inline-flex" icon="mdi:chevron-right" />
						</DropdownItem>
						<Dropdown class="min-w-44 z-20" placement="right-start" trigger="hover">
							{#each getLibraryStoreValue().toSorted( (a, b) => a.name.localeCompare(b.name) ) as libraryItem}
								<DropdownItem onclick={() => addItemFromLibrary(libraryItem)}>
									{libraryItem.name} ({libraryItem.type})
								</DropdownItem>
							{/each}
						</Dropdown>
					{/if}
					<DropdownDivider />
					<DropdownItem class="w-full text-left" onclick={openProjectSettings}>
						Project settings...
						<Kbd class="float-right px-2 py-0">ctrl + P</Kbd>
					</DropdownItem>
				</Dropdown>
				<NavLi class="cursor-pointer" onclick={showModalLibrary}>Library</NavLi>
			</NavUl>
			<Button disabled={!projectLoaded} onclick={openDisplay}>
				<Icon class="inline-flex mr-2" icon="mdi:rotate-3d" width={24} />
				Display
				<Kbd class="ml-4 px-2 py-1">D</Kbd>
			</Button>
		{/if}
	</NavContainer>
</Navbar>
