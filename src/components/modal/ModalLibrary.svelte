<script lang="ts">
	import { A, Button, ButtonGroup, Card, Modal } from 'flowbite-svelte';
	import { EditOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import { createEventDispatcher } from 'svelte';

	import FileInput from '$components/FileInput.svelte';
	import { virtualDownload } from '$lib/download';
	import { libraryStore } from '$stores/libraryStore';
	import { showModalNameEdit } from '$stores/modalStore';
	import { Library, LibraryItem } from '$types/Library';

	const dispatch = createEventDispatcher<{ resolve: { trigger: 'custom' } }>();
	const resolve = () => dispatch('resolve', { trigger: 'custom' });

	let fileInput: FileInput;

	const exportLibrary = () =>
		virtualDownload('tht3d_library.json', JSON.stringify($libraryStore, undefined, 2));

	const importLibrary = () =>
		fileInput.selectTextFile((filename, data) => {
			const parseResult = Library.safeParse(JSON.parse(data));
			if (parseResult.success) $libraryStore = parseResult.data;
		});

	const editName = async (libraryItem: LibraryItem) => {
		const { confirmed, name } = await showModalNameEdit(libraryItem.name);
		if (confirmed) libraryItem.name = name;
	};
</script>

<Modal open={true} size="lg">
	<div class="grid grid-cols-2">
		<h3 class="text-xl font-medium text-gray-900 dark:text-white">Library</h3>
		<ButtonGroup class="justify-self-end">
			<Button on:click={() => importLibrary()}>Import</Button>
			<Button on:click={() => exportLibrary()}>Export</Button>
		</ButtonGroup>
	</div>
	<div class="grid grid-cols-3 gap-2">
		{#each $libraryStore.sort((a, b) => a.name.localeCompare(b.name)) as libraryItem}
			<Card class="relative">
				<h5 class="mb-2 text-md font-bold tracking-tight text-gray-900 dark:text-white">
					{libraryItem.name}
				</h5>
				<A class="absolute right-4 text-gray" on:click={() => editName(libraryItem)}
					><EditOutline size="sm" /></A
				>
				<p class="font-semibold">{libraryItem.type}</p>
				{#if libraryItem.type === 'circle'}
					<p>R: {libraryItem.radius}mm</p>
					<p>Z: {libraryItem.depth}mm</p>
				{:else if libraryItem.type === 'rectangle'}
					<p>X: {libraryItem.width}mm</p>
					<p>Y: {libraryItem.height}mm</p>
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
	<div class="text-right mt-4">
		<Button on:click={() => resolve()} color="alternative" class="ml-2">Close</Button>
	</div>
</Modal>

<FileInput accept="application/json" bind:this={fileInput} />
