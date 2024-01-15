import { BoxGeometry, CylinderGeometry } from 'three';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

import { MathMax, MathMinMax } from '$lib/Math';
import type { MeshInfoTuple } from '$types/MeshInfo';
import type { RenderableProject } from '$types/Project';
import { switchType } from '$types/switchType';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;
const ROUND_CORRECTION = 1;

const CYLINDER = (radius: number, height: number) =>
	new CylinderGeometry(radius, radius, height, MathMinMax(radius * 8, 16, 48));

const BOX = (width: number, height: number, depth: number) => new BoxGeometry(width, height, depth);

const MESH = (geometry: BoxGeometry | CylinderGeometry) => {
	const result = new Brush(geometry.translate(0, 0, 0));

	switchType(geometry)
		.case(BoxGeometry, (geometry) => (result.position.z = geometry.parameters.depth / 2))
		.case(CylinderGeometry, (geometry) => {
			result.position.z = geometry.parameters.height / 2;
			result.rotateX(Math.PI / 2);
		});

	result.updateMatrixWorld();

	return result;
};

export const generateMesh = (project: RenderableProject): MeshInfoTuple => {
	// Constant helper values
	const panel = project.panelSettings;
	const emptyHeight = panel.pcbThickness + panel.smdHeight;
	const componentHeigh = MathMax([
		panel.smdHeight,
		...project.rectangles.map((r) => r.depth),
		...project.circles.map((c) => c.depth)
	]);
	const needHeight = panel.pcbThickness + componentHeigh;

	const coverageHeight = panel.pcbThickness + panel.smdHeight;

	// Lets create mesh+meshCoverage...
	let mesh = MESH(
		BOX(
			panel.width + 2 * EDGE_THICKNESS,
			panel.height + 2 * EDGE_THICKNESS,
			needHeight + BOTTOM_THICKNESS
		)
	);
	mesh.updateMatrixWorld();
	let meshCoverage = MESH(
		BOX(
			panel.width + 2 * EDGE_THICKNESS,
			panel.height + 2 * EDGE_THICKNESS,
			coverageHeight + BOTTOM_THICKNESS
		)
	);
	meshCoverage.position.z += needHeight - coverageHeight;
	meshCoverage.updateMatrixWorld();

	// Go operations
	const evaluator = new Evaluator();
	const emptySpace = MESH(BOX(panel.width, panel.height, emptyHeight + ROUND_CORRECTION));
	{
		emptySpace.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
		emptySpace.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, emptySpace, SUBTRACTION);
		meshCoverage = evaluator.evaluate(meshCoverage, emptySpace, SUBTRACTION);
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
				meshCoverage = evaluator.evaluate(meshCoverage, remover, SUBTRACTION);
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
		meshCoverage = evaluator.evaluate(meshCoverage, box, SUBTRACTION);
	}
	for (const circle of project.circles) {
		const cylinder = MESH(CYLINDER(circle.radius, circle.depth + ROUND_CORRECTION));
		cylinder.position.x += circle.x - panel.width / 2;
		cylinder.position.y -= circle.y - panel.height / 2;
		cylinder.position.z += BOTTOM_THICKNESS + (componentHeigh - circle.depth);
		cylinder.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, cylinder, SUBTRACTION);
		meshCoverage = evaluator.evaluate(meshCoverage, cylinder, SUBTRACTION);
	}
	for (const leg of project.legs) {
		const box = MESH(BOX(leg.width, leg.height, panel.smdHeight));
		box.position.x += leg.x + leg.width / 2 - panel.width / 2;
		box.position.y -= leg.y + leg.height / 2 - panel.height / 2;
		box.position.z += BOTTOM_THICKNESS + (componentHeigh - panel.smdHeight);
		box.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, box, ADDITION);
		meshCoverage = evaluator.evaluate(meshCoverage, box, ADDITION);
	}

	return {
		main: {
			vertexArray: new Float32Array(mesh.geometry.attributes['position'].array),
			dimensions: {
				width: panel.width + 2 * EDGE_THICKNESS,
				height: panel.height + 2 * EDGE_THICKNESS,
				depth: needHeight + BOTTOM_THICKNESS
			}
		},
		coverage: {
			vertexArray: new Float32Array(meshCoverage.geometry.attributes['position'].array),
			dimensions: {
				width: panel.width + 2 * EDGE_THICKNESS,
				height: panel.height + 2 * EDGE_THICKNESS,
				depth: coverageHeight + BOTTOM_THICKNESS
			}
		}
	};
};

export const generateMeshLazy = async (project: RenderableProject): Promise<MeshInfoTuple> =>
	new Promise((resolve, reject) =>
		setTimeout(() => {
			try {
				resolve(generateMesh(project));
			} catch (error) {
				reject(error instanceof Error ? error.message : error);
			}
		})
	);
