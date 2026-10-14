<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferAttribute, type BufferGeometry, type NormalOrGLBufferAttributes } from 'three';

	interface Properties {
		vertices: Float32Array;
		wireframe: boolean;
		color?: string;
		positionOffset?: number;
		opacity?: number;
		flipZ?: boolean;
	}

	const {
		vertices,
		wireframe,
		color = '#118811',
		positionOffset = 0,
		opacity = 1,
		flipZ = false
	}: Properties = $props();

	// Not T.BufferAttribute with args: that crashes in Vite production builds (see CLAUDE.md)
	const setupGeometry = (geometry: BufferGeometry<NormalOrGLBufferAttributes>) => {
		geometry.setAttribute('position', new BufferAttribute(vertices, 3));
		geometry.computeVertexNormals();
	};
</script>

<!--
	New vertices (main <-> hollow) re-create the whole mesh: re-keying only the geometry lets the
	destroyed one detach after the new one attached and leaves the mesh without geometry.
-->
{#key vertices}
	<T.Mesh position.y={positionOffset} rotation.x={-Math.PI / 2} scale.z={flipZ ? -1 : 1}>
		<T.BufferGeometry oncreate={setupGeometry} />
		<T.MeshPhongMaterial {color} {opacity} transparent={opacity < 1} {wireframe} />
	</T.Mesh>
{/key}
