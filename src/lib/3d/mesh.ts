import { BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

import { MathMax, MathMinMax } from '$lib/Math';
import type { CircleData } from '$types/CircleData';
import type { MeshInfoTuple } from '$types/MeshInfo';
import type { RenderableProject } from '$types/Project';
import type { RectangleData } from '$types/RectangleData';
import { switchType } from '$types/switchType';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;
const TEXT_THICKNESS = 1;
const ROUND_CORRECTION = 1;
/*global __BASE_URL__*/
const BASE_URL = __BASE_URL__;

let cachedFont: Font | undefined;
const loadFont = (): Promise<Font> => {
	if (cachedFont) return Promise.resolve(cachedFont);
	return new Promise((resolve, reject) => {
		new FontLoader().load(
			BASE_URL + '/roboto_regular.json',
			(font: Font) => {
				cachedFont = font;
				resolve(font);
			},
			undefined,
			reject
		);
	});
};

const CYLINDER = (radius: number, height: number) =>
	new CylinderGeometry(radius, radius, height, MathMinMax(radius * 8, 16, 48));

const BOX = (width: number, height: number, depth: number) => new BoxGeometry(width, height, depth);

type TextGeometryData = {
	geometry: TextGeometry;
	size: {
		w: number;
		h: number;
	};
};
const TEXT = (
	font: Font,
	text: string,
	boundary: { x: number; y: number }
): TextGeometryData | undefined => {
	let size = 20;
	while (size) {
		const gText = new TextGeometry(text, {
			font,
			size,
			depth: TEXT_THICKNESS,
			curveSegments: 4,
			steps: 1,
			bevelEnabled: false
		});
		gText.computeBoundingBox();
		if (gText.boundingBox) {
			const measuredSize = gText.boundingBox.getSize(new Vector3());
			if (measuredSize.x < boundary.x && measuredSize.y < boundary.y)
				return {
					geometry: gText,
					size: {
						w: measuredSize.x,
						h: measuredSize.y
					}
				};
		}
		size--;
	}
};

const MESH = (geometry: BoxGeometry | CylinderGeometry | TextGeometry) => {
	const result = new Brush(geometry.translate(0, 0, 0));

	switchType(geometry)
		.case(BoxGeometry, (geometry) => (result.position.z = geometry.parameters.depth / 2))
		.case(CylinderGeometry, (geometry) => {
			result.position.z = geometry.parameters.height / 2;
			result.rotateX(Math.PI / 2);
		})
		.case(TextGeometry, () => {
			result.position.z = 0;
			result.rotateX(Math.PI / 2);
		});

	result.updateMatrixWorld();

	return result;
};

const generateMesh = (project: RenderableProject, font: Font): MeshInfoTuple => {
	// Constant helper values
	const panel = project.panelSettings;
	const emptyHeight = panel.pcbThickness + panel.smdHeight;
	const componentHeigh = MathMax([
		panel.smdHeight,
		...project.rectangles.map((r) => r.depth),
		...project.circles.map((c) => c.depth)
	]);
	const needHeight = panel.pcbThickness + componentHeigh;

	const hollowHeight = panel.pcbThickness + panel.smdHeight;

	// Lets create mesh+hollow...
	let mesh = MESH(
		BOX(
			panel.width + 2 * EDGE_THICKNESS,
			panel.height + 2 * EDGE_THICKNESS,
			needHeight + BOTTOM_THICKNESS
		)
	);
	mesh.updateMatrixWorld();
	let meshHollow = MESH(
		BOX(
			panel.width + 2 * EDGE_THICKNESS,
			panel.height + 2 * EDGE_THICKNESS,
			hollowHeight + BOTTOM_THICKNESS
		)
	);
	meshHollow.position.z += needHeight - hollowHeight;
	meshHollow.updateMatrixWorld();

	// Go operations
	const evaluator = new Evaluator();
	const emptySpace = MESH(BOX(panel.width, panel.height, emptyHeight + ROUND_CORRECTION));
	{
		emptySpace.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
		emptySpace.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, emptySpace, SUBTRACTION);
		meshHollow = evaluator.evaluate(meshHollow, emptySpace, SUBTRACTION);
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
				meshHollow = evaluator.evaluate(meshHollow, remover, SUBTRACTION);
			} finally {
				remover.position.x -= delta.dx;
				remover.position.y -= delta.dy;
			}
		}
	}

	const boxFactory = (rectangle: RectangleData, depthOverride?: number | undefined) => {
		const box = MESH(
			BOX(rectangle.width, rectangle.height, depthOverride ?? rectangle.depth + ROUND_CORRECTION)
		);
		box.position.x += rectangle.x + rectangle.width / 2 - panel.width / 2;
		box.position.y -= rectangle.y + rectangle.height / 2 - panel.height / 2;
		box.position.z += BOTTOM_THICKNESS + (componentHeigh - (depthOverride ?? rectangle.depth));
		box.updateMatrixWorld();
		return box;
	};
	for (const rectangle of project.rectangles) {
		let box = boxFactory(rectangle);
		mesh = evaluator.evaluate(mesh, box, SUBTRACTION);
		if (rectangle.depth < hollowHeight) box = boxFactory(rectangle, hollowHeight * 2);
		meshHollow = evaluator.evaluate(meshHollow, box, SUBTRACTION);
	}

	const circleFactory = (circle: CircleData, depthOverride?: number | undefined) => {
		const cylinder = MESH(
			CYLINDER(circle.radius, depthOverride ?? circle.depth + ROUND_CORRECTION)
		);
		cylinder.position.x += circle.x - panel.width / 2;
		cylinder.position.y -= circle.y - panel.height / 2;
		cylinder.position.z += BOTTOM_THICKNESS + (componentHeigh - (depthOverride ?? circle.depth));
		cylinder.updateMatrixWorld();
		return cylinder;
	};
	for (const circle of project.circles) {
		let cylinder = circleFactory(circle);
		mesh = evaluator.evaluate(mesh, cylinder, SUBTRACTION);
		if (circle.depth < hollowHeight) cylinder = circleFactory(circle, hollowHeight * 2);
		meshHollow = evaluator.evaluate(meshHollow, cylinder, SUBTRACTION);
	}

	for (const leg of project.legs) {
		const box = MESH(BOX(leg.width, leg.height, panel.smdHeight));
		box.position.x += leg.x + leg.width / 2 - panel.width / 2;
		box.position.y -= leg.y + leg.height / 2 - panel.height / 2;
		box.position.z += BOTTOM_THICKNESS + (componentHeigh - panel.smdHeight);
		box.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, box, ADDITION);
		meshHollow = evaluator.evaluate(meshHollow, box, ADDITION);
	}
	if (project.label) {
		const textGeometryInfo = TEXT(font, project.label, {
			x: (panel.width + 2 * EDGE_THICKNESS) * 0.75,
			y: (needHeight + BOTTOM_THICKNESS - emptyHeight) * 0.75
		});
		if (textGeometryInfo) {
			const text = MESH(textGeometryInfo.geometry);
			{
				text.position.x -= textGeometryInfo.size.w / 2;
				text.position.y -= panel.height / 2 + EDGE_THICKNESS - TEXT_THICKNESS / 2;
				text.position.z += (needHeight + BOTTOM_THICKNESS - textGeometryInfo.size.h) / 2;
				text.updateMatrixWorld();
			}
			mesh = evaluator.evaluate(mesh, text, ADDITION);
		}
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
		hollow: {
			vertexArray: new Float32Array(meshHollow.geometry.attributes['position'].array),
			dimensions: {
				width: panel.width + 2 * EDGE_THICKNESS,
				height: panel.height + 2 * EDGE_THICKNESS,
				depth: hollowHeight + BOTTOM_THICKNESS
			}
		}
	};
};

export const generateMeshLazy = async (project: RenderableProject): Promise<MeshInfoTuple> => {
	try {
		const font = await loadFont();
		return generateMesh(project, font);
	} catch (error) {
		throw error instanceof Error ? error.message : error;
	}
};
