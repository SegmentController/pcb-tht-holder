<script lang="ts">
	import { A, Button, ButtonGroup, Card, Modal } from 'flowbite-svelte';
	import { EditOutline, TrashBinOutline } from 'flowbite-svelte-icons';

	import { virtualDownload } from '$lib/download';
	import { libraryStore } from '$stores/libraryStore';
	import { Library } from '$types/Library';

	import ModalNameEdit from './ModalNameEdit.svelte';

	let isOpen: boolean = false;

	export const open = (): void => {
		isOpen = true;
	};

	let modalNameEdit: ModalNameEdit;
	let fileInput: HTMLInputElement;

	const exportLibrary = () =>
		virtualDownload('library.thtlib', JSON.stringify($libraryStore, undefined, 2));

	const importLibrary = async (event: Event) => {
		const files = (event.target as HTMLInputElement).files;
		if (files && files.length > 0) {
			try {
				const textData = await files[0].text();
				const parseResult = Library.safeParse(JSON.parse(textData));
				if (parseResult.success) $libraryStore = parseResult.data;
			} catch (error) {
				error;
			}
		}
	};
</script>

<Modal open={isOpen} size="md" dismissable={false}>
	<h3 class="text-xl font-medium text-gray-900 dark:text-white">Library</h3>
	<div class="grid grid-cols-3 gap-2">
		{#each $libraryStore.sort((a, b) => a.name.localeCompare(b.name)) as libraryItem}
			<Card class="relative">
				<h5 class="mb-2 text-md font-bold tracking-tight text-gray-900 dark:text-white">
					{libraryItem.name}
				</h5>
				<A
					class="absolute right-4 text-gray"
					on:click={() => {
						modalNameEdit.open(libraryItem.name, (name) => {
							libraryItem.name = name;
						});
					}}><EditOutline size="sm" /></A
				>
				<p class="font-semibold">{libraryItem.type}</p>
				{#if libraryItem.type === 'circle'}
					<p>D: {libraryItem.diameter}mm</p>
					<p>Z: {libraryItem.depth}mm</p>
				{:else if libraryItem.type === 'rectangle'}
					<p>X: {libraryItem.sizeX}mm</p>
					<p>Y: {libraryItem.sizeY}mm</p>
					<p>Z: {libraryItem.depth}mm</p>
				{/if}
				<A
					class="absolute bottom-4 right-4"
					on:click={() => {
						$libraryStore = $libraryStore.filter((li) => li !== libraryItem);
					}}><TrashBinOutline size="sm" /></A
				>
			</Card>
		{/each}
	</div>
	<div class="text-right">
		<ButtonGroup>
			<Button on:click={() => fileInput.click()}>Import</Button>
			<Button on:click={() => exportLibrary()}>Export</Button>
		</ButtonGroup>
		<Button on:click={() => (isOpen = false)} color="alternative" class="ml-2">Close</Button>
	</div>
</Modal>

<ModalNameEdit bind:this={modalNameEdit} />

<input type="file" bind:this={fileInput} on:change={importLibrary} />

<style>
	input {
		display: none;
	}
</style>
