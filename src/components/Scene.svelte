<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';

	export let vertices: Float32Array;
	export let dimension: number;
</script>

<T.PerspectiveCamera makeDefault position={[3 * dimension, 3 * dimension, 3 * dimension]}>
	<OrbitControls />
</T.PerspectiveCamera>

<T.DirectionalLight position={[0, 1, 0]} castShadow color="white" />
<T.AmbientLight />

<T.Mesh receiveShadow>
	<T.BufferGeometry>
		<T.BufferAttribute
			args={[vertices, 3]}
			attach={(parent, self) => {
				parent.setAttribute('position', self);
				return () => {};
			}}
		/>
	</T.BufferGeometry>
	<T.MeshStandardMaterial color="#22cc22" />
</T.Mesh>

<T.Mesh position={[0, -2, 0]} rotation.x={-Math.PI / 2} receiveShadow>
	<T.CircleGeometry args={[8, 80]} />
	<T.MeshStandardMaterial color="#aaa" />
</T.Mesh>
