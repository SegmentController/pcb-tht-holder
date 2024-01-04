<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { Button, Modal, Toggle } from 'flowbite-svelte';

	import Mesh3DScene from './Mesh3DScene.svelte';

	let _filename: string;
	let _vertices: Float32Array;
	let _dimension: number;
	let _stl: string[];
	let isOpen: boolean = false;
	let wireframe: boolean = false;

	export const open = (filename: string, vertices: Float32Array, stl: string[]): void => {
		_filename = filename;
		_vertices = vertices;
		_dimension = Math.max(..._vertices.values());
		_stl = stl;
		isOpen = true;
	};

	const downloadData = () => {
		const stlData = _stl.join('\n');

		const a = document.createElement('a');
		document.body.append(a);
		a.download = _filename.slice(0, Math.max(0, _filename.lastIndexOf('.'))) + '.stl';
		a.href = URL.createObjectURL(new Blob([stlData]));
		a.click();
		a.remove();
	};
</script>

<Modal open={isOpen} size="lg" dismissable={false}>
	<div class="flex justify-end">
		<Toggle class="mr-8" bind:checked={wireframe}>Wireframe</Toggle>
		<Button on:click={() => downloadData()}>Download STL</Button>
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
