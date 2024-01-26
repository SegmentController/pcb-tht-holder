<script lang="ts">
	import { A, Button, ButtonGroup, Card, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import FileInput from '$components/base/input/FileInput.svelte';
	import { virtualDownload } from '$lib/download';
	import { libraryStore } from '$stores/libraryStore';
	import { showModalNameEdit } from '$stores/modalStore';
	import { Library, LibraryItem } from '$types/Library';

	import EscapeClose from './util/EscapeClose.svelte';

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

<EscapeClose on:escape={() => resolve()}>
	<Modal open={true} size="lg" bodyClass="space-y-0" dismissable={false} title="Library">
		<div class="grid">
			<ButtonGroup class="justify-self-end">
				<Button on:click={() => importLibrary()}>Import</Button>
				<Button on:click={() => exportLibrary()} disabled={$libraryStore.length === 0}
					>Export</Button
				>
			</ButtonGroup>
		</div>
		<div class="grid grid-cols-3 gap-2 pt-4">
			{#each $libraryStore.sort((a, b) => a.name.localeCompare(b.name)) as libraryItem}
				<Card class="relative" color="form">
					<h5 class="mb-2 text-md font-bold tracking-tight text-gray-900 dark:text-white">
						{libraryItem.name}
					</h5>
					<A class="absolute right-4 text-gray" on:click={() => editName(libraryItem)}>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M5 3c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7H5V5h7V3zm12.78 1a.69.69 0 0 0-.48.2l-1.22 1.21l2.5 2.5L19.8 6.7c.26-.26.26-.7 0-.95L18.25 4.2c-.13-.13-.3-.2-.47-.2m-2.41 2.12L8 13.5V16h2.5l7.37-7.38z"
							/></svg
						>
					</A>
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
						}}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3zm0 5h2v9H9zm4 0h2v9h-2z"
							/></svg
						>
					</A>
				</Card>
			{/each}
		</div>
		<div class="text-right pt-4">
			<Button on:click={() => resolve()} color="alternative" class="ml-2">Close</Button>
		</div>
	</Modal>
</EscapeClose>

<FileInput accept="application/json" bind:this={fileInput} />
