<script lang="ts">
	import Icon from '@iconify/svelte';
	import { Canvas } from '@threlte/core';
	import dayjs from 'dayjs';
	import { Button, Modal, Range, Toggle } from 'flowbite-svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { persisted } from 'svelte-persisted-store';

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

	interface Properties {
		name: string;
		meshInfoTuple: Promise<MeshInfoTuple>;
	}

	let { name, meshInfoTuple }: Properties = $props();

	let volume = $state(1);
	onMount(async () => {
		await meshInfoTuple
			.then((m) => (volume = MathMax([...m.main.vertexArray.values()])))
			.catch(() => (volume = 1));
	});

	let isWireframe = $state(false);
	let isHollow = $state(false);
	let showPositive = $state(false);
	let meshDistance = $state(10);
	const useDateInFilename = persisted('useDateInFilename', false);

	const generateFilename = () =>
		name +
		($useDateInFilename ? '-' + dayjs().format('YYYYMMDD-HHmmss') : '') +
		(isHollow ? '-hollow' : '') +
		'.stl';

	const getActiveMesh = (meshinfotuple: MeshInfoTuple) => {
		return isHollow ? meshinfotuple.hollow : meshinfotuple.main;
	};

	const downloadStlFile = async (isBinary: boolean) => {
		try {
			const meshinfotuple = await meshInfoTuple;
			const activeMesh = getActiveMesh(meshinfotuple);
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
	<Modal dismissable={false} open={true} size="lg">
		<div class="flex justify-start">
			<span class="font-semibold mr-4">
				{generateFilename()}
			</span>

			{#await meshInfoTuple}
				<p>Generating mesh...</p>
			{:then meshInfoTuple}
				{@const activeMesh = getActiveMesh(meshInfoTuple)}
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
			<div class="flex flex-col gap-2">
				<div class="flex justify-start items-center gap-4">
					{#await meshInfoTuple then}
						<Toggle id="wireframe" size="large" bind:checked={isWireframe}>Wireframe</Toggle>
						<Toggle id="hollow" size="large" bind:checked={isHollow}>Hollow</Toggle>
						<Toggle id="positive" size="large" bind:checked={showPositive}>PCB</Toggle>
					{/await}
				</div>
				{#if showPositive}
					<div class="flex items-center gap-2 ml-2">
						<label class="text-sm whitespace-nowrap" for="distance">Distance:</label>
						<Range id="distance" max="50" min="0" size="sm" bind:value={meshDistance} />
						<span class="text-xs text-gray-500 w-12">{meshDistance}</span>
					</div>
				{/if}
			</div>
			<div class="flex justify-end">
				{#await meshInfoTuple then}
					<Toggle id="dateInFilename" class="mr-4" size="small" bind:checked={$useDateInFilename}
						>Date</Toggle
					>
					<Button color="primary" onclick={() => downloadStlFile(true)}>
						<Icon class="inline-flex mr-2" icon="mdi:download" width={24} />
						Download STL</Button
					>
				{/await}
				<Button class="ml-2" color="alternative" onclick={() => resolve()}>Close</Button>
			</div>
		</div>
		<div class="canvasContainer">
			<Canvas>
				{#await meshInfoTuple then meshInfoTuple}
					{@const activeMesh = getActiveMesh(meshInfoTuple)}
					{@const baseOffset = meshInfoTuple.positive
						? (activeMesh.dimensions.depth + meshInfoTuple.positive.dimensions.depth) / 2
						: 0}
					{#key `${activeMesh.vertexArray}-${showPositive}`}
						<Mesh3DScene
							opacity={showPositive ? 0.75 : 1}
							vertices={activeMesh.vertexArray}
							{volume}
							wireframe={isWireframe}
						/>
						{#if showPositive && meshInfoTuple.positive}
							<Mesh3DScene
								color="#ff8811"
								flipZ={true}
								opacity={0.75}
								positionOffset={baseOffset + meshDistance}
								vertices={meshInfoTuple.positive.vertexArray}
								{volume}
								wireframe={isWireframe}
							/>
						{/if}
					{/key}
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
