import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import type { Polygon } from 'three-csg-ts/lib/esm/Polygon';

import type { RenderableProject } from '$types/Project';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;

export const polygonsToVertexArray = (polygons: Polygon[]): Float32Array => {
	const result: number[] = [];

	for (const polygon of polygons)
		for (let index = 0; index < 3; index++)
			result.push(
				polygon.vertices[index].pos.x,
				polygon.vertices[index].pos.y,
				polygon.vertices[index].pos.z
			);

	return new Float32Array(result);
};
const Mesh = (geometry: THREE.BufferGeometry) => new THREE.Mesh(geometry.translate(0, 0, 0.5)); //
export const generateMesh = (project: RenderableProject): Polygon[] => {
	const size = {
		x: project.panelSettings.width + 2 * EDGE_THICKNESS,
		y: project.panelSettings.height + 2 * EDGE_THICKNESS
	};
	const heightNeed =
		project.panelSettings.pcbThickness +
		Math.max(
			project.panelSettings.smdHeight,
			...project.rectangles.map((r) => r.depth),
			...project.circles.map((c) => c.depth)
		);
	const height = BOTTOM_THICKNESS + heightNeed;
	const deep = project.panelSettings.pcbThickness + project.panelSettings.smdHeight;

	const box = Mesh(new THREE.BoxGeometry(size.x, size.y, height));
	box.updateMatrix();

	const box2 = Mesh(
		new THREE.BoxGeometry(project.panelSettings.width, project.panelSettings.height, deep)
	);
	box2.position.z += (height - deep) / 2;
	box2.updateMatrix();

	const a = CSG.subtract(box, box2);

	return CSG.fromMesh(a).toPolygons();
};
