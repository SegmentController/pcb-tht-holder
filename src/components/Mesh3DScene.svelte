<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { onMount } from 'svelte';
	import type { BufferGeometry, NormalOrGLBufferAttributes } from 'three';

	export let vertices: Float32Array;
	export let volume: number;
	export let wireframe: boolean;

	const CAMERA_FAR = 2;

	let bufferGeometry: BufferGeometry<NormalOrGLBufferAttributes>;
	onMount(() => {
		if (bufferGeometry) bufferGeometry.computeVertexNormals();
	});
</script>

<T.PerspectiveCamera
	makeDefault
	position={[CAMERA_FAR * volume, CAMERA_FAR * volume, CAMERA_FAR * volume]}
>
	<OrbitControls />
</T.PerspectiveCamera>

<T.PointLight position={[0, 1 * volume, 2 * volume]} decay={0.1} intensity={5} />
<T.AmbientLight color="white" intensity={1} />

<T.Mesh rotation.x={-Math.PI / 2}>
	<T.BufferGeometry bind:ref={bufferGeometry}>
		<T.BufferAttribute args={[vertices, 3]} attach="attributes.position" />
	</T.BufferGeometry>
	<T.MeshPhongMaterial color="#118811" {wireframe} />
</T.Mesh>
