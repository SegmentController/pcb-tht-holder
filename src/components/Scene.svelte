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

<T.DirectionalLight
	position={[0 * dimension, 5 * dimension, 0 * dimension]}
	castShadow
	color="white"
/>
<T.AmbientLight />

<T.Mesh receiveShadow castShadow>
	<T.BufferGeometry>
		<T.BufferAttribute
			args={[vertices, 3]}
			attach={(parent, self) => {
				parent.setAttribute('position', self);
				return () => {};
			}}
		/>
	</T.BufferGeometry>
	<T.MeshStandardMaterial color="#22ff22" opacity={0.3} {wireframe} />
</T.Mesh>

<T.Mesh position={[0, -1.5 * dimension, 0]} rotation.x={-Math.PI / 2} receiveShadow>
	<T.CircleGeometry args={[5 * dimension, 64]} />
	<T.MeshStandardMaterial color="#777" />
</T.Mesh>
