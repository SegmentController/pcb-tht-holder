<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';

	export let vertices: Float32Array;
	export let dimension: number;
	export let wireframe: boolean;
</script>

<T.PerspectiveCamera makeDefault position={[5 * dimension, 5 * dimension, 5 * dimension]}>
	<OrbitControls />
</T.PerspectiveCamera>

<T.PointLight position={[200, 100, 100]} color="white" intensity={1} decay={0.1} castShadow />
<T.AmbientLight intensity={0.5} />

<T.Mesh rotation.x={-Math.PI / 2} castShadow>
	<T.BufferGeometry>
		<T.BufferAttribute
			args={[vertices, 3]}
			attach={(parent, self) => {
				parent.setAttribute('position', self);
				return () => {};
			}}
		/>
	</T.BufferGeometry>
	<T.MeshStandardMaterial color="#22ff22" opacity={1} {wireframe} />
</T.Mesh>

<T.Mesh position={[0, -1.5 * dimension, 0]} rotation.x={-Math.PI / 2} receiveShadow>
	<T.CircleGeometry args={[5 * dimension, 64]} />
	<T.MeshStandardMaterial color="#777" />
</T.Mesh>
