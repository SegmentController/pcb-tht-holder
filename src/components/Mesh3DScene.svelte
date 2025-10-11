<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { onMount } from 'svelte';
	import type { BufferGeometry, NormalOrGLBufferAttributes } from 'three';

	export let vertices: Float32Array;
	export let volume: number;
	export let wireframe: boolean;
	export let color: string = '#118811';
	export let positionOffset: number = 0;
	export let opacity: number = 1;
	export let flipZ: boolean = false;

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

<T.PointLight decay={0.1} intensity={5} position={[0, 1 * volume, 2 * volume]} />
<T.AmbientLight color="white" intensity={1} />

<T.Mesh position.y={positionOffset} rotation.x={-Math.PI / 2} scale.z={flipZ ? -1 : 1}>
	<T.BufferGeometry bind:ref={bufferGeometry}>
		<T.BufferAttribute args={[vertices, 3]} attach="attributes.position" />
	</T.BufferGeometry>
	<T.MeshPhongMaterial {color} {opacity} transparent={opacity < 1} {wireframe} />
</T.Mesh>
