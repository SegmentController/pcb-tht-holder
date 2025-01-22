<script lang="ts" module>
	export const openProjectSettings = async () => {
		const projectStore = getProjectStoreValue();
		const { confirmed, panelSettings, name, label } = await showModalProjectSettings(
			projectStore.panelSettings,
			projectStore.name,
			projectStore.label
		);
		if (confirmed) {
			updateProjectStoreValue((value) => {
				value.panelSettings = panelSettings;
				value.name = name;
				value.label = label;
				return value;
			});
		}
	};
</script>

<script lang="ts">
	import Icon from '@iconify/svelte';
	import {
		A,
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
		Tooltip
	} from 'flowbite-svelte';
	import NavContainer from 'flowbite-svelte/NavContainer.svelte';
	import { createEventDispatcher } from 'svelte';

	import { generateMeshLazy } from '$lib/3d/mesh';
	import { virtualDownload } from '$lib/download';
	import { addNewCircle } from '$lib/elements/circle';
	import { addCornerLegs, addNewLeg, deleteAllLegsWithConfirm } from '$lib/elements/leg';
	import { addNewRectangle } from '$lib/elements/rectangle';
	import { finemoveSelectedElement } from '$lib/fineMovement';
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

	const reset = async () => {
		const { confirmed } = await showModalConfirm('Are you sure to reset PCB panel?');
		if (confirmed) {
			dispatch('reset');
			updateProjectStoreValue((value) => {
				value.image = '';
				value.name = '';
				value.circles = [];
				value.rectangles = [];
				value.legs = [];
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

	const openDisplay = () => {
		if (!projectLoaded) return;

		const meshInfo = generateMeshLazy({
			panelSettings: $projectStore.panelSettings,
			zoom: $projectStore.zoom,
			label: $projectStore.label,
			rectangles: $projectStore.rectangles,
			circles: $projectStore.circles,
			legs: $projectStore.legs
		});
		showModalMesh($projectStore.name, meshInfo);
	};

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

			{ key: 'C', modifier: ['shift'], callback: () => addNewCircle(), preventDefault: true },
			{ key: 'R', modifier: ['shift'], callback: () => addNewRectangle(), preventDefault: true },
			{ key: 'L', modifier: ['shift'], callback: () => addNewLeg(), preventDefault: true },
			{
				key: 'z',
				modifier: ['ctrl', 'meta'],
				callback: () => executeLastUndo(),
				preventDefault: true
			},
			{
				key: 'P',
				modifier: ['shift'],
				callback: () => openProjectSettings(),
				preventDefault: true
			},
			{ key: 'd', callback: () => openDisplay(), preventDefault: true },
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
			}
		]
	}}
/>

<Navbar class="bg-gray-100">
	<NavContainer class="border w-3/5 px-5 py-2 rounded-lg bg-white">
		<NavBrand href="#">
			<img src="{BASE_URL}/pcb-board-32.png" class="me-3 h-6 sm:h-9" alt="PCB THT Holder Logo" />
			<span class="self-center whitespace-nowrap text-xl font-semibold">
				{#if projectLoaded}
					<A class="text-inherit hover:no-underline" onclick={() => openProjectSettings()}
						>{$projectStore.name}</A
					>
				{:else}
					PCB THT Holder
				{/if}
			</span>
			{#if !projectLoaded}
				<span class="ml-2 self-center whitespace-nowrap text-sm dark:text-white"
					>v{APP_VERSION}</span
				>
			{/if}
		</NavBrand>
		{#if projectLoaded}
			<div class="flex">
				<ButtonGroup>
					{#each ModeButtons as { title, shortcut, recentMode, icon }}
						<Button
							size="xs"
							checked={mode === recentMode}
							onclick={() => (mode = recentMode)}
							color={mode === recentMode ? 'dark' : 'light'}
						>
							<Icon {icon} width={20} />
						</Button>
						<Tooltip type="light" placement="bottom-end">
							{title}
							<Kbd class="px-2">{shortcut}</Kbd>
						</Tooltip>
					{/each}
				</ButtonGroup>
			</div>
			<NavUl class="flex">
				<NavLi class="cursor-pointer">
					File
					<Icon icon="mdi:chevron-down" class="inline-flex" />
				</NavLi>
				<Dropdown class="w-60 z-20 -mt-2" trigger="hover">
					<DropdownItem href="#" onclick={() => reset()}>New</DropdownItem>
					<DropdownItem href="#" onclick={() => downloadProjectFile()}>Save project</DropdownItem>
					<DropdownDivider />
					<DropdownItem href="#" onclick={() => openProjectSettings()}>
						Project settings...
						<Kbd class="float-right px-2">shift + P</Kbd>
					</DropdownItem>
				</Dropdown>

				<NavLi class="cursor-pointer">
					Edit
					<Icon icon="mdi:chevron-down" class="inline-flex" />
				</NavLi>
				<Dropdown class="w-72 z-20 -mt-2" trigger="hover">
					{#if $undoStoreLastItem}
						<DropdownItem href="#" onclick={() => executeLastUndo()}
							>Undo: {$undoStoreLastItem}
							<Kbd class="float-right px-2">ctrl + Z</Kbd>
						</DropdownItem>
						<DropdownDivider />
					{/if}
					<DropdownItem href="#" onclick={() => addNewCircle()}>
						Add circle...
						<Kbd class="float-right px-2">shift + C</Kbd>
					</DropdownItem>
					<DropdownItem href="#" onclick={() => addNewRectangle()}>
						Add rectangle...
						<Kbd class="float-right px-2">shift + R</Kbd>
					</DropdownItem>
					<DropdownItem href="#" onclick={() => addNewLeg()}>
						Add leg
						<Kbd class="float-right px-2">shift + L</Kbd>
					</DropdownItem>
					<DropdownItem href="#" onclick={() => addCornerLegs()}>Auto legs at corner</DropdownItem>
					{#if getProjectStoreLegCount()}
						<DropdownItem href="#" onclick={() => deleteAllLegsWithConfirm()}>
							Delete all legs
						</DropdownItem>
					{/if}
					{#if getLibraryStoreValue().length}
						<DropdownItem class="flex items-center justify-between">
							Add from library
							<Icon icon="mdi:chevron-right" class="inline-flex" />
						</DropdownItem>
						<Dropdown class="w-auto min-w-44 z-20" placement="right-start" trigger="hover">
							{#each getLibraryStoreValue().sort( (a, b) => a.name.localeCompare(b.name) ) as libraryItem}
								<DropdownItem onclick={() => addItemFromLibrary(libraryItem)}
									>{libraryItem.name} ({libraryItem.type})</DropdownItem
								>
							{/each}
						</Dropdown>
					{/if}
				</Dropdown>
				<NavLi class="cursor-pointer" onclick={() => showModalLibrary()}>Library</NavLi>
			</NavUl>
			<div class="flex">
				<Button disabled={!projectLoaded} onclick={() => openDisplay()}>
					<Icon icon="mdi:rotate-3d" class="inline-flex mr-2" width={24} />
					Display
					<Kbd class="ml-4 px-2 py-1">D</Kbd>
				</Button>
			</div>
		{/if}
	</NavContainer>
</Navbar>
