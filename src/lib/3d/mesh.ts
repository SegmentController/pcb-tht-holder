import { BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

import { MathMinMax } from '$lib/Math';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { MeshInfoTuple } from '$types/MeshInfo';
import type { RenderableProject } from '$types/Project';
import type { RectangleData } from '$types/RectangleData';
import { switchType } from '$types/switchType';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;
const TEXT_THICKNESS = 1;
const ROUND_CORRECTION = 1;
const POSITIVE_BASE_THICKNESS = 2;
const PANEL_EDGE_FACTOR = 1 / 3;
const PANEL_CENTER_FACTOR = 1 / 2;
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

/**
 * Checks if a leg overlaps with a circle component
 *
 * Uses closest-point-on-rectangle algorithm to detect intersection.
 * Leg is treated as an axis-aligned bounding box (top-left corner positioning).
 *
 * @param leg - Support leg with top-left corner coordinates
 * @param circle - Circle component with center coordinates
 * @returns true if the leg overlaps with the circle
 */
const isLegOverlappingCircle = (leg: LegData, circle: CircleData): boolean => {
	// Find closest point on leg rectangle to circle center
	const closestX = MathMinMax(circle.x, leg.x, leg.x + leg.width);
	const closestY = MathMinMax(circle.y, leg.y, leg.y + leg.height);

	// Calculate distance from closest point to circle center
	const distanceX = circle.x - closestX;
	const distanceY = circle.y - closestY;
	const distanceSquared = distanceX * distanceX + distanceY * distanceY;

	// Check if distance is less than radius (using squared values to avoid sqrt)
	return distanceSquared < circle.radius * circle.radius;
};

/**
 * Checks if a leg overlaps with a rectangle component
 *
 * Handles both non-rotated and rotated rectangles:
 * - Non-rotated: Simple AABB overlap test
 * - Rotated: Checks if any corner of the rotated rectangle is inside the leg,
 *   or if any corner of the leg is inside the rotated rectangle
 *
 * @param leg - Support leg with top-left corner coordinates
 * @param rectangle - Rectangle component with center coordinates and optional rotation
 * @returns true if the leg overlaps with the rectangle
 */
const isLegOverlappingRectangle = (leg: LegData, rectangle: RectangleData): boolean => {
	if (!rectangle.rotation) {
		// Simple AABB overlap test for non-rotated rectangles
		// Rectangle uses center coordinates, leg uses top-left
		const rectLeft = rectangle.x - rectangle.width / 2;
		const rectRight = rectangle.x + rectangle.width / 2;
		const rectTop = rectangle.y - rectangle.height / 2;
		const rectBottom = rectangle.y + rectangle.height / 2;

		const legLeft = leg.x;
		const legRight = leg.x + leg.width;
		const legTop = leg.y;
		const legBottom = leg.y + leg.height;

		return !(
			rectRight < legLeft ||
			rectLeft > legRight ||
			rectBottom < legTop ||
			rectTop > legBottom
		);
	}

	// Handle rotated rectangle - check if any corner is inside the other shape
	const angle = (rectangle.rotation * Math.PI) / 180;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	// Get the 4 corners of the rotated rectangle (relative to center)
	const halfWidth = rectangle.width / 2;
	const halfHeight = rectangle.height / 2;
	const corners = [
		{ x: -halfWidth, y: -halfHeight },
		{ x: halfWidth, y: -halfHeight },
		{ x: halfWidth, y: halfHeight },
		{ x: -halfWidth, y: halfHeight }
	];

	// Rotate corners and translate to world coordinates
	const rotatedCorners = corners.map((corner) => ({
		x: rectangle.x + corner.x * cos - corner.y * sin,
		y: rectangle.y + corner.x * sin + corner.y * cos
	}));

	// Check if any rotated rectangle corner is inside the leg
	for (const corner of rotatedCorners) {
		if (
			corner.x >= leg.x &&
			corner.x <= leg.x + leg.width &&
			corner.y >= leg.y &&
			corner.y <= leg.y + leg.height
		) {
			return true;
		}
	}

	// Check if any leg corner is inside the rotated rectangle
	// Use inverse rotation to check if leg corners are inside rectangle's local space
	const legCorners = [
		{ x: leg.x, y: leg.y },
		{ x: leg.x + leg.width, y: leg.y },
		{ x: leg.x + leg.width, y: leg.y + leg.height },
		{ x: leg.x, y: leg.y + leg.height }
	];

	for (const corner of legCorners) {
		// Transform leg corner to rectangle's local coordinate system
		const dx = corner.x - rectangle.x;
		const dy = corner.y - rectangle.y;
		const localX = dx * cos + dy * sin;
		const localY = -dx * sin + dy * cos;

		// Check if point is inside rectangle bounds
		if (Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight) {
			return true;
		}
	}

	return false;
};

/**
 * Generates three types of 3D meshes from a PCB project using CSG operations:
 * - Main mesh: Full-depth holder with component holes
 * - Hollow mesh: Shallow version with reduced material usage
 * - Positive mesh: Inverted design showing components as pillars (for PCB visualization)
 *
 * @param project - The PCB project containing panel settings and component data
 * @param font - Font for optional text label engraving
 * @returns Object containing vertex arrays and dimensions for all three mesh types
 */
const generateMesh = (project: RenderableProject, font: Font): MeshInfoTuple => {
	// Constant helper values
	const panel = project.panelSettings;
	const emptyHeight = panel.pcbThickness + panel.smdHeight;

	// Calculate max component height in single pass (avoid intermediate arrays)
	let componentHeight = panel.smdHeight;
	for (const rectangle of project.rectangles) {
		if (rectangle.depth > componentHeight) componentHeight = rectangle.depth;
	}
	for (const circle of project.circles) {
		if (circle.depth > componentHeight) componentHeight = circle.depth;
	}

	const needHeight = panel.pcbThickness + componentHeight;

	const hollowHeight = panel.pcbThickness + panel.smdHeight;

	// Apply print tolerance to panel dimensions (shrink the holder)
	const adjustedPanelWidth = panel.width + panel.printTolerance * 2;
	const adjustedPanelHeight = panel.height + panel.printTolerance * 2;

	// Create base meshes: full-depth main holder and shallow hollow version
	let mesh = MESH(
		BOX(
			adjustedPanelWidth + 2 * EDGE_THICKNESS,
			adjustedPanelHeight + 2 * EDGE_THICKNESS,
			needHeight + BOTTOM_THICKNESS
		)
	);
	mesh.updateMatrixWorld();
	let meshHollow = MESH(
		BOX(
			adjustedPanelWidth + 2 * EDGE_THICKNESS,
			adjustedPanelHeight + 2 * EDGE_THICKNESS,
			hollowHeight + BOTTOM_THICKNESS
		)
	);
	meshHollow.position.z += needHeight - hollowHeight;
	meshHollow.updateMatrixWorld();

	// Apply CSG operations to create internal structure
	const evaluator = new Evaluator();
	// Subtract main cavity for PCB and SMD components
	const emptySpace = MESH(
		BOX(adjustedPanelWidth, adjustedPanelHeight, emptyHeight + ROUND_CORRECTION)
	);
	{
		emptySpace.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
		emptySpace.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, emptySpace, SUBTRACTION);
		meshHollow = evaluator.evaluate(meshHollow, emptySpace, SUBTRACTION);
	}

	// Cut material from edges to reduce weight (4 cutouts at midpoints)
	const remover = MESH(
		BOX(
			adjustedPanelWidth * PANEL_EDGE_FACTOR,
			adjustedPanelHeight * PANEL_EDGE_FACTOR,
			emptyHeight + ROUND_CORRECTION
		)
	);
	{
		remover.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
		remover.updateMatrixWorld();

		const deltas = [
			{ dx: adjustedPanelWidth * PANEL_CENTER_FACTOR, dy: 0 },
			{ dx: -adjustedPanelWidth * PANEL_CENTER_FACTOR, dy: 0 },
			{ dx: 0, dy: adjustedPanelHeight * PANEL_CENTER_FACTOR },
			{ dx: 0, dy: -adjustedPanelHeight * PANEL_CENTER_FACTOR }
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

	// Factory function for creating positioned and rotated rectangle holes
	const boxFactory = (rectangle: RectangleData, depthOverride?: number | undefined) => {
		const width = rectangle.width + panel.printTolerance * 2;
		const height = rectangle.height + panel.printTolerance * 2;
		const depth = depthOverride ?? rectangle.depth + ROUND_CORRECTION;

		// Create geometry (no translation needed - pivot is already at center)
		const geometry = BOX(width, height, depth);

		const box = MESH(geometry);

		// Position at center in world space
		box.position.x += rectangle.x - adjustedPanelWidth * PANEL_CENTER_FACTOR;
		box.position.y -= rectangle.y - adjustedPanelHeight * PANEL_CENTER_FACTOR;
		box.position.z += BOTTOM_THICKNESS + (componentHeight - (depthOverride ?? rectangle.depth));

		// Apply rotation around center
		if (rectangle.rotation) box.rotateZ((-rectangle.rotation * Math.PI) / 180);

		box.updateMatrixWorld();
		return box;
	};

	// Subtract rectangle component holes from both meshes
	for (const rectangle of project.rectangles) {
		let box = boxFactory(rectangle);
		mesh = evaluator.evaluate(mesh, box, SUBTRACTION);
		if (rectangle.depth < hollowHeight) box = boxFactory(rectangle, hollowHeight * 2);
		meshHollow = evaluator.evaluate(meshHollow, box, SUBTRACTION);
	}

	// Factory function for creating positioned circle holes
	const circleFactory = (circle: CircleData, depthOverride?: number | undefined) => {
		const cylinder = MESH(
			CYLINDER(
				circle.radius + panel.printTolerance,
				depthOverride ?? circle.depth + ROUND_CORRECTION
			)
		);
		cylinder.position.x += circle.x - adjustedPanelWidth * PANEL_CENTER_FACTOR;
		cylinder.position.y -= circle.y - adjustedPanelHeight * PANEL_CENTER_FACTOR;
		cylinder.position.z += BOTTOM_THICKNESS + (componentHeight - (depthOverride ?? circle.depth));
		cylinder.updateMatrixWorld();
		return cylinder;
	};

	// Subtract circle component holes from both meshes
	for (const circle of project.circles) {
		let cylinder = circleFactory(circle);
		mesh = evaluator.evaluate(mesh, cylinder, SUBTRACTION);
		if (circle.depth < hollowHeight) cylinder = circleFactory(circle, hollowHeight * 2);
		meshHollow = evaluator.evaluate(meshHollow, cylinder, SUBTRACTION);
	}

	// Filter legs that overlap with components to prevent CSG conflicts
	const filteredLegs = project.legs.filter((leg) => {
		// Check if leg overlaps with any circle
		for (const circle of project.circles) {
			if (isLegOverlappingCircle(leg, circle)) return false;
		}
		// Check if leg overlaps with any rectangle
		for (const rectangle of project.rectangles) {
			if (isLegOverlappingRectangle(leg, rectangle)) return false;
		}
		return true;
	});
	const hiddenLegsCount = project.legs.length - filteredLegs.length;

	// Add support legs to main mesh with full component height
	for (const leg of filteredLegs) {
		const box = MESH(BOX(leg.width, leg.height, componentHeight));
		box.position.x +=
			leg.x + leg.width * PANEL_CENTER_FACTOR - adjustedPanelWidth * PANEL_CENTER_FACTOR;
		box.position.y -=
			leg.y + leg.height * PANEL_CENTER_FACTOR - adjustedPanelHeight * PANEL_CENTER_FACTOR;
		box.position.z += BOTTOM_THICKNESS;
		box.updateMatrixWorld();
		mesh = evaluator.evaluate(mesh, box, ADDITION);
	}

	// Add support legs to hollow mesh with SMD height
	for (const leg of filteredLegs) {
		const box = MESH(BOX(leg.width, leg.height, panel.smdHeight));
		box.position.x +=
			leg.x + leg.width * PANEL_CENTER_FACTOR - adjustedPanelWidth * PANEL_CENTER_FACTOR;
		box.position.y -=
			leg.y + leg.height * PANEL_CENTER_FACTOR - adjustedPanelHeight * PANEL_CENTER_FACTOR;
		box.position.z += BOTTOM_THICKNESS + (componentHeight - panel.smdHeight);
		box.updateMatrixWorld();
		meshHollow = evaluator.evaluate(meshHollow, box, ADDITION);
	}

	// Optionally engrave text label on front edge
	if (project.label) {
		const textGeometryInfo = TEXT(font, project.label, {
			x: (adjustedPanelWidth + 2 * EDGE_THICKNESS) * 0.75,
			y: (needHeight + BOTTOM_THICKNESS - emptyHeight) * 0.75
		});
		if (textGeometryInfo) {
			const text = MESH(textGeometryInfo.geometry);
			{
				text.position.x -= textGeometryInfo.size.w * PANEL_CENTER_FACTOR;
				text.position.y -=
					adjustedPanelHeight * PANEL_CENTER_FACTOR +
					EDGE_THICKNESS -
					TEXT_THICKNESS * PANEL_CENTER_FACTOR;
				text.position.z +=
					(needHeight + BOTTOM_THICKNESS - textGeometryInfo.size.h) * PANEL_CENTER_FACTOR;
				text.updateMatrixWorld();
			}
			mesh = evaluator.evaluate(mesh, text, ADDITION);
		}
	}

	// Generate positive mesh (thin base plate with components as pillars)
	// Note: Uses original panel dimensions (not adjusted) for visualization purposes
	let meshPositive = MESH(BOX(panel.width, panel.height, POSITIVE_BASE_THICKNESS));
	meshPositive.updateMatrixWorld();

	// Add rectangles as pillars
	for (const rectangle of project.rectangles) {
		const width = rectangle.width;
		const height = rectangle.height;
		const depth = rectangle.depth;

		const geometry = BOX(width, height, depth);
		const box = MESH(geometry);

		// Position at center in world space
		box.position.x += rectangle.x - panel.width * PANEL_CENTER_FACTOR;
		box.position.y -= rectangle.y - panel.height * PANEL_CENTER_FACTOR;
		box.position.z += POSITIVE_BASE_THICKNESS;

		// Apply rotation around center
		if (rectangle.rotation) box.rotateZ((-rectangle.rotation * Math.PI) / 180);

		box.updateMatrixWorld();
		meshPositive = evaluator.evaluate(meshPositive, box, ADDITION);
	}

	// Add circles as cylinders
	for (const circle of project.circles) {
		const cylinder = MESH(CYLINDER(circle.radius, circle.depth));
		cylinder.position.x += circle.x - panel.width * PANEL_CENTER_FACTOR;
		cylinder.position.y -= circle.y - panel.height * PANEL_CENTER_FACTOR;
		cylinder.position.z += POSITIVE_BASE_THICKNESS;
		cylinder.updateMatrixWorld();
		meshPositive = evaluator.evaluate(meshPositive, cylinder, ADDITION);
	}

	return {
		main: {
			vertexArray: new Float32Array(mesh.geometry.attributes['position'].array),
			dimensions: {
				width: adjustedPanelWidth + 2 * EDGE_THICKNESS,
				height: adjustedPanelHeight + 2 * EDGE_THICKNESS,
				depth: needHeight + BOTTOM_THICKNESS
			}
		},
		hollow: {
			vertexArray: new Float32Array(meshHollow.geometry.attributes['position'].array),
			dimensions: {
				width: adjustedPanelWidth + 2 * EDGE_THICKNESS,
				height: adjustedPanelHeight + 2 * EDGE_THICKNESS,
				depth: hollowHeight + BOTTOM_THICKNESS
			}
		},
		positive: {
			vertexArray: new Float32Array(meshPositive.geometry.attributes['position'].array),
			dimensions: {
				width: panel.width,
				height: panel.height,
				depth: POSITIVE_BASE_THICKNESS + componentHeight
			}
		},
		hiddenLegsCount
	};
};

/**
 * Asynchronously generates 3D meshes for a PCB project.
 * Loads the required font and delegates to generateMesh().
 *
 * @param project - The PCB project to generate meshes for
 * @returns Promise resolving to mesh info for main, hollow, and positive meshes
 * @throws Error message string if mesh generation fails
 */
export const generateMeshLazy = async (project: RenderableProject): Promise<MeshInfoTuple> => {
	try {
		const font = await loadFont();
		return generateMesh(project, font);
	} catch (error) {
		throw error instanceof Error ? error.message : error;
	}
};
