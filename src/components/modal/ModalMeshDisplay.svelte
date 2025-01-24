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

	let isWireframe: boolean = false;
	let isHollow: boolean = false;

	const generateFilename = () => name + '.stl';

	const downloadStlFile = async (isBinary: boolean) => {
		try {
			const meshinfotuple = await meshInfoTuple;
			const activeMesh = isHollow ? meshinfotuple.hollow : meshinfotuple.main;
			const vertices = activeMesh.vertexArray;
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
				{@const activeMesh = isHollow ? meshInfoTuple.hollow : meshInfoTuple.main}
				{activeMesh.dimensions.width} x
				{activeMesh.dimensions.height} x
				{activeMesh.dimensions.depth} mm |
				{activeMesh.vertexArray.length / 9} polygons |
				{getBinaryStlSizeKbFromVertices(activeMesh.vertexArray.length)} kB
			{:catch message}
				<span class="text-red-500 text-xl">Error '{message}' occured while rendering mesh</span>
			{/await}
		</div>
		<div class="grid grid-cols-2">
			<div class="flex justify-start">
				{#await meshInfoTuple}
					{''}
				{:then}
					<Toggle id="wireframe" bind:checked={isWireframe}>Wireframe</Toggle>
					<Toggle id="hollow" class="ml-4" bind:checked={isHollow}>Hollow top layer</Toggle>
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
					{@const activeMesh = isHollow ? meshInfoTuple.hollow : meshInfoTuple.main}
					{#key activeMesh}
						<Mesh3DScene vertices={activeMesh.vertexArray} {volume} wireframe={isWireframe} />
					{/key}
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
