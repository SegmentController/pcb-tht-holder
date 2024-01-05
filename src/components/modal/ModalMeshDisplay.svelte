<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { Button, ButtonGroup, Modal, Toggle } from 'flowbite-svelte';
	import { DownloadSolid } from 'flowbite-svelte-icons';

	import type { MeshInfo } from '$lib/3d/mesh';
	import {
		generateBinaryStlFromVertices,
		generateStlFromVertices,
		getBinaryStlSizeKbFromVertices
	} from '$lib/3d/stl';
	import { virtualDownload } from '$lib/download';
	import { MathMax } from '$lib/Math';

	import Mesh3DScene from '../Mesh3DScene.svelte';

	let _filename: string;
	let _meshInfo: Promise<MeshInfo>;
	let _dimension: number;
	let isOpen: boolean = false;
	let wireframe: boolean = false;

	export const open = async (filename: string, meshInfo: Promise<MeshInfo>) => {
		_filename = filename;
		_meshInfo = meshInfo;
		meshInfo.then((m) => (_dimension = MathMax([...m.vertexArray.values()])));
		isOpen = true;
	};

	const generateFilename = () =>
		_filename.slice(0, Math.max(0, _filename.lastIndexOf('.'))) + '.stl';

	const downloadStlFile = async (isBinary: boolean) => {
		const meshinfo = await _meshInfo;
		virtualDownload(
			generateFilename(),
			isBinary
				? generateBinaryStlFromVertices(meshinfo.vertexArray)
				: generateStlFromVertices(meshinfo.vertexArray).join('\n')
		);
	};
</script>

<Modal open={isOpen} size="lg" dismissable={false}>
	<div class="flex justify-start">
		<span class="font-semibold mr-4">
			{generateFilename()}
		</span>

		{#await _meshInfo}
			<p>Generating mesh...</p>
		{:then meshInfo}
			{meshInfo.dimensions.x} x
			{meshInfo.dimensions.y} x
			{meshInfo.dimensions.depth} mm |
			{meshInfo.vertexArray.length / 9} polygons |
			{getBinaryStlSizeKbFromVertices(meshInfo.vertexArray.length)} kB
		{/await}
	</div>
	<div class="grid grid-cols-2">
		<div class="flex justify-start">
			{#await _meshInfo}
				{''}
			{:then}
				<Toggle id="wireframe" bind:checked={wireframe}>Wireframe</Toggle>
			{/await}
		</div>
		<div class="flex justify-end">
			{#await _meshInfo}
				{''}
			{:then}
				<ButtonGroup>
					<Button color="primary" on:click={() => downloadStlFile(true)}
						><DownloadSolid class="mr-2" /> Download STL</Button
					>
					<Button on:click={() => downloadStlFile(false)}>Text STL</Button>
				</ButtonGroup>
			{/await}
			<Button class="ml-2" on:click={() => (isOpen = false)} color="alternative">Close</Button>
		</div>
	</div>
	<div class="canvasContainer">
		{#await _meshInfo}
			{''}
		{:then meshInfo}
			<Canvas>
				<Mesh3DScene vertices={meshInfo.vertexArray} dimension={_dimension} {wireframe} />
			</Canvas>
		{/await}
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
