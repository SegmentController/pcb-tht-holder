<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';

	export let vertices: Float32Array;
	export let dimension: number;
	export let wireframe: boolean;

	const CAMERA_FAR = 1.5;
</script>

<T.PerspectiveCamera
	makeDefault
	position={[CAMERA_FAR * dimension, CAMERA_FAR * dimension, CAMERA_FAR * dimension]}
>
	<OrbitControls />
</T.PerspectiveCamera>

<T.PointLight
	position={[0 * dimension, 2 * dimension, 2 * dimension]}
	color="white"
	decay={1 / 10}
/>
<T.AmbientLight intensity={1 / 3} />

<T.Mesh rotation.x={-Math.PI / 2}>
	<T.BufferGeometry>
		<T.BufferAttribute
			args={[vertices, 3]}
			attach={(parent, self) => {
				parent.setAttribute('position', self);
				parent.computeVertexNormals(); // or flatShading=true
				return () => {};
			}}
		/>
	</T.BufferGeometry>
	<T.MeshStandardMaterial color="#22ff22" opacity={0.5} {wireframe} />
</T.Mesh>
