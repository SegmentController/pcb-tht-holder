<script lang="ts">
	import Icon from '@iconify/svelte/dist/OfflineIcon.svelte';
	import { Canvas } from '@threlte/core';
	import { Button, Modal, Range, Toggle } from 'flowbite-svelte';
	import { createEventDispatcher, onDestroy, onMount, untrack } from 'svelte';
	import { persisted } from 'svelte-persisted-store';

	import Mesh3DScene from '$components/mesh/Mesh3DScene.svelte';
	import type { MeshKind } from '$lib/3d/mesh';
	import { createMeshClient, MeshClientCancelledError } from '$lib/3d/meshClient';
	import { positivePlacementOffset } from '$lib/3d/placement';
	import { generateBinaryStlFromVertices, getBinaryStlSizeKbFromVertices } from '$lib/3d/stl';
	import { POSITIVE_MESH_COLOR } from '$lib/constants';
	import { virtualDownload } from '$lib/util/download';
	import { formatFileTimestamp, formatMm } from '$lib/util/format';
	import { MathMax } from '$lib/util/math';
	import type { MeshInfo } from '$types/MeshInfo';
	import type { RenderableProject } from '$types/Project';
	import type { SceneMesh } from '$types/SceneMesh';

	import EscapeClose from './util/EscapeClose.svelte';

	const dispatch = createEventDispatcher<{ resolve: object }>();
	const resolve = () => dispatch('resolve', {});

	interface Properties {
		name: string;
		project: RenderableProject;
	}

	let { name, project }: Properties = $props();

	const KIND_LABELS: Record<MeshKind, string> = {
		main: 'Generating mesh...',
		hollow: 'Generating hollow mesh...',
		positive: 'Generating PCB mesh...'
	};

	// Generation runs in a worker; the variants are requested one by one as they are needed
	const client = untrack(() => createMeshClient($state.snapshot(project) as RenderableProject));

	// Large typed arrays: keep them out of Svelte's deep reactivity
	let meshes = $state.raw<Partial<Record<MeshKind, MeshInfo>>>({});
	const progress = $state<Partial<Record<MeshKind, { current: number; total: number }>>>({});
	let errorMessage = $state<string | undefined>();
	let hiddenLegsCount = $state(0);
	let volume = $state(1);

	const requested: Partial<Record<MeshKind, boolean>> = {};
	const request = (kind: MeshKind) => {
		if (requested[kind]) return;
		requested[kind] = true;
		progress[kind] = { current: 0, total: 1 };

		client
			.generate(kind, (current, total) => (progress[kind] = { current, total }))
			.then((result) => {
				meshes = { ...meshes, [kind]: result.mesh };
				hiddenLegsCount = result.hiddenLegsCount;
				if (kind === 'main') volume = MathMax(result.mesh.vertexArray);
			})
			.catch((error) => {
				requested[kind] = false;
				if (error instanceof MeshClientCancelledError) return;
				errorMessage = error instanceof Error ? error.message : String(error);
			})
			.finally(() => delete progress[kind]);
	};

	let isWireframe = $state(false);
	let isHollow = $state(false);
	let showPositive = $state(false);
	let meshDistance = $state(10);
	const useDateInFilename = persisted('useDateInFilename', false);

	onMount(() => request('main'));
	onDestroy(() => client.dispose());

	$effect(() => {
		if (isHollow) untrack(() => request('hollow'));
	});
	$effect(() => {
		if (showPositive) untrack(() => request('positive'));
	});

	const wantedKind = $derived<MeshKind>(isHollow ? 'hollow' : 'main');
	const activeMesh = $derived(meshes[wantedKind]);
	// Show the main holder until a requested hollow variant is ready
	const shownMesh = $derived(activeMesh ?? (isHollow ? meshes.main : undefined));
	const pendingKind = $derived(
		(['main', 'hollow', 'positive'] as MeshKind[]).find((kind) => progress[kind])
	);
	const pendingProgress = $derived(pendingKind ? progress[pendingKind] : undefined);

	const sceneMeshes = $derived.by<SceneMesh[]>(() => {
		if (!shownMesh) return [];
		const positive = showPositive ? meshes.positive : undefined;

		const result: SceneMesh[] = [
			{
				key: 'holder',
				vertices: shownMesh.vertexArray,
				opacity: positive ? 0.75 : 1
			}
		];
		if (positive && meshes.main)
			result.push({
				key: 'positive',
				vertices: positive.vertexArray,
				color: POSITIVE_MESH_COLOR,
				flipZ: true,
				opacity: 0.75,
				positionOffset: positivePlacementOffset({
					holderDepth: meshes.main.dimensions.depth,
					pcbThickness: project.panelSettings.pcbThickness,
					distance: meshDistance
				})
			});
		return result;
	});

	const generateFilename = () =>
		name +
		($useDateInFilename ? '-' + formatFileTimestamp() : '') +
		(isHollow ? '-hollow' : '') +
		'.stl';

	const downloadStlFile = () => {
		if (activeMesh)
			virtualDownload(generateFilename(), generateBinaryStlFromVertices(activeMesh.vertexArray));
	};
</script>

<EscapeClose on:escape={resolve}>
	<Modal dismissable={false} open={true} size="lg">
		<div class="flex justify-start">
			<span class="font-semibold mr-4">
				{generateFilename()}
			</span>

			{#if errorMessage}
				<span class="text-red-500 text-xl">Error '{errorMessage}' occured while rendering mesh</span
				>
			{:else if shownMesh && !pendingProgress}
				{formatMm(shownMesh.dimensions.width)} x
				{formatMm(shownMesh.dimensions.height)} x
				{formatMm(shownMesh.dimensions.depth)} mm |
				{shownMesh.vertexArray.length / 9} polygons |
				{getBinaryStlSizeKbFromVertices(shownMesh.vertexArray.length)} kB
			{:else if pendingKind && pendingProgress}
				<div class="flex items-center gap-2">
					<span class="text-sm">{KIND_LABELS[pendingKind]}</span>
					<span class="text-sm text-gray-500"
						>{Math.round((pendingProgress.current / pendingProgress.total) * 100)}%</span
					>
					<div
						class="flex-1 bg-gray-200 rounded h-2 min-w-48"
						aria-label={KIND_LABELS[pendingKind]}
						aria-valuemax={100}
						aria-valuemin={0}
						aria-valuenow={Math.round((pendingProgress.current / pendingProgress.total) * 100)}
						role="progressbar"
					>
						<div
							style="width: {(pendingProgress.current / pendingProgress.total) * 100}%"
							class="bg-blue-600 h-2 rounded"
						></div>
					</div>
				</div>
			{:else}
				<p>Initializing...</p>
			{/if}
		</div>
		{#if hiddenLegsCount > 0}
			<div class="mt-2 p-2 bg-yellow-100 border border-yellow-400 rounded text-sm text-yellow-800">
				<Icon class="inline-flex mr-1" icon="mdi:alert" width={16} />
				Note: {hiddenLegsCount} leg{hiddenLegsCount > 1 ? 's were' : ' was'} hidden because they overlap
				with components.
			</div>
		{/if}
		<div class="grid grid-cols-2">
			<div class="flex flex-col gap-2">
				<div class="flex justify-start items-center gap-4">
					<Toggle id="wireframe" size="large" bind:checked={isWireframe}>Wireframe</Toggle>
					<Toggle id="hollow" disabled={!meshes.main} size="large" bind:checked={isHollow}
						>Hollow</Toggle
					>
					<Toggle id="positive" disabled={!meshes.main} size="large" bind:checked={showPositive}
						>PCB</Toggle
					>
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
				<Toggle id="dateInFilename" class="mr-4" size="small" bind:checked={$useDateInFilename}
					>Date</Toggle
				>
				<Button color="primary" disabled={!activeMesh} onclick={downloadStlFile}>
					<Icon class="inline-flex mr-2" icon="mdi:download" width={24} />
					Download STL</Button
				>
				<Button class="ml-2" color="alternative" onclick={resolve}>Close</Button>
			</div>
		</div>
		<div class="canvasContainer">
			<Canvas renderMode="on-demand">
				{#if sceneMeshes.length > 0}
					<Mesh3DScene meshes={sceneMeshes} {volume} wireframe={isWireframe} />
				{/if}
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
