<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { Button, ButtonGroup, Modal, Toggle } from 'flowbite-svelte';
	import { DownloadSolid } from 'flowbite-svelte-icons';
	import { createEventDispatcher, onMount } from 'svelte';

	import type { MeshInfo } from '$lib/3d/mesh';
	import {
		generateBinaryStlFromVertices,
		generateStlFromVertices,
		getBinaryStlSizeKbFromVertices
	} from '$lib/3d/stl';
	import { virtualDownload } from '$lib/download';
	import { MathMax } from '$lib/Math';

	import Mesh3DScene from '../Mesh3DScene.svelte';

	const dispatch = createEventDispatcher<{ resolve: { trigger: 'custom' } }>();
	const resolve = () => dispatch('resolve', { trigger: 'custom' });

	export let filename: string;
	export let meshInfo: Promise<MeshInfo>;

	let volume: number;
	onMount(async () => {
		await meshInfo
			.then((m) => (volume = MathMax([...m.vertexArray.values()])))
			.catch(() => (volume = 1));
	});

	let wireframe: boolean = false;

	const generateFilename = () => filename.slice(0, Math.max(0, filename.lastIndexOf('.'))) + '.stl';

	const downloadStlFile = async (isBinary: boolean) => {
		try {
			const meshinfo = await meshInfo;
			virtualDownload(
				generateFilename(),
				isBinary
					? generateBinaryStlFromVertices(meshinfo.vertexArray)
					: generateStlFromVertices(meshinfo.vertexArray).join('\n')
			);
		} catch {
			0;
		}
	};
</script>

<Modal open={true} size="lg" dismissable={false}>
	<div class="flex justify-start">
		<span class="font-semibold mr-4">
			{generateFilename()}
		</span>

		{#await meshInfo}
			<p>Generating mesh...</p>
		{:then meshInfo}
			{meshInfo.dimensions.x} x
			{meshInfo.dimensions.y} x
			{meshInfo.dimensions.depth} mm |
			{meshInfo.vertexArray.length / 9} polygons |
			{getBinaryStlSizeKbFromVertices(meshInfo.vertexArray.length)} kB
		{:catch message}
			<span class="text-red-500 text-xl">Error '{message}' occured while rendering mesh</span>
		{/await}
	</div>
	<div class="grid grid-cols-2">
		<div class="flex justify-start">
			{#await meshInfo}
				{''}
			{:then}
				<Toggle id="wireframe" bind:checked={wireframe}>Wireframe</Toggle>
			{:catch}
				{''}
			{/await}
		</div>
		<div class="flex justify-end">
			{#await meshInfo}
				{''}
			{:then}
				<ButtonGroup>
					<Button color="primary" on:click={() => downloadStlFile(true)}
						><DownloadSolid class="mr-2" /> Download STL</Button
					>
					<Button on:click={() => downloadStlFile(false)}>Text STL</Button>
				</ButtonGroup>
			{:catch}
				{''}
			{/await}
			<Button class="ml-2" on:click={() => resolve()} color="alternative">Close</Button>
		</div>
	</div>
	<div class="canvasContainer">
		<Canvas>
			{#await meshInfo}
				{''}
			{:then meshInfo}
				<Mesh3DScene vertices={meshInfo.vertexArray} {volume} {wireframe} />
			{:catch}
				{''}
			{/await}
		</Canvas>
	</div>
</Modal>

<style>
	.canvasContainer {
		width: 100%;
		height: 75vh;
		background: #888;
		background: linear-gradient(-45deg, #888 0%, #ccc 100%);
	}
</style>
