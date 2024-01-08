import * as THREE from 'three';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

import type { RenderableProject } from '$types/Project';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;
const ROUND_CORRECTION = 1;

export type MeshDimensionInfo = {
	x: number;
	y: number;
	depth: number;
};
export type MeshInfo = {
	vertexArray: Float32Array;
	dimensions: MeshDimensionInfo;
};

const MESH = (geometry: THREE.BoxGeometry | THREE.CylinderGeometry) => {
	const result = new Brush(geometry.translate(0, 0, 0));
	if (geometry instanceof THREE.BoxGeometry) result.position.z = geometry.parameters.depth / 2;
	else if (geometry instanceof THREE.CylinderGeometry) {
		result.position.z = geometry.parameters.height / 2;
		result.rotateX(Math.PI / 2);
	}
	result.updateMatrixWorld();
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
	let mesh = MESH(
		BOX(
			panel.width + 2 * EDGE_THICKNESS,
			panel.height + 2 * EDGE_THICKNESS,
			needHeight + BOTTOM_THICKNESS
		)
	);

	const evaluator = new Evaluator();
	const emptySpace = MESH(BOX(panel.width, panel.height, emptyHeight + ROUND_CORRECTION));
	{
		emptySpace.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
		emptySpace.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, emptySpace, SUBTRACTION);
	}
	const remover = MESH(BOX(panel.width / 3, panel.height / 3, emptyHeight + ROUND_CORRECTION));
	{
		remover.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
		remover.updateMatrixWorld();

		const deltas = [
			{ dx: panel.width / 2, dy: 0 },
			{ dx: -panel.width / 2, dy: 0 },
			{ dx: 0, dy: panel.height / 2 },
			{ dx: 0, dy: -panel.height / 2 }
		];
		for (const delta of deltas) {
			remover.position.x += delta.dx;
			remover.position.y += delta.dy;
			try {
				remover.updateMatrixWorld();
				mesh = evaluator.evaluate(mesh, remover, SUBTRACTION);
			} finally {
				remover.position.x -= delta.dx;
				remover.position.y -= delta.dy;
			}
		}
	}
	for (const rectangle of project.rectangles) {
		const box = MESH(BOX(rectangle.width, rectangle.height, rectangle.depth + ROUND_CORRECTION));
		box.position.x += rectangle.x + rectangle.width / 2 - panel.width / 2;
		box.position.y -= rectangle.y + rectangle.height / 2 - panel.height / 2;
		box.position.z += BOTTOM_THICKNESS + (componentHeigh - rectangle.depth);
		box.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, box, SUBTRACTION);
	}
	for (const circle of project.circles) {
		const cylinder = MESH(CYLINDER(circle.radius, circle.depth + ROUND_CORRECTION));
		cylinder.position.x += circle.x - panel.width / 2;
		cylinder.position.y -= circle.y - panel.height / 2;
		cylinder.position.z += BOTTOM_THICKNESS + (componentHeigh - circle.depth);
		cylinder.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, cylinder, SUBTRACTION);
	}
	for (const leg of project.legs) {
		const box = MESH(BOX(leg.width, leg.height, componentHeigh));
		box.position.x += leg.x + leg.width / 2 - panel.width / 2;
		box.position.y -= leg.y + leg.height / 2 - panel.height / 2;
		box.position.z += BOTTOM_THICKNESS;
		box.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, box, ADDITION);
	}

	return {
		vertexArray: new Float32Array(mesh.geometry.attributes['position'].array),
		dimensions: {
			x: panel.width + 2 * EDGE_THICKNESS,
			y: panel.height + 2 * EDGE_THICKNESS,
			depth: needHeight + BOTTOM_THICKNESS
		}
	};
};

export const generateMeshLazy = async (project: RenderableProject): Promise<MeshInfo> =>
	new Promise((resolve, reject) =>
		setTimeout(() => {
			try {
				resolve(generateMesh(project));
			} catch (error) {
				reject(error instanceof Error ? error.message : error);
			}
		})
	);
