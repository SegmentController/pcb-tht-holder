<script>
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
</script>

<T.PerspectiveCamera
	makeDefault
	position={[3, 3, 3]}
	on:create={({ ref }) => {
		ref.lookAt(0, 1, 0);
	}}
>
	<OrbitControls />
</T.PerspectiveCamera>

<T.DirectionalLight position={[10, 20, 20]} color="white" />
<T.DirectionalLight position={[-10, -20, -20]} color="yellow" />

<T.Mesh>
	<T.BoxGeometry args={[1, 2, 1]} />
	<T.MeshStandardMaterial color="#22dd22" />
</T.Mesh>
