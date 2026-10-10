<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';

	import type { SceneMesh } from '$types/SceneMesh';

	import MeshObject from './MeshObject.svelte';

	interface Properties {
		/** Size of the model, used to place camera and light */
		volume: number;
		wireframe: boolean;
		meshes: SceneMesh[];
	}

	const { volume, wireframe, meshes }: Properties = $props();

	const CAMERA_FAR = 2;

	// The canvas renders on demand: request a frame when anything shown here changes
	const { invalidate } = useThrelte();
	$effect(() => {
		void [
			volume,
			wireframe,
			meshes.map((mesh) => [mesh.vertices, mesh.opacity, mesh.positionOffset])
		];
		invalidate();
	});
</script>

<!-- Camera, controls and lights exist once, however many meshes are shown -->
<T.PerspectiveCamera
	makeDefault={true as never}
	position={[CAMERA_FAR * volume, CAMERA_FAR * volume, CAMERA_FAR * volume]}
>
	<OrbitControls />
</T.PerspectiveCamera>

<T.PointLight decay={0.1} intensity={5} position={[0, 1 * volume, 2 * volume]} />
<T.AmbientLight color="white" intensity={1} />

{#each meshes as mesh (mesh.key)}
	<MeshObject
		color={mesh.color}
		flipZ={mesh.flipZ}
		opacity={mesh.opacity}
		positionOffset={mesh.positionOffset}
		vertices={mesh.vertices}
		{wireframe}
	/>
{/each}
