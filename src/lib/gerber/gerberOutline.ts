import { plotLayer } from './plotter';
import type { BoardOutline, BoundingBox, Point } from './types';
import { roundCoordinate } from './types';

/** `TF.FileFunction,Profile` is the X2 marker of the board outline layer */
export const hasProfileAttribute = (text: string) =>
	/%tf\.filefunction,profile/i.test(text.slice(0, 4000));

/** Outline layers by their conventional names (KiCad `Edge.Cuts`, `.gko`, `.gm1`, EasyEDA/JLC outline) */
export const looksLikeOutlineName = (fileName: string) =>
	/(edges?[ ._-]?cuts|(^|[^a-z])edges?([^a-z]|$)|\.gko$|\.gml$|\.mil$|\.dim$|\.oln$|\.fab$|outline|profile|dimension|board[ ._-]?edge)/i.test(
		fileName
	);

export const boundingBox = (points: readonly Point[]): BoundingBox => {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const { x, y } of points) {
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}
	return { minX, minY, maxX, maxY };
};

/**
 * Board outline of a Gerber profile layer: the centre lines of the draws and arcs and the contours of
 * regions (the aperture width is ignored, as the specification says). Uses the same plotter as the
 * layer pictures, so every supported syntax variant works here too. `undefined` without geometry.
 */
export const outlineFromRecords = (
	records: readonly { type: string; points?: Point[] }[]
): BoardOutline | undefined => {
	const contours = records
		.filter((record) => record.type !== 'flash' && (record.points?.length ?? 0) > 1)
		.map((record) =>
			(record.points ?? []).map((point) => ({
				x: roundCoordinate(point.x),
				y: roundCoordinate(point.y)
			}))
		);
	if (contours.length === 0) return undefined;
	return { contours, bbox: boundingBox(contours.flat()) };
};

export const parseOutline = (text: string): BoardOutline | undefined =>
	outlineFromRecords(plotLayer(text, 'o').records);
