<script lang="ts">
	import { T } from '@threlte/core';
	import { OrbitControls } from '@threlte/extras';
	import { BufferAttribute, type BufferGeometry, type NormalOrGLBufferAttributes } from 'three';

	interface Properties {
		vertices: Float32Array;
		volume: number;
		wireframe: boolean;
		color?: string;
		positionOffset?: number;
		opacity?: number;
		flipZ?: boolean;
	}

	const {
		vertices,
		volume,
		wireframe,
		color = '#118811',
		positionOffset = 0,
		opacity = 1,
		flipZ = false
	}: Properties = $props();

	const CAMERA_FAR = 2;

	const setupGeometry = (geo: BufferGeometry<NormalOrGLBufferAttributes>) => {
		geo.setAttribute('position', new BufferAttribute(vertices, 3));
		geo.computeVertexNormals();
	};
</script>

<T.PerspectiveCamera
	makeDefault={true as never}
	position={[CAMERA_FAR * volume, CAMERA_FAR * volume, CAMERA_FAR * volume]}
>
	<OrbitControls />
</T.PerspectiveCamera>

<T.PointLight decay={0.1} intensity={5} position={[0, 1 * volume, 2 * volume]} />
<T.AmbientLight color="white" intensity={1} />

<T.Mesh position.y={positionOffset} rotation.x={-Math.PI / 2} scale.z={flipZ ? -1 : 1}>
	<T.BufferGeometry oncreate={setupGeometry} />
	<T.MeshPhongMaterial {color} {opacity} transparent={opacity < 1} {wireframe} />
</T.Mesh>
