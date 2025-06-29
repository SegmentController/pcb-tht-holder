<script lang="ts">
	import Icon from '@iconify/svelte';
	import { A, Button, ButtonGroup, Card, Modal } from 'flowbite-svelte';
	import { createEventDispatcher } from 'svelte';

	import FileInput from '$components/base/input/FileInput.svelte';
	import { virtualDownload } from '$lib/download';
	import { libraryStore } from '$stores/libraryStore';
	import { showModalNameEdit } from '$stores/modalStore';
	import { Library, LibraryItem } from '$types/Library';

	import EscapeClose from './util/EscapeClose.svelte';

	const dispatch = createEventDispatcher<{ resolve: object }>();
	const resolve = () => dispatch('resolve', {});

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
	<Modal dismissable={false} open={true} size="lg" title="Library">
		<div class="grid">
			<ButtonGroup class="justify-self-end">
				<Button onclick={() => importLibrary()}>Import</Button>
				<Button disabled={$libraryStore.length === 0} onclick={() => exportLibrary()}>Export</Button
				>
			</ButtonGroup>
		</div>
		<div class="grid grid-cols-3 gap-2 pt-4">
			{#each $libraryStore.sort((a, b) => a.name.localeCompare(b.name)) as libraryItem}
				<Card class="relative" color="gray">
					<h5 class="mb-2 text-md font-bold tracking-tight text-gray-900 dark:text-white">
						{libraryItem.name}
					</h5>
					<A class="absolute right-4 text-gray" onclick={() => editName(libraryItem)}>
						<Icon class="inline-flex" icon="mdi:edit" />
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
						onclick={() => {
							$libraryStore = $libraryStore.filter((li) => li !== libraryItem);
						}}
					>
						<Icon class="inline-flex" icon="mdi:trash" />
					</A>
				</Card>
			{/each}
		</div>
		<div class="text-right pt-4">
			<Button class="ml-2" color="alternative" onclick={() => resolve()}>Close</Button>
		</div>
	</Modal>
</EscapeClose>

<FileInput bind:this={fileInput} accept="application/json" />
