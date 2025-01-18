<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';

	export let vertices: Float32Array;
	export let volume: number;
	export let wireframe: boolean;

	const CAMERA_FAR = 2;
</script>

// eslint-disable @typescript-eslint/no-explicit-any
<T.PerspectiveCamera
	makeDefault
	position={[CAMERA_FAR * volume, CAMERA_FAR * volume, CAMERA_FAR * volume]}
>
	<OrbitControls />
</T.PerspectiveCamera>

<T.PointLight position={[0 * volume, 2 * volume, 2 * volume]} color="white" decay={1 / 10} />
<T.AmbientLight intensity={1 / 3} />

<T.Mesh rotation.x={-Math.PI / 2}>
	<T.BufferGeometry>
		<T.BufferAttribute args={[vertices, 3]} />
	</T.BufferGeometry>
	<T.MeshStandardMaterial color="#22ff22" {wireframe} />
</T.Mesh>
