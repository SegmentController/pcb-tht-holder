import { rotatedHalfExtents } from '$lib/util/geometry';
import { LEG_SIZE } from '$types/LegData';

import type { ElementPlan } from './plan';
import type { DrillHole, PlotRecord } from './types';

/** Axis-aligned area that a support leg must keep away from, in the coordinates of its caller */
export interface Keepout {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface LegPlacementOptions {
	/** Number of legs wanted (fewer when the board has no room) */
	count?: number;
	/** Leg size in mm (squares) */
	size?: number;
	/** Distance kept to the panel edge */
	edgeMargin?: number;
	/** Grid resolution of the search in mm */
	resolution?: number;
}

const RESOLUTION = 0.5;

/**
 * Obstacles from plotted records: flashes (pads), and the strokes of draws and regions (silkscreen
 * outlines of the parts). `skip` drops records such as copper traces or through-hole pads.
 */
export const keepoutsFromRecords = (
	records: readonly PlotRecord[],
	skip: (record: PlotRecord) => boolean = () => false
): Keepout[] => {
	const result: Keepout[] = [];
	for (const record of records) {
		if (skip(record)) continue;
		if (record.type === 'flash') {
			result.push({
				minX: record.x - record.width / 2,
				maxX: record.x + record.width / 2,
				minY: record.y - record.height / 2,
				maxY: record.y + record.height / 2
			});
			continue;
		}
		const half = (record.type === 'draw' ? record.width : 0) / 2;
		// A stroke is sampled so that diagonals do not claim their whole bounding box
		for (const [index, point] of record.points.entries()) {
			const next = record.points[index + 1] ?? point;
			const steps = Math.max(
				1,
				Math.ceil(Math.hypot(next.x - point.x, next.y - point.y) / RESOLUTION)
			);
			for (let step = 0; step <= steps; step++) {
				const x = point.x + ((next.x - point.x) * step) / steps;
				const y = point.y + ((next.y - point.y) * step) / steps;
				result.push({ minX: x - half, maxX: x + half, minY: y - half, maxY: y + half });
			}
		}
	}
	return result;
};

/**
 * Picks positions for support legs: clear of parts, holes and elements, and far apart from each
 * other so that the PCB rests stably.
 *
 * The board is rasterised, every cell gets its distance to the nearest keepout (chamfer distance
 * transform) and legs are picked greedily by clearance (up to 3 mm) plus distance to the legs
 * placed so far.
 *
 * @returns top-left corners of the legs (the convention of `LegData`), at most `count`
 */
export const placeLegs = (
	panel: { width: number; height: number },
	keepouts: readonly Keepout[],
	options: LegPlacementOptions = {}
) => {
	const { count = 4, size = LEG_SIZE, edgeMargin = 0.5, resolution = RESOLUTION } = options;
	const columns = Math.ceil(panel.width / resolution);
	const rows = Math.ceil(panel.height / resolution);
	if (columns < 1 || rows < 1) return [];

	// Occupancy: every cell the keepout touches (thin silkscreen lines must not slip between cell centres)
	const infinity = 1e9;
	const distance = new Float32Array(columns * rows).fill(infinity);
	for (const box of keepouts) {
		const fromColumn = Math.max(0, Math.floor(box.minX / resolution));
		const toColumn = Math.min(columns - 1, Math.floor(box.maxX / resolution));
		const fromRow = Math.max(0, Math.floor(box.minY / resolution));
		const toRow = Math.min(rows - 1, Math.floor(box.maxY / resolution));
		for (let row = fromRow; row <= toRow; row++)
			for (let column = fromColumn; column <= toColumn; column++)
				distance[row * columns + column] = 0;
	}

	// Two-pass chamfer distance in cells (1 and sqrt 2 steps)
	const diagonal = Math.SQRT2;
	const at = (column: number, row: number) => row * columns + column;
	for (let row = 0; row < rows; row++)
		for (let column = 0; column < columns; column++) {
			let best = distance[at(column, row)];
			if (column > 0) best = Math.min(best, distance[at(column - 1, row)] + 1);
			if (row > 0) {
				best = Math.min(best, distance[at(column, row - 1)] + 1);
				if (column > 0) best = Math.min(best, distance[at(column - 1, row - 1)] + diagonal);
				if (column < columns - 1)
					best = Math.min(best, distance[at(column + 1, row - 1)] + diagonal);
			}
			distance[at(column, row)] = best;
		}
	for (let row = rows - 1; row >= 0; row--)
		for (let column = columns - 1; column >= 0; column--) {
			let best = distance[at(column, row)];
			if (column < columns - 1) best = Math.min(best, distance[at(column + 1, row)] + 1);
			if (row < rows - 1) {
				best = Math.min(best, distance[at(column, row + 1)] + 1);
				if (column < columns - 1)
					best = Math.min(best, distance[at(column + 1, row + 1)] + diagonal);
				if (column > 0) best = Math.min(best, distance[at(column - 1, row + 1)] + diagonal);
			}
			distance[at(column, row)] = best;
		}

	// Candidates: leg fully inside the panel (with margin). The clearance of a square leg is the
	// smallest distance-to-keepout over the cells it covers, minus one cell (adjacent cells touch)
	const half = size / 2;
	const candidates: { x: number; y: number; clearance: number }[] = [];
	const last = (value: number) => Math.floor((value - 1e-9) / resolution);
	for (let row = 0; row < rows; row++)
		for (let column = 0; column < columns; column++) {
			const x = (column + 0.5) * resolution;
			const y = (row + 0.5) * resolution;
			if (
				x - half < edgeMargin ||
				y - half < edgeMargin ||
				x + half > panel.width - edgeMargin ||
				y + half > panel.height - edgeMargin
			)
				continue;
			let nearest = Infinity;
			for (let cellRow = Math.floor((y - half) / resolution); cellRow <= last(y + half); cellRow++)
				for (
					let cellColumn = Math.floor((x - half) / resolution);
					cellColumn <= last(x + half);
					cellColumn++
				)
					nearest = Math.min(
						nearest,
						distance[
							at(
								Math.min(columns - 1, Math.max(0, cellColumn)),
								Math.min(rows - 1, Math.max(0, cellRow))
							)
						]
					);
			const clearance = (nearest - 1) * resolution;
			if (clearance > 0) candidates.push({ x, y, clearance });
		}
	if (candidates.length === 0) return [];

	// Greedy: every leg trades clearance (worth up to 3 mm) against distance to the legs already
	// placed (0.35 per mm, up to 12 mm), so legs spread out without ever standing next to parts
	const centre = {
		x: candidates.reduce((sum, candidate) => sum + candidate.x, 0) / candidates.length,
		y: candidates.reduce((sum, candidate) => sum + candidate.y, 0) / candidates.length
	};
	const chosen: typeof candidates = [];
	while (chosen.length < count) {
		let next: (typeof candidates)[number] | undefined;
		let nextScore = -Infinity;
		for (const candidate of candidates) {
			let score = Math.min(candidate.clearance, 3);
			if (chosen.length === 0)
				// remote from the middle of the free area: a corner-like spot for the first leg
				score += 0.02 * Math.hypot(candidate.x - centre.x, candidate.y - centre.y);
			else {
				const nearest = Math.min(
					...chosen.map((leg) => Math.hypot(candidate.x - leg.x, candidate.y - leg.y))
				);
				// Legs closer than twice their size are one big leg: not worth a new one
				if (nearest < size * 2) continue;
				score += 0.35 * Math.min(nearest, 12);
			}
			if (score > nextScore) {
				next = candidate;
				nextScore = score;
			}
		}
		if (!next) break;
		chosen.push(next);
	}

	return chosen.map((leg) => ({
		x: Math.round((leg.x - half) * 10) / 10,
		y: Math.round((leg.y - half) * 10) / 10
	}));
};

/**
 * Legs for an import plan: keeps away from the planned elements, every drilled hole (vias and
 * mounting holes too) and the part keepouts of the package (SMD pads, silkscreen), which are in CAM
 * coordinates like the holes.
 */
export const suggestLegs = (
	plan: ElementPlan,
	holes: readonly DrillHole[],
	partKeepouts: readonly Keepout[],
	options: LegPlacementOptions = {}
) => {
	const { x: originX, y: originY } = plan.origin;
	const shifted = (box: Keepout): Keepout => ({
		minX: box.minX - originX,
		maxX: box.maxX - originX,
		minY: box.minY - originY,
		maxY: box.maxY - originY
	});

	const keepouts: Keepout[] = partKeepouts.map((box) => shifted(box));
	for (const hole of holes) {
		const reach = hole.diameter / 2;
		const points = hole.slot ? [hole, hole.slot] : [hole];
		for (const point of points)
			keepouts.push(
				shifted({
					minX: point.x - reach,
					maxX: point.x + reach,
					minY: point.y - reach,
					maxY: point.y + reach
				})
			);
	}
	for (const circle of plan.circles)
		keepouts.push({
			minX: circle.x - circle.radius,
			maxX: circle.x + circle.radius,
			minY: circle.y - circle.radius,
			maxY: circle.y + circle.radius
		});
	for (const rectangle of plan.rectangles) {
		const extents = rotatedHalfExtents(rectangle.width, rectangle.height, rectangle.rotation);
		keepouts.push({
			minX: rectangle.x - extents.x,
			maxX: rectangle.x + extents.x,
			minY: rectangle.y - extents.y,
			maxY: rectangle.y + extents.y
		});
	}
	return placeLegs(plan.panel, keepouts, options);
};
