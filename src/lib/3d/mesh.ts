import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import type { Polygon } from 'three-csg-ts/lib/esm/Polygon';

import type { RenderableProject } from '$types/Project';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;

type Size = { w: number; h: number };
export const generateMesh = (project: RenderableProject): Polygon[] => {
	const size: Size = {
		w: project.panelSettings.width + 2 * EDGE_THICKNESS,
		h: project.panelSettings.height + 2 * EDGE_THICKNESS
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

	const box = new THREE.Mesh(new THREE.BoxGeometry(size.w, height, size.h));
	const box2 = new THREE.Mesh(
		new THREE.BoxGeometry(project.panelSettings.width, deep * 10, project.panelSettings.height)
	);
	const a = CSG.subtract(box, box2);

	return CSG.fromMesh(a).toPolygons();
};

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
