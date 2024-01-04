<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { Button, ButtonGroup, Modal, Toggle } from 'flowbite-svelte';
	import { DownloadSolid } from 'flowbite-svelte-icons';

	import type { MeshDimensionInfo } from '$lib/3d/mesh';
	import { generateBinaryStlFromVertices, generateStlFromVertices } from '$lib/3d/stl';
	import { virtualDownload } from '$lib/download';
	import { MathMax } from '$lib/Math';

	import Mesh3DScene from './Mesh3DScene.svelte';

	let _filename: string;
	let _meshInfo: MeshDimensionInfo;
	let _vertices: Float32Array;
	let _dimension: number;
	let isOpen: boolean = false;
	let wireframe: boolean = false;

	export const open = (
		filename: string,
		meshInfo: MeshDimensionInfo,
		vertices: Float32Array
	): void => {
		_filename = filename;
		_meshInfo = meshInfo;
		_vertices = vertices;
		_dimension = MathMax([..._vertices.values()]);
		isOpen = true;
	};

	const generateFilename = () =>
		_filename.slice(0, Math.max(0, _filename.lastIndexOf('.'))) + '.stl';

	const downloadStlFile = (isBinary: boolean) =>
		virtualDownload(
			generateFilename(),
			isBinary
				? generateBinaryStlFromVertices(_vertices)
				: generateStlFromVertices(_vertices).join('\n')
		);
</script>

<Modal open={isOpen} size="lg" dismissable={false}>
	<div class="flex justify-start">
		<span class="font-semibold mr-4">
			{generateFilename()}
		</span>
		{_meshInfo.x} x
		{_meshInfo.y} x
		{_meshInfo.depth} mm |
		{_vertices.length / 9} polygons
		<Toggle id="wireframe" class="ml-8" bind:checked={wireframe}>Wireframe</Toggle>
	</div>
	<div class="flex justify-end">
		<ButtonGroup>
			<Button color="primary" on:click={() => downloadStlFile(true)}
				><DownloadSolid class="mr-2" /> Download STL</Button
			>
			<Button on:click={() => downloadStlFile(false)}>Text STL</Button>
		</ButtonGroup>
		<Button class="ml-2" on:click={() => (isOpen = false)} color="alternative">Close</Button>
	</div>
	<div class="canvasContainer">
		<Canvas>
			<Mesh3DScene vertices={_vertices} dimension={_dimension} {wireframe} />
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
