<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Canvas } from '@threlte/core';
	import { Button, ButtonGroup, Modal, Toggle } from 'flowbite-svelte';
	import { createEventDispatcher, onMount } from 'svelte';

	import {
		generateBinaryStlFromVertices,
		generateStlFromVertices,
		getBinaryStlSizeKbFromVertices
	} from '$lib/3d/stl';
	import { virtualDownload } from '$lib/download';
	import { MathMax } from '$lib/Math';
	import type { MeshInfoTuple } from '$types/MeshInfo';

	import Mesh3DScene from '../Mesh3DScene.svelte';
	import EscapeClose from './util/EscapeClose.svelte';

	const dispatch = createEventDispatcher<{ resolve: object }>();
	const resolve = () => dispatch('resolve', {});

	export let name: string;
	export let meshInfoTuple: Promise<MeshInfoTuple>;

	let volume: number;
	onMount(async () => {
		await meshInfoTuple
			.then((m) => (volume = MathMax([...m.main.vertexArray.values()])))
			.catch(() => (volume = 1));
	});

	let wireframe: boolean = false;
	let hollow: boolean = false;

	const generateFilename = () => name + '.stl';

	const downloadStlFile = async (isBinary: boolean) => {
		try {
			const meshinfotuple = await meshInfoTuple;
			const vertices = (hollow ? meshinfotuple.hollow : meshinfotuple.main).vertexArray;
			virtualDownload(
				generateFilename(),
				isBinary
					? generateBinaryStlFromVertices(vertices)
					: generateStlFromVertices(vertices).join('\n')
			);
		} catch {
			/**/
		}
	};
</script>

<EscapeClose on:escape={() => resolve()}>
	<Modal open={true} size="lg" classBackdrop="bg-black/50" dismissable={false}>
		<div class="flex justify-start">
			<span class="font-semibold mr-4">
				{generateFilename()}
			</span>

			{#await meshInfoTuple}
				<p>Generating mesh...</p>
			{:then meshInfoTuple}
				{(hollow ? meshInfoTuple.hollow : meshInfoTuple.main).dimensions.width} x
				{(hollow ? meshInfoTuple.hollow : meshInfoTuple.main).dimensions.height} x
				{(hollow ? meshInfoTuple.hollow : meshInfoTuple.main).dimensions.depth} mm |
				{(hollow ? meshInfoTuple.hollow : meshInfoTuple.main).vertexArray.length / 9} polygons |
				{getBinaryStlSizeKbFromVertices(
					(hollow ? meshInfoTuple.hollow : meshInfoTuple.main).vertexArray.length
				)} kB
			{:catch message}
				<span class="text-red-500 text-xl">Error '{message}' occured while rendering mesh</span>
			{/await}
		</div>
		<div class="grid grid-cols-2">
			<div class="flex justify-start">
				{#await meshInfoTuple}
					{''}
				{:then}
					<Toggle id="wireframe" bind:checked={wireframe}>Wireframe</Toggle>
					<Toggle id="hollow" class="ml-4" bind:checked={hollow}>Hollow top layer</Toggle>
				{:catch}
					{''}
				{/await}
			</div>
			<div class="flex justify-end">
				{#await meshInfoTuple}
					{''}
				{:then}
					<ButtonGroup>
						<Button color="primary" onclick={() => downloadStlFile(true)}>
							<Icon icon="mdi:download" class="inline-flex mr-2" width={24} />
							Download STL</Button
						>
						<Button onclick={() => downloadStlFile(false)}>Text STL</Button>
					</ButtonGroup>
				{:catch}
					{''}
				{/await}
				<Button class="ml-2" onclick={() => resolve()} color="alternative">Close</Button>
			</div>
		</div>
		<div class="canvasContainer">
			<Canvas>
				{#await meshInfoTuple}
					{''}
				{:then meshInfoTuple}
					{#if hollow}
						<Mesh3DScene vertices={meshInfoTuple.hollow.vertexArray} {volume} {wireframe} />
					{:else}
						<Mesh3DScene vertices={meshInfoTuple.main.vertexArray} {volume} {wireframe} />
					{/if}
				{:catch}
					{''}
				{/await}
			</Canvas>
		</div>
	</Modal>
</EscapeClose>

<style>
	.canvasContainer {
		width: 100%;
		height: 75vh;
		background: #888;
		background: linear-gradient(-45deg, #888 0%, #ccc 100%);
	}
</style>
