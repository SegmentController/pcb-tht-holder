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

const Mesh = (geometry: THREE.BoxGeometry | THREE.CylinderGeometry) => {
	const result = new THREE.Mesh(geometry.translate(0, 0, 0));
	if (geometry instanceof THREE.BoxGeometry) result.position.z = geometry.parameters.depth / 2;
	else if (geometry instanceof THREE.CylinderGeometry)
		result.position.z = geometry.parameters.height / 2;
	result.updateMatrix();
	return result;
};
const Box = (width: number, height: number, depth: number) =>
	new THREE.BoxGeometry(width, height, depth);
const Cylinder = (radius: number, height: number) =>
	new THREE.CylinderGeometry(radius, radius, height);

export const generateMesh = (project: RenderableProject): MeshInfo => {
	// Constant helper values
	const panel = project.panelSettings;
	const heightNeed =
		panel.pcbThickness +
		Math.max(
			panel.smdHeight,
			...project.rectangles.map((r) => r.depth),
			...project.circles.map((c) => c.depth)
		);

	const scale = {
		width: project.imageSize.width / panel.width,
		height: project.imageSize.height / panel.height
	};

	// Lets create mesh...
	let mesh: THREE.Mesh = Mesh(
		Box(
			panel.width + 2 * EDGE_THICKNESS,
			panel.height + 2 * EDGE_THICKNESS,
			heightNeed + BOTTOM_THICKNESS
		)
	);

	const emptySpace = Mesh(Box(panel.width, panel.height, heightNeed));
	{
		emptySpace.position.z += BOTTOM_THICKNESS * 3;
		emptySpace.updateMatrix();
		mesh = CSG.subtract(mesh, emptySpace);
	}
	for (const rectangle of project.rectangles) {
		const box = Mesh(Box(rectangle.sizeX, rectangle.sizeY, rectangle.depth));
		box.position.x += rectangle.konvaConfig.x / scale.width;
		box.position.y += rectangle.konvaConfig.y / scale.height;
		box.position.z += BOTTOM_THICKNESS;
		box.updateMatrix();
		mesh = CSG.subtract(mesh, box);
	}
	/*
	for (const circle of project.circles) {
		const cylinder = Mesh(Cylinder(circle.diameter / 2, circle.depth));
		cylinder.position.x += circle.konvaConfig.x;
		cylinder.position.y += circle.konvaConfig.y;
		cylinder.updateMatrix();
		mesh = CSG.subtract(mesh, cylinder);
	}
	*/

	return {
		polygons: CSG.fromMesh(mesh).toPolygons(),
		dimensions: {
			x: panel.width + 2 * EDGE_THICKNESS,
			y: panel.height + 2 * EDGE_THICKNESS,
			depth: heightNeed + BOTTOM_THICKNESS
		}
	};
};
