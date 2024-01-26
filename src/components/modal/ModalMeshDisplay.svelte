<script lang="ts">
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

	const dispatch = createEventDispatcher<{ resolve: { trigger: 'custom' } }>();
	const resolve = () => dispatch('resolve', { trigger: 'custom' });

	export let name: string;
	export let meshInfoTuple: Promise<MeshInfoTuple>;

	let volume: number;
	onMount(async () => {
		await meshInfoTuple
			.then((m) => (volume = MathMax([...m.main.vertexArray.values()])))
			.catch(() => (volume = 1));
	});

	let wireframe: boolean = false;
	let coverageOnly: boolean = false;

	const generateFilename = () => name + '.stl';

	const downloadStlFile = async (isBinary: boolean) => {
		try {
			const meshinfotuple = await meshInfoTuple;
			const vertices = (coverageOnly ? meshinfotuple.coverage : meshinfotuple.main).vertexArray;
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

<EscapeClose on:escape={() => resolve()}>
	<Modal open={true} size="lg" dismissable={false}>
		<div class="flex justify-start">
			<span class="font-semibold mr-4">
				{generateFilename()}
			</span>

			{#await meshInfoTuple}
				<p>Generating mesh...</p>
			{:then meshInfoTuple}
				{(coverageOnly ? meshInfoTuple.coverage : meshInfoTuple.main).dimensions.width} x
				{(coverageOnly ? meshInfoTuple.coverage : meshInfoTuple.main).dimensions.height} x
				{(coverageOnly ? meshInfoTuple.coverage : meshInfoTuple.main).dimensions.depth} mm |
				{(coverageOnly ? meshInfoTuple.coverage : meshInfoTuple.main).vertexArray.length / 9} polygons
				|
				{getBinaryStlSizeKbFromVertices(
					(coverageOnly ? meshInfoTuple.coverage : meshInfoTuple.main).vertexArray.length
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
					<Toggle id="coverageOnly" class="ml-4" bind:checked={coverageOnly}>Coverage only</Toggle>
				{:catch}
					{''}
				{/await}
			</div>
			<div class="flex justify-end">
				{#await meshInfoTuple}
					{''}
				{:then}
					<ButtonGroup>
						<Button color="primary" on:click={() => downloadStlFile(true)}>
							<svg
								class="mr-2"
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								><path
									fill="currentColor"
									d="M14 2H6c-1.11 0-2 .89-2 2v16c0 1.11.89 2 2 2h12c1.11 0 2-.89 2-2V8zm-2 17l-4-4h2.5v-3h3v3H16zm1-10V3.5L18.5 9z"
								/></svg
							>
							Download STL</Button
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
				{#await meshInfoTuple}
					{''}
				{:then meshInfoTuple}
					{#if coverageOnly}
						<Mesh3DScene vertices={meshInfoTuple.coverage.vertexArray} {volume} {wireframe} />
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
