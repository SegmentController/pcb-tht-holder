<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { Button, ButtonGroup, Modal, Toggle } from 'flowbite-svelte';
	import { DownloadSolid } from 'flowbite-svelte-icons';
	import { createEventDispatcher, onMount } from 'svelte';

	import type { MeshInfos } from '$lib/3d/mesh';
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
	export let meshInfos: Promise<MeshInfos>;

	let volume: number;
	onMount(async () => {
		await meshInfos
			.then((m) => (volume = MathMax([...m.main.vertexArray.values()])))
			.catch(() => (volume = 1));
	});

	let wireframe: boolean = false;
	let coverageOnly: boolean = false;

	const generateFilename = () => filename.slice(0, Math.max(0, filename.lastIndexOf('.'))) + '.stl';

	const downloadStlFile = async (isBinary: boolean) => {
		try {
			const meshinfos = await meshInfos;
			const vertices = (coverageOnly ? meshinfos.coverage : meshinfos.main).vertexArray;
			virtualDownload(
				generateFilename(),
				isBinary
					? generateBinaryStlFromVertices(vertices)
					: generateStlFromVertices(vertices).join('\n')
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

		{#await meshInfos}
			<p>Generating mesh...</p>
		{:then meshInfos}
			{(coverageOnly ? meshInfos.coverage : meshInfos.main).dimensions.x} x
			{(coverageOnly ? meshInfos.coverage : meshInfos.main).dimensions.y} x
			{(coverageOnly ? meshInfos.coverage : meshInfos.main).dimensions.depth} mm |
			{(coverageOnly ? meshInfos.coverage : meshInfos.main).vertexArray.length / 9} polygons |
			{getBinaryStlSizeKbFromVertices(
				(coverageOnly ? meshInfos.coverage : meshInfos.main).vertexArray.length
			)} kB
		{:catch message}
			<span class="text-red-500 text-xl">Error '{message}' occured while rendering mesh</span>
		{/await}
	</div>
	<div class="grid grid-cols-2">
		<div class="flex justify-start">
			{#await meshInfos}
				{''}
			{:then}
				<Toggle id="wireframe" bind:checked={wireframe}>Wireframe</Toggle>
				<Toggle id="coverageOnly" class="ml-4" bind:checked={coverageOnly}>Coverage only</Toggle>
			{:catch}
				{''}
			{/await}
		</div>
		<div class="flex justify-end">
			{#await meshInfos}
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
			{#await meshInfos}
				{''}
			{:then meshInfos}
				{#if coverageOnly}
					<Mesh3DScene vertices={meshInfos.coverage.vertexArray} {volume} {wireframe} />
				{:else}
					<Mesh3DScene vertices={meshInfos.main.vertexArray} {volume} {wireframe} />
				{/if}
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
