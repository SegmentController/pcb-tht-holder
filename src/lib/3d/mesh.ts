import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import type { Polygon } from 'three-csg-ts/lib/esm/Polygon';

import type { RenderableProject } from '$types/Project';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;

export type MeshDimensionInfo = {
	x: number;
	y: number;
	depth: number;
};
export type MeshInfo = {
	polygons: Polygon[];
	dimensions: MeshDimensionInfo;
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

const MESH = (geometry: THREE.BoxGeometry | THREE.CylinderGeometry) => {
	const result = new THREE.Mesh(geometry.translate(0, 0, 0));
	if (geometry instanceof THREE.BoxGeometry) result.position.z = geometry.parameters.depth / 2;
	else if (geometry instanceof THREE.CylinderGeometry) {
		result.position.z = geometry.parameters.height / 2;
		result.rotateX(Math.PI / 2);
	}
	result.updateMatrix();
	return result;
};
const BOX = (width: number, height: number, depth: number) =>
	new THREE.BoxGeometry(width, height, depth);
const CYLINDER = (radius: number, height: number) =>
	new THREE.CylinderGeometry(radius, radius, height, 32);
export const generateMesh = (project: RenderableProject): MeshInfo => {
	// Constant helper values
	const panel = project.panelSettings;
	const emptyHeight = panel.pcbThickness + panel.smdHeight;
	const componentHeigh = Math.max(
		panel.smdHeight,
		...project.rectangles.map((r) => r.depth),
		...project.circles.map((c) => c.depth)
	);
	const needHeight = panel.pcbThickness + componentHeigh;

	// Lets create mesh...
	let mesh: THREE.Mesh = MESH(
		BOX(
			panel.width + 2 * EDGE_THICKNESS,
			panel.height + 2 * EDGE_THICKNESS,
			needHeight + BOTTOM_THICKNESS
		)
	);

	const emptySpace = MESH(BOX(panel.width, panel.height, emptyHeight));
	{
		emptySpace.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
		emptySpace.updateMatrix();
		mesh = CSG.subtract(mesh, emptySpace);
	}
	for (const leg of project.legs) {
		const box = MESH(BOX(leg.konvaConfig.width, leg.konvaConfig.height, componentHeigh));
		box.position.x += leg.konvaConfig.x + leg.konvaConfig.width / 2 - panel.width / 2;
		box.position.y -= leg.konvaConfig.y + leg.konvaConfig.height / 2 - panel.height / 2;
		box.position.z += BOTTOM_THICKNESS;
		box.updateMatrix();
		mesh = CSG.union(mesh, box);
	}
	for (const rectangle of project.rectangles) {
		const box = MESH(BOX(rectangle.sizeX, rectangle.sizeY, rectangle.depth));
		box.position.x += rectangle.konvaConfig.x + rectangle.sizeX / 2 - panel.width / 2;
		box.position.y -= rectangle.konvaConfig.y + rectangle.sizeY / 2 - panel.height / 2;
		box.position.z += BOTTOM_THICKNESS + (componentHeigh - rectangle.depth);
		box.updateMatrix();
		mesh = CSG.subtract(mesh, box);
	}
	for (const circle of project.circles) {
		const cylinder = MESH(CYLINDER(circle.diameter / 2, circle.depth));
		cylinder.position.x += circle.konvaConfig.x - panel.width / 2;
		cylinder.position.y -= circle.konvaConfig.y - panel.height / 2;
		cylinder.position.z += BOTTOM_THICKNESS + (componentHeigh - circle.depth);
		cylinder.updateMatrix();
		mesh = CSG.subtract(mesh, cylinder);
	}

	return {
		polygons: CSG.fromMesh(mesh).toPolygons(),
		dimensions: {
			x: panel.width + 2 * EDGE_THICKNESS,
			y: panel.height + 2 * EDGE_THICKNESS,
			depth: needHeight + BOTTOM_THICKNESS
		}
	};
};
