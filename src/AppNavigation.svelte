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
	import {
		A,
		Button,
		Dropdown,
		DropdownDivider,
		DropdownItem,
		Kbd,
		Navbar,
		NavBrand,
		NavLi,
		NavUl
	} from 'flowbite-svelte';
	import NavContainer from 'flowbite-svelte/NavContainer.svelte';
	import { createEventDispatcher } from 'svelte';

	import ChevronDown from '$components/icon/ChevronDown.svelte';
	import ChevronRight from '$components/icon/ChevronRight.svelte';
	import { generateMeshLazy } from '$lib/3d/mesh';
	import { virtualDownload } from '$lib/download';
	import { addNewCircle } from '$lib/elements/circle';
	import { addNewLeg } from '$lib/elements/leg';
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
		getProjectStoreValue,
		projectJsonSerializer,
		projectStore,
		updateProjectStoreValue
	} from '$stores/projectStore';
	import type { LibraryItem } from '$types/Library';
	import type { Project } from '$types/Project';
	/*global __PKG_VERSION__*/
	const APP_VERSION = __PKG_VERSION__;
	/*global __BASE_URL__*/
	const BASE_URL = __BASE_URL__;

	export let projectLoaded: boolean;
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
			label: $projectStore.label,
			rectangles: $projectStore.rectangles,
			circles: $projectStore.circles,
			legs: $projectStore.legs
		});
		showModalMesh($projectStore.name, meshInfo);
	};
</script>

<svelte:window
	use:shortcut={{
		trigger: [
			{ key: 'C', modifier: ['shift'], callback: () => addNewCircle(), preventDefault: true },
			{ key: 'R', modifier: ['shift'], callback: () => addNewRectangle(), preventDefault: true },
			{ key: 'L', modifier: ['shift'], callback: () => addNewLeg(), preventDefault: true },
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
	<NavContainer class="border w-3/5  px-5 py-2 rounded-lg bg-white">
		<NavBrand href="#">
			<img src="{BASE_URL}/pcb-board-32.png" class="me-3 h-6 sm:h-9" alt="PCB THT Holder Logo" />
			<span class="self-center whitespace-nowrap text-xl font-semibold">
				{#if projectLoaded}
					<A class="text-inherit hover:no-underline" on:click={() => openProjectSettings()}
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
			<NavUl class="flex">
				<NavLi class="cursor-pointer">
					File<ChevronDown class="ms-2 text-primary-800 dark:text-white inline" />
				</NavLi>
				<Dropdown class="w-60 z-20">
					<DropdownItem href="#" on:click={() => reset()}>New</DropdownItem>
					<DropdownItem href="#" on:click={() => downloadProjectFile()}>Save project</DropdownItem>
					<DropdownDivider />
					<DropdownItem href="#" on:click={() => openProjectSettings()}>
						Project settings...
						<Kbd class="float-right px-2">shift + P</Kbd>
					</DropdownItem>
				</Dropdown>
				<NavLi class="cursor-pointer">
					Component<ChevronDown class="ms-2 text-primary-800 dark:text-white inline" />
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
					{#if getLibraryStoreValue().length}
						<DropdownItem class="flex items-center justify-between">
							Add from library<ChevronRight class="ms-2 text-primary-700 dark:text-white" />
						</DropdownItem>
						<Dropdown class="w-auto min-w-44 z-20" placement="right-start">
							{#each getLibraryStoreValue().sort( (a, b) => a.name.localeCompare(b.name) ) as libraryItem}
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
			<div class="flex">
				<Button disabled={!projectLoaded} on:click={() => openDisplay()}>
					<svg
						class="mr-2"
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M7.47 21.5C4.2 19.94 1.86 16.76 1.5 13H0c.5 6.16 5.66 11 11.95 11l.66-.03l-3.81-3.81zm.89-6.54c-.19 0-.36-.03-.52-.08a1.07 1.07 0 0 1-.4-.24c-.11-.1-.2-.22-.26-.37c-.06-.14-.09-.3-.09-.47h-1.3c0 .36.07.7.21.95c.14.25.33.5.56.69c.24.18.51.32.82.41c.3.1.62.15.96.15c.37 0 .72-.05 1.03-.15c.32-.1.6-.25.83-.44c.23-.19.42-.41.55-.72c.13-.29.2-.61.2-.97c0-.19-.02-.38-.07-.56c-.05-.16-.12-.35-.23-.51c-.1-.15-.24-.3-.4-.43c-.17-.13-.37-.22-.61-.31a2.067 2.067 0 0 0 .89-.75c.1-.16.17-.3.22-.46c.05-.16.07-.32.07-.48c0-.36-.06-.68-.18-.96c-.14-.26-.29-.51-.51-.69c-.2-.19-.47-.33-.77-.43C9.05 8.05 8.71 8 8.34 8c-.34 0-.69.05-1 .16c-.3.11-.57.26-.79.45c-.21.19-.38.39-.51.67c-.12.26-.18.54-.18.85h1.3c0-.17.03-.32.09-.45a.94.94 0 0 1 .25-.34c.11-.09.23-.17.38-.22c.15-.05.3-.08.48-.08c.4 0 .7.1.89.31c.19.2.29.49.29.86c0 .18-.04.34-.08.49a.87.87 0 0 1-.25.37c-.11.1-.25.18-.41.24c-.16.06-.36.09-.58.09h-.77v1.03h.77c.22 0 .42.02.6.07s.33.13.45.23c.12.11.23.24.29.4c.07.16.1.37.1.57c0 .41-.12.72-.35.93c-.23.23-.55.33-.95.33m8.55-5.92c-.32-.33-.7-.59-1.14-.77c-.43-.18-.92-.27-1.46-.27h-2.36v8h2.3c.55 0 1.06-.09 1.51-.27c.45-.18.84-.43 1.16-.76c.32-.33.58-.73.74-1.19c.17-.47.26-.99.26-1.57v-.4c0-.58-.09-1.1-.26-1.57c-.16-.47-.43-.87-.75-1.2m-.41 3.16c0 .42-.03.8-.12 1.13c-.1.33-.24.62-.43.85c-.19.23-.45.41-.71.53c-.29.12-.62.18-.99.18h-.91V9.12h.97c.72 0 1.27.23 1.64.69c.38.46.55 1.12.55 1.99M11.95 0l-.66.03l3.81 3.81l1.33-1.34c3.27 1.56 5.61 4.73 5.96 8.5h1.5c-.5-6.16-5.65-11-11.94-11"
						/></svg
					>
					Display
					<Kbd class="ml-4 px-2 py-1">D</Kbd>
				</Button>
			</div>
		{/if}
	</NavContainer>
</Navbar>
