import { nanoid } from 'nanoid';

import { CircleData } from '$types/CircleData';
import { RectangleData } from '$types/RectangleData';

import { boundingBox } from './gerberOutline';
import {
	type BoardOutline,
	type BoundingBox,
	type DrillHole,
	type DrillTool,
	type Point
} from './types';

export interface PlanOptions {
	/** Keys of the drill tools whose holes become elements */
	toolKeys: readonly string[];
	/** Holes of the same diameter closer than this (centre to centre, mm) form one part; 0 disables grouping */
	groupDistance: number;
	/** Wall kept between a hole and the pocket edge for single holes (mm) */
	minMargin: number;
	circleDepth: number;
	rectangleDepth: number;
}

export const DEFAULT_GROUP_DISTANCE = 2.6;
export const DEFAULT_MARGIN = 0.3;
/** Smallest drill that is considered a through-hole component lead by default (vias are 0.2 - 0.6 mm, Eagle's default is 0.61) */
export const MIN_THT_DIAMETER = 0.7;

/** Same limits as the project settings dialog */
const PANEL_MIN = 10;
const PANEL_MAX = 999;
const RADIUS_MIN = 0.5;
const RADIUS_MAX = 99;
const OUTSIDE_TOLERANCE = 0.5;
const FALLBACK_MARGIN = 2;
const DIAMETER_TOLERANCE = 0.05;

/** A hole in panel coordinates, for rendering */
export interface PlannedHole {
	x: number;
	y: number;
	diameter: number;
	selected: boolean;
	/** Slot end point in panel coordinates */
	slot?: Point;
}

export interface ElementPlan {
	circles: CircleData[];
	rectangles: RectangleData[];
	panel: { width: number; height: number };
	/** CAM coordinates of the panel's lower-left corner (subtract to get panel coordinates) */
	origin: Point;
	/** Board outline contours in panel coordinates */
	contours: Point[][];
	holes: PlannedHole[];
	warnings: string[];
}

/**
 * Tools that are likely through-hole component leads: what the CAD declares (`ComponentDrill`, component
 * pads) when it does, otherwise plated drills of lead size. Vias, mechanical and blind/buried holes
 * are off, so are drills too small to be a lead whatever they are called (some CADs tag vias as
 * component drills).
 */
export const defaultToolKeys = (tools: readonly DrillTool[]) =>
	tools
		.filter((tool) => {
			switch (tool.role) {
				case 'component': {
					return tool.plated && tool.diameter >= 0.4;
				}
				case 'pad': {
					return true;
				}
				case 'unknown': {
					return tool.plated && tool.diameter >= MIN_THT_DIAMETER;
				}
				default: {
					return false;
				}
			}
		})
		.map((tool) => tool.key);

/** Rounds up to 0.1 mm (the precision of the number fields), ignoring float noise */
const ceilTenth = (value: number) => Math.ceil(value * 10 - 1e-6) / 10;
const roundHundredth = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Single-linkage clusters of holes with the same diameter closer than `distance` */
const clusterHoles = (holes: readonly DrillHole[], distance: number) => {
	const parent = holes.map((_, index) => index);
	const find = (index: number): number => {
		while (parent[index] !== index) {
			parent[index] = parent[parent[index]];
			index = parent[index];
		}
		return index;
	};

	if (distance > 0)
		for (const [index, hole] of holes.entries())
			for (let other = index + 1; other < holes.length; other++) {
				const candidate = holes[other];
				if (Math.abs(candidate.diameter - hole.diameter) > DIAMETER_TOLERANCE) continue;
				if (Math.hypot(candidate.x - hole.x, candidate.y - hole.y) <= distance)
					parent[find(index)] = find(other);
			}

	const clusters = new Map<number, DrillHole[]>();
	for (const [index, hole] of holes.entries()) {
		const root = find(index);
		clusters.set(root, [...(clusters.get(root) ?? []), hole]);
	}
	return [...clusters.values()];
};

/** Smallest axis-aligned-in-its-own-frame box around the points, tried at 1 degree steps (0 wins ties) */
const orientedBox = (points: readonly Point[]) => {
	let best: { angle: number; minU: number; maxU: number; minV: number; maxV: number } | undefined;
	let bestArea = Infinity;
	for (let angle = 0; angle < 90; angle++) {
		const radians = (angle * Math.PI) / 180;
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);
		let minU = Infinity;
		let maxU = -Infinity;
		let minV = Infinity;
		let maxV = -Infinity;
		for (const { x, y } of points) {
			const u = x * cos + y * sin;
			const v = -x * sin + y * cos;
			if (u < minU) minU = u;
			if (u > maxU) maxU = u;
			if (v < minV) minV = v;
			if (v > maxV) maxV = v;
		}
		const area = (maxU - minU) * (maxV - minV);
		if (area < bestArea - 1e-6) {
			bestArea = area;
			best = { angle, minU, maxU, minV, maxV };
		}
	}
	return best!;
};

const minimumPitch = (points: readonly Point[]) => {
	let pitch = Infinity;
	for (const [index, point] of points.entries())
		for (let other = index + 1; other < points.length; other++)
			pitch = Math.min(pitch, Math.hypot(points[other].x - point.x, points[other].y - point.y));
	return pitch;
};

/**
 * Turns drill holes into holder elements.
 *
 * Coordinates are translated so that the lower-left corner of the board outline is the origin (no
 * flip: the designer stores y upwards like the CAM files). Holes of the selected tools are clustered:
 * a lone hole becomes a circle, several neighbouring holes one (rotated) rectangle that spans them,
 * padded by half the pitch so that a 2.54 mm header becomes n x 2.54 mm like its body.
 */
export const planElements = (
	holes: readonly DrillHole[],
	outline: BoardOutline | undefined,
	options: PlanOptions
): ElementPlan => {
	const warnings: string[] = [];
	const selectedKeys = new Set(options.toolKeys);
	const selected = holes.filter((hole) => selectedKeys.has(hole.toolKey));

	let bbox: BoundingBox;
	if (outline) bbox = outline.bbox;
	else {
		const source = boundingBox(
			(selected.length > 0 ? selected : holes).flatMap((hole) =>
				hole.slot ? [hole, hole.slot] : [hole]
			)
		);
		bbox = Number.isFinite(source.minX)
			? {
					minX: source.minX - FALLBACK_MARGIN,
					minY: source.minY - FALLBACK_MARGIN,
					maxX: source.maxX + FALLBACK_MARGIN,
					maxY: source.maxY + FALLBACK_MARGIN
				}
			: { minX: 0, minY: 0, maxX: PANEL_MIN, maxY: PANEL_MIN };
	}

	const rawWidth = bbox.maxX - bbox.minX;
	const rawHeight = bbox.maxY - bbox.minY;
	const panel = {
		width: clamp(ceilTenth(rawWidth), PANEL_MIN, PANEL_MAX),
		height: clamp(ceilTenth(rawHeight), PANEL_MIN, PANEL_MAX)
	};
	if (rawWidth < PANEL_MIN || rawHeight < PANEL_MIN)
		warnings.push(`Board is smaller than ${PANEL_MIN} mm: the panel was enlarged to the minimum`);
	if (rawWidth > PANEL_MAX || rawHeight > PANEL_MAX)
		warnings.push(`Board is larger than ${PANEL_MAX} mm: the panel was cut to the maximum`);

	const toPanel = (point: Point): Point => ({
		x: roundHundredth(point.x - bbox.minX),
		y: roundHundredth(point.y - bbox.minY)
	});

	const local = selected
		.filter((hole) => !hole.slot)
		.map((hole) => ({ ...hole, ...toPanel(hole) }));
	const slots = selected.filter((hole) => hole.slot);
	if (
		outline &&
		selected.some(
			(hole) =>
				hole.x < bbox.minX - OUTSIDE_TOLERANCE ||
				hole.x > bbox.maxX + OUTSIDE_TOLERANCE ||
				hole.y < bbox.minY - OUTSIDE_TOLERANCE ||
				hole.y > bbox.maxY + OUTSIDE_TOLERANCE
		)
	)
		warnings.push('Some holes are outside the board outline: the files may use different origins');

	const circles: CircleData[] = [];
	const rectangles: RectangleData[] = [];
	let outside = 0;

	for (const cluster of clusterHoles(local, options.groupDistance)) {
		if (cluster.length === 1) {
			const [hole] = cluster;
			const radius = clamp(
				ceilTenth(hole.diameter / 2 + options.minMargin),
				RADIUS_MIN,
				RADIUS_MAX
			);
			circles.push(
				CircleData.parse({
					id: nanoid(),
					x: hole.x,
					y: hole.y,
					radius,
					depth: options.circleDepth
				})
			);
			if (
				hole.x - radius < 0 ||
				hole.y - radius < 0 ||
				hole.x + radius > panel.width ||
				hole.y + radius > panel.height
			)
				outside++;
			continue;
		}

		const box = orientedBox(cluster);
		const radians = (box.angle * Math.PI) / 180;
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);
		const centerU = (box.minU + box.maxU) / 2;
		const centerV = (box.minV + box.maxV) / 2;
		const diameter = Math.max(...cluster.map((hole) => hole.diameter));
		const padding = Math.max(minimumPitch(cluster) / 2, diameter / 2 + options.minMargin);
		const width = ceilTenth(box.maxU - box.minU + 2 * padding);
		const height = ceilTenth(box.maxV - box.minV + 2 * padding);
		const x = roundHundredth(centerU * cos - centerV * sin);
		const y = roundHundredth(centerU * sin + centerV * cos);
		rectangles.push(
			RectangleData.parse({
				id: nanoid(),
				x,
				y,
				width,
				height,
				depth: options.rectangleDepth,
				rotation: box.angle
			})
		);
		const half = {
			x: (Math.abs(cos) * width + Math.abs(sin) * height) / 2,
			y: (Math.abs(sin) * width + Math.abs(cos) * height) / 2
		};
		if (x - half.x < 0 || y - half.y < 0 || x + half.x > panel.width || y + half.y > panel.height)
			outside++;
	}
	for (const hole of slots) {
		// A slot becomes a rectangle along it: stroke length plus the end caps, with the same wall as a circle
		const start = toPanel(hole);
		const end = toPanel(hole.slot!);
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const length = Math.hypot(dx, dy);
		const height = ceilTenth(hole.diameter + 2 * options.minMargin);
		const width = ceilTenth(length + hole.diameter + 2 * options.minMargin);
		let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
		angle = ((angle % 180) + 180) % 180;
		const rotation = Math.round(angle * 10) / 10 === 180 ? 0 : Math.round(angle * 10) / 10;
		const x = roundHundredth((start.x + end.x) / 2);
		const y = roundHundredth((start.y + end.y) / 2);
		rectangles.push(
			RectangleData.parse({
				id: nanoid(),
				x,
				y,
				width,
				height: Math.max(height, RADIUS_MIN * 2),
				depth: options.rectangleDepth,
				rotation
			})
		);
		const radians = (rotation * Math.PI) / 180;
		const halfX = (Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height) / 2;
		const halfY = (Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height) / 2;
		if (x - halfX < 0 || y - halfY < 0 || x + halfX > panel.width || y + halfY > panel.height)
			outside++;
	}
	if (outside > 0)
		warnings.push(`${outside} shape(s) reach beyond the board edge, check them in the designer`);

	return {
		circles,
		rectangles,
		panel,
		origin: { x: bbox.minX, y: bbox.minY },
		contours: (outline?.contours ?? []).map((contour) => contour.map((point) => toPanel(point))),
		holes: holes.map((hole) => ({
			...toPanel(hole),
			diameter: hole.diameter,
			selected: selectedKeys.has(hole.toolKey),
			...(hole.slot && { slot: toPanel(hole.slot) })
		})),
		warnings
	};
};
