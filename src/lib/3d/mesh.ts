import {
	Box3,
	BoxGeometry,
	type BufferGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Shape,
	Vector3
} from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

import { isLegOverlappingCircle, isLegOverlappingRectangle } from '$lib/3d/legOverlap';
import { repairMesh } from '$lib/3d/meshRepair';
import { BOTTOM_THICKNESS, POSITIVE_BASE_THICKNESS } from '$lib/3d/placement';
import { switchType } from '$lib/3d/switchType';
import { MathMinMax } from '$lib/util/math';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { MeshInfo, MeshInfoTuple } from '$types/MeshInfo';
import type { RenderableProject } from '$types/Project';
import type { RectangleData } from '$types/RectangleData';

const EDGE_THICKNESS = 2;
const TEXT_THICKNESS = 1;
const ROUND_CORRECTION = 1;
// Pillars sink into the base plate instead of just touching it: coplanar contact faces make the
// boolean union both slow (blown-up triangulation) and fragile
const PILLAR_SINK = 1;
const PANEL_EDGE_FACTOR = 1 / 3;
const PANEL_CENTER_FACTOR = 1 / 2;
const BATCH_MARGIN = 0.001; // mm; solids closer than this are never merged into one CSG operand
const YIELD_DELAY_MS = 0; // Set to 0 for production, 10+ for testing progress UI
const YIELD_INTERVAL_MS = 30; // with no delay configured: yield to the event loop at most this often
/*global __BASE_URL__*/
const BASE_URL = __BASE_URL__;

/**
 * Progress callback function type for mesh generation
 * @param current - Current operation number
 * @param total - Total number of operations
 */
export type ProgressCallback = (current: number, total: number) => void;

export type MeshKind = 'main' | 'hollow' | 'positive';

/** Thrown from a generation when its `isCancelled` callback returns true */
export class MeshCancelledError extends Error {
	constructor() {
		super('Mesh generation cancelled');
		this.name = 'MeshCancelledError';
	}
}

let lastYield = 0;
/**
 * Yields control back to the event loop to prevent UI blocking (and to let a worker receive
 * cancel messages). With YIELD_DELAY_MS > 0 it always waits, which is useful to test the progress UI.
 */
const yieldToEventLoop = async () => {
	if (YIELD_DELAY_MS === 0 && performance.now() - lastYield < YIELD_INTERVAL_MS) return;
	await new Promise<void>((resolve) => setTimeout(resolve, YIELD_DELAY_MS));
	lastYield = performance.now();
};

let cachedFont: Font | undefined;
export const loadFont = (): Promise<Font> => {
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

// CSG only needs positions: uv/normal would be interpolated for every clipped triangle for nothing
const positionOnly = <T extends BufferGeometry>(geometry: T): T => {
	geometry.deleteAttribute('uv');
	geometry.deleteAttribute('normal');
	return geometry;
};

const CYLINDER = (radius: number, height: number) =>
	positionOnly(new CylinderGeometry(radius, radius, height, MathMinMax(radius * 8, 16, 48)));

const BOX = (width: number, height: number, depth: number) =>
	positionOnly(new BoxGeometry(width, height, depth));

type TextGeometryData = {
	geometry: TextGeometry;
	size: {
		w: number;
		h: number;
	};
};

const TEXT_MAX_SIZE = 20;
const buildText = (font: Font, text: string, size: number) =>
	positionOnly(
		new TextGeometry(text, {
			font,
			size,
			depth: TEXT_THICKNESS,
			curveSegments: 4,
			steps: 1,
			bevelEnabled: false
		})
	);

const measure = (geometry: BufferGeometry) => {
	geometry.computeBoundingBox();
	return geometry.boundingBox?.getSize(new Vector3());
};

/**
 * Largest integer text size (<= 20) whose bounding box fits strictly inside the boundary.
 * Glyph extents scale linearly with `size` (fixed depth, no bevel), so the size is estimated from
 * one measurement and verified, instead of building up to 20 geometries.
 */
const TEXT = (
	font: Font,
	text: string,
	boundary: { x: number; y: number }
): TextGeometryData | undefined => {
	const fits = (size: Vector3) => size.x < boundary.x && size.y < boundary.y;

	let geometry = buildText(font, text, TEXT_MAX_SIZE);
	let measured = measure(geometry);
	if (!measured) return;
	if (fits(measured)) return { geometry, size: { w: measured.x, h: measured.y } };

	// Linear estimate, then verify/step down (guards float rounding at the boundary)
	const scale = Math.min(boundary.x / measured.x, boundary.y / measured.y);
	for (
		let size = Math.min(TEXT_MAX_SIZE - 1, Math.floor(TEXT_MAX_SIZE * scale));
		size > 0;
		size--
	) {
		geometry.dispose();
		geometry = buildText(font, text, size);
		measured = measure(geometry);
		if (measured && fits(measured)) return { geometry, size: { w: measured.x, h: measured.y } };
	}
};

const MESH = (geometry: BoxGeometry | CylinderGeometry | TextGeometry) => {
	const result = new Brush(geometry);

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
 * Splits solids (given by their bounding boxes) into groups that are pairwise disjoint, greedy
 * first fit. Only such groups may share one CSG operand: overlapping shells would break the
 * inside/outside parity test of the boolean evaluation.
 *
 * @returns Index groups into `bounds`, in first-fit order
 */
export const partitionDisjoint = (bounds: Box3[]): number[][] => {
	const groups: Array<{ indices: number[]; bounds: Box3[] }> = [];
	for (const [index, box] of bounds.entries()) {
		const padded = box.clone().expandByScalar(BATCH_MARGIN);
		const group = groups.find((candidate) =>
			candidate.bounds.every((other) => !other.intersectsBox(padded))
		);
		if (group) {
			group.indices.push(index);
			group.bounds.push(padded);
		} else groups.push({ indices: [index], bounds: [padded] });
	}
	return groups.map((group) => group.indices);
};

/** Bakes world transforms into the geometry and merges disjoint solids into a single brush */
const unionBrush = (brushes: Brush[]): Brush => {
	if (brushes.length === 1) return brushes[0]!;

	const baked = brushes.map((brush) => {
		brush.updateMatrixWorld();
		return brush.geometry.clone().applyMatrix4(brush.matrixWorld);
	});
	const merged = mergeGeometries(baked, false);
	for (const geometry of baked) geometry.dispose();

	const result = new Brush(merged);
	result.updateMatrixWorld();
	return result;
};

/** Groups solids that can be combined into one boolean operation and returns the operands */
const batchBrushes = (brushes: Brush[]): Brush[] => {
	const bounds = brushes.map((brush) => new Box3().setFromObject(brush, true));
	return partitionDisjoint(bounds).map((indices) =>
		unionBrush(indices.map((index) => brushes[index]!))
	);
};

/**
 * Cavity for PCB + SMD parts with the 4 edge cutouts merged into one plus-shaped prism:
 * a single boolean operation instead of five.
 */
const cavityCutter = (width: number, height: number, depth: number) => {
	const halfWidth = width * PANEL_CENTER_FACTOR;
	const halfHeight = height * PANEL_CENTER_FACTOR;
	// Cutouts are centered on the panel edges and measure width/3 x height/3
	const notchWidth = (width * PANEL_EDGE_FACTOR) / 2;
	const notchHeight = (height * PANEL_EDGE_FACTOR) / 2;

	// Counter-clockwise outline: rectangle with a notch bulging out of every side
	const outline: Array<[number, number]> = [
		[-halfWidth, -halfHeight],
		[-notchWidth, -halfHeight],
		[-notchWidth, -halfHeight - notchHeight],
		[notchWidth, -halfHeight - notchHeight],
		[notchWidth, -halfHeight],
		[halfWidth, -halfHeight],
		[halfWidth, -notchHeight],
		[halfWidth + notchWidth, -notchHeight],
		[halfWidth + notchWidth, notchHeight],
		[halfWidth, notchHeight],
		[halfWidth, halfHeight],
		[notchWidth, halfHeight],
		[notchWidth, halfHeight + notchHeight],
		[-notchWidth, halfHeight + notchHeight],
		[-notchWidth, halfHeight],
		[-halfWidth, halfHeight],
		[-halfWidth, notchHeight],
		[-halfWidth - notchWidth, notchHeight],
		[-halfWidth - notchWidth, -notchHeight],
		[-halfWidth, -notchHeight]
	];

	const shape = new Shape();
	for (const [index, [x, y]] of outline.entries())
		if (index === 0) shape.moveTo(x, y);
		else shape.lineTo(x, y);
	shape.closePath();

	return new Brush(positionOnly(new ExtrudeGeometry(shape, { depth, bevelEnabled: false })));
};

export type MeshSession = {
	/** Legs hidden because they overlap a component hole (known without generating anything) */
	readonly hiddenLegsCount: number;
	/** Progress steps of generating everything from scratch */
	readonly totalOperations: number;
	/**
	 * Generates one mesh variant. Results are memoized; the hollow variant is derived from the
	 * main variant's solid, so asking for it builds (or reuses) that first.
	 * @throws MeshCancelledError when `isCancelled` returns true between operations
	 */
	generate: (
		kind: MeshKind,
		onProgress?: ProgressCallback,
		isCancelled?: () => boolean
	) => Promise<MeshInfo>;
};

/**
 * Prepares generation of the 3D meshes of a PCB project using CSG operations:
 * - main: full-depth holder with component holes
 * - hollow: shallow version with reduced material usage, sliced from the main solid
 * - positive: inverted design showing components as pillars (for PCB visualization)
 *
 * Variants are generated on demand and memoized, so the UI can show the main mesh as soon as it
 * is ready. Disjoint cutters/legs/pillars are merged into one boolean operand per batch, which
 * avoids rebuilding the BVH of the growing mesh once per component.
 *
 * @param project - The PCB project containing panel settings and component data
 * @param font - Font for optional text label engraving
 */
export const createMeshSession = (project: RenderableProject, font?: Font): MeshSession => {
	// Constant helper values
	const panel = project.panelSettings;
	const emptyHeight = panel.pcbThickness + panel.smdHeight;

	// Calculate max component height in single pass (avoid intermediate arrays)
	let componentHeight = panel.smdHeight;
	for (const rectangle of project.rectangles)
		if (rectangle.depth > componentHeight) componentHeight = rectangle.depth;

	for (const circle of project.circles)
		if (circle.depth > componentHeight) componentHeight = circle.depth;

	const needHeight = panel.pcbThickness + componentHeight;
	const hollowHeight = panel.pcbThickness + panel.smdHeight;

	// Apply print tolerance to panel dimensions (shrink the holder)
	const adjustedPanelWidth = panel.width - panel.printTolerance * 2;
	const adjustedPanelHeight = panel.height - panel.printTolerance * 2;
	const outerWidth = adjustedPanelWidth + 2 * EDGE_THICKNESS;
	const outerHeight = adjustedPanelHeight + 2 * EDGE_THICKNESS;

	// Hide legs that would fill a component hole
	const filteredLegs = project.legs.filter((leg) => {
		for (const circle of project.circles) if (isLegOverlappingCircle(leg, circle)) return false;
		for (const rectangle of project.rectangles)
			if (isLegOverlappingRectangle(leg, rectangle)) return false;
		return true;
	});
	const hiddenLegsCount = project.legs.length - filteredLegs.length;

	// Factory function for creating positioned and rotated rectangle holes
	const boxFactory = (rectangle: RectangleData, depthOverride?: number) => {
		const width = rectangle.width + panel.printTolerance * 2;
		const height = rectangle.height + panel.printTolerance * 2;
		const depth = depthOverride ?? rectangle.depth + ROUND_CORRECTION;

		// Create geometry (no translation needed - pivot is already at center)
		const box = MESH(BOX(width, height, depth));

		// Position at center in world space
		box.position.x += rectangle.x - panel.width * PANEL_CENTER_FACTOR;
		box.position.y -= rectangle.y - panel.height * PANEL_CENTER_FACTOR;
		box.position.z += BOTTOM_THICKNESS + (componentHeight - (depthOverride ?? rectangle.depth));

		// Apply rotation around center
		if (rectangle.rotation) box.rotateZ((-rectangle.rotation * Math.PI) / 180);

		box.updateMatrixWorld();
		return box;
	};

	// Factory function for creating positioned circle holes
	const circleFactory = (circle: CircleData, depthOverride?: number) => {
		const cylinder = MESH(
			CYLINDER(
				circle.radius + panel.printTolerance,
				depthOverride ?? circle.depth + ROUND_CORRECTION
			)
		);
		cylinder.position.x += circle.x - panel.width * PANEL_CENTER_FACTOR;
		cylinder.position.y -= circle.y - panel.height * PANEL_CENTER_FACTOR;
		cylinder.position.z += BOTTOM_THICKNESS + (componentHeight - (depthOverride ?? circle.depth));
		cylinder.updateMatrixWorld();
		return cylinder;
	};

	// Component holes (rectangles and circles in one pass), merged into disjoint batches
	const holeBatches = batchBrushes([
		...project.rectangles.map((rectangle) => boxFactory(rectangle)),
		...project.circles.map((circle) => circleFactory(circle))
	]);

	// Shallow components (shorter than the hollow holder) must cut through its floor
	const hollowPunchBatches = batchBrushes([
		...project.rectangles
			.filter((rectangle) => rectangle.depth < hollowHeight)
			.map((rectangle) => boxFactory(rectangle, hollowHeight * 2)),
		...project.circles
			.filter((circle) => circle.depth < hollowHeight)
			.map((circle) => circleFactory(circle, hollowHeight * 2))
	]);

	// Support legs, merged into disjoint batches: full component height for the main holder,
	// SMD height (standing on the floor of the shallow holder) for the hollow one
	const legFactory = (leg: LegData, height: number) => {
		const box = MESH(BOX(leg.width, leg.height, height));
		box.position.x += leg.x + leg.width * PANEL_CENTER_FACTOR - panel.width * PANEL_CENTER_FACTOR;
		box.position.y -= leg.y + leg.height * PANEL_CENTER_FACTOR - panel.height * PANEL_CENTER_FACTOR;
		box.position.z += BOTTOM_THICKNESS + (componentHeight - height);
		box.updateMatrixWorld();
		return box;
	};
	const legBatches = batchBrushes(filteredLegs.map((leg) => legFactory(leg, componentHeight)));
	const hollowLegBatches = batchBrushes(
		filteredLegs.map((leg) => legFactory(leg, panel.smdHeight))
	);

	// Optional text label on front edge (measured up front so progress totals are exact)
	if (project.label && !font) throw new Error('A font is required to engrave the print label');
	const textInfo =
		font && project.label
			? TEXT(font, project.label, {
					x: outerWidth * 0.75,
					y: (needHeight + BOTTOM_THICKNESS - emptyHeight) * 0.75
				})
			: undefined;

	// Positive mesh pillars (thin base plate with components standing on it)
	const pillarBatches = batchBrushes([
		...project.rectangles.map((rectangle) => {
			const box = MESH(BOX(rectangle.width, rectangle.height, rectangle.depth + PILLAR_SINK));
			box.position.x += rectangle.x - panel.width * PANEL_CENTER_FACTOR;
			box.position.y -= rectangle.y - panel.height * PANEL_CENTER_FACTOR;
			box.position.z += POSITIVE_BASE_THICKNESS - PILLAR_SINK;
			if (rectangle.rotation) box.rotateZ((-rectangle.rotation * Math.PI) / 180);
			box.updateMatrixWorld();
			return box;
		}),
		...project.circles.map((circle) => {
			const cylinder = MESH(CYLINDER(circle.radius, circle.depth + PILLAR_SINK));
			cylinder.position.x += circle.x - panel.width * PANEL_CENTER_FACTOR;
			cylinder.position.y -= circle.y - panel.height * PANEL_CENTER_FACTOR;
			cylinder.position.z += POSITIVE_BASE_THICKNESS - PILLAR_SINK;
			cylinder.updateMatrixWorld();
			return cylinder;
		})
	]);

	const evaluator = new Evaluator();
	evaluator.attributes = ['position'];
	evaluator.useGroups = false;

	// Progress steps (one per boolean operation) of each stage
	const solidOperations = 1 + holeBatches.length; // cavity + holes, shared by main and hollow
	const mainOperations = legBatches.length + (textInfo ? 1 : 0);
	const hollowOperations = 1 + hollowPunchBatches.length + hollowLegBatches.length;
	const positiveOperations = pillarBatches.length;
	const totalOperations = solidOperations + mainOperations + hollowOperations + positiveOperations;

	type Step = () => Promise<void>;
	const createStep = (
		total: number,
		onProgress?: ProgressCallback,
		isCancelled?: () => boolean
	): Step => {
		let current = 0;
		return async () => {
			if (isCancelled?.()) throw new MeshCancelledError();
			current++;
			onProgress?.(current, total);
			await yieldToEventLoop();
			if (isCancelled?.()) throw new MeshCancelledError();
		};
	};

	let solidPromise: Promise<Brush> | undefined;
	let isSolidBuilt = false;

	/** Shared solid of both holders: base block minus cavity (with edge cutouts) and component holes */
	const getBaseSolid = (step: Step): Promise<Brush> => {
		solidPromise ??= (async () => {
			let solid = MESH(BOX(outerWidth, outerHeight, needHeight + BOTTOM_THICKNESS));

			// Cavity for PCB and SMD components plus edge cutouts to reduce weight
			const cavity = cavityCutter(
				adjustedPanelWidth,
				adjustedPanelHeight,
				emptyHeight + ROUND_CORRECTION
			);
			cavity.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
			cavity.updateMatrixWorld();
			solid = evaluator.evaluate(solid, cavity, SUBTRACTION);
			await step();

			for (const batch of holeBatches) {
				solid = evaluator.evaluate(solid, batch, SUBTRACTION);
				await step();
			}
			isSolidBuilt = true;
			return solid;
		})().catch((error) => {
			solidPromise = undefined; // cancelled/failed: the next request starts over
			throw error;
		});
		return solidPromise;
	};

	const toMeshInfo = (solid: Brush, dimensions: MeshInfo['dimensions']): MeshInfo => {
		// CSG output has near-duplicate seam vertices and T-junctions (open edges for slicers);
		// the repair welds the former and splits edges at the latter
		const { index, attributes } = solid.geometry;
		const positions = attributes['position'].array as Float32Array;
		return { vertexArray: repairMesh(positions, index?.array), dimensions };
	};

	const builders: Record<MeshKind, (step: Step) => Promise<MeshInfo>> = {
		main: async (step) => {
			let solid = await getBaseSolid(step);

			// Support legs with full component height
			for (const batch of legBatches) {
				solid = evaluator.evaluate(solid, batch, ADDITION);
				await step();
			}

			// Optionally engrave text label on front edge
			if (textInfo) {
				const text = MESH(textInfo.geometry);
				text.position.x -= textInfo.size.w * PANEL_CENTER_FACTOR;
				text.position.y -=
					adjustedPanelHeight * PANEL_CENTER_FACTOR +
					EDGE_THICKNESS -
					TEXT_THICKNESS * PANEL_CENTER_FACTOR;
				text.position.z +=
					(needHeight + BOTTOM_THICKNESS - emptyHeight - textInfo.size.h) * PANEL_CENTER_FACTOR;
				text.updateMatrixWorld();
				solid = evaluator.evaluate(solid, text, ADDITION);
				await step();
			}

			return toMeshInfo(solid, {
				width: outerWidth,
				height: outerHeight,
				depth: needHeight + BOTTOM_THICKNESS
			});
		},

		hollow: async (step) => {
			// The hollow holder is the upper slice of the shared solid (its floor ends where the cavity
			// of the main holder starts), so slice it off instead of rebuilding everything.
			const sliceHeight = needHeight - hollowHeight;
			const slab = MESH(BOX(outerWidth + 2, outerHeight + 2, sliceHeight + ROUND_CORRECTION));
			slab.position.z -= ROUND_CORRECTION;
			slab.updateMatrixWorld();

			let solid = evaluator.evaluate(await getBaseSolid(step), slab, SUBTRACTION);
			await step();

			for (const batch of hollowPunchBatches) {
				solid = evaluator.evaluate(solid, batch, SUBTRACTION);
				await step();
			}
			for (const batch of hollowLegBatches) {
				solid = evaluator.evaluate(solid, batch, ADDITION);
				await step();
			}

			return toMeshInfo(solid, {
				width: outerWidth,
				height: outerHeight,
				depth: hollowHeight + BOTTOM_THICKNESS
			});
		},

		positive: async (step) => {
			// Note: Uses original panel dimensions (not adjusted) for visualization purposes
			let solid = MESH(BOX(panel.width, panel.height, POSITIVE_BASE_THICKNESS));
			for (const batch of pillarBatches) {
				solid = evaluator.evaluate(solid, batch, ADDITION);
				await step();
			}

			return toMeshInfo(solid, {
				width: panel.width,
				height: panel.height,
				depth: POSITIVE_BASE_THICKNESS + componentHeight
			});
		}
	};

	const results: Partial<Record<MeshKind, Promise<MeshInfo>>> = {};

	const pendingOperations = (kind: MeshKind) => {
		const solid = isSolidBuilt ? 0 : solidOperations;
		if (kind === 'main') return solid + mainOperations;
		if (kind === 'hollow') return solid + hollowOperations;
		return positiveOperations;
	};

	return {
		hiddenLegsCount,
		totalOperations,
		generate: (kind, onProgress, isCancelled) => {
			results[kind] ??= builders[kind](
				createStep(pendingOperations(kind), onProgress, isCancelled)
			).catch((error) => {
				results[kind] = undefined; // allow retry after cancellation
				throw error;
			});
			return results[kind]!;
		}
	};
};

/**
 * Generates all three mesh variants of a project in one go (tests and main-thread fallback).
 *
 * @param project - The PCB project containing panel settings and component data
 * @param font - Font for the text label; only needed (and loaded) when the project has a label
 * @param onProgress - Optional callback to report progress (current, total operations)
 * @returns Object containing vertex arrays and dimensions for all three mesh types
 */
export const generateMesh = async (
	project: RenderableProject,
	font: Font | undefined,
	onProgress?: ProgressCallback
): Promise<MeshInfoTuple> => {
	const session = createMeshSession(project, font);

	let reported = 0;
	const stage = (kind: MeshKind) => {
		let last = 0;
		return session.generate(kind, (current) => {
			reported += current - last;
			last = current;
			onProgress?.(reported, session.totalOperations);
		});
	};

	const main = await stage('main');
	const hollow = await stage('hollow');
	const positive = await stage('positive');

	return { main, hollow, positive, hiddenLegsCount: session.hiddenLegsCount };
};

/**
 * Asynchronously generates 3D meshes for a PCB project on the calling thread.
 * Loads the required font and delegates to generateMesh().
 *
 * @param project - The PCB project to generate meshes for
 * @param onProgress - Optional callback to report progress (current, total operations)
 * @returns Promise resolving to mesh info for main, hollow, and positive meshes
 * @throws Error message string if mesh generation fails
 */
export const generateMeshLazy = async (
	project: RenderableProject,
	onProgress?: ProgressCallback
): Promise<MeshInfoTuple> => {
	try {
		const font = project.label ? await loadFont() : undefined;
		return await generateMesh(project, font, onProgress);
	} catch (error) {
		throw error instanceof Error ? error.message : error;
	}
};
