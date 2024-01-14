<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';

	export let vertices: Float32Array;
	export let volume: number;
	export let wireframe: boolean;

	const CAMERA_FAR = 2;
</script>

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
		<T.BufferAttribute
			args={[vertices, 3]}
			attach={(parent, self) => {
				parent.setAttribute('position', self);
				parent.computeVertexNormals();
				return () => {};
			}}
		/>
	</T.BufferGeometry>
	<T.MeshStandardMaterial color="#22ff22" {wireframe} />
</T.Mesh>
