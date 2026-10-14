import { type BoardOutline, type BoundingBox, type Point, roundCoordinate } from './types';

const MM_PER_INCH = 25.4;
/** Arcs are flattened with at most this step, so bounding boxes of rounded corners are exact enough */
const ARC_STEP_RADIANS = (5 * Math.PI) / 180;

/** `TF.FileFunction,Profile` is the X2 marker of the board outline layer */
export const hasProfileAttribute = (text: string) =>
	/%tf\.filefunction,profile/i.test(text.slice(0, 4000));

/** Outline layers by their conventional names (KiCad `Edge.Cuts`, `.gko`, `.gm1`, EasyEDA/JLC outline) */
export const looksLikeOutlineName = (fileName: string) =>
	/(edge[ ._-]?cuts|\.gko$|\.gm1$|\.gml$|outline|profile)/i.test(fileName);

/**
 * Parses the contours of a Gerber (RS-274X) outline layer.
 *
 * Only the centre line of the strokes is used (the aperture width is ignored): linear and arc
 * interpolation (`G01/G02/G03`, `G74/G75`, `I/J`), `D01/D02` and the `FS`/`MO` header. Flashes,
 * apertures and polarity are irrelevant for an outline. Returns `undefined` when no geometry is found.
 */
export const parseOutline = (text: string): BoardOutline | undefined => {
	let inch = false;
	let integerDigits = 4;
	let decimalDigits = 6;
	let omitLeadingZeros = true;
	let mode: 'G01' | 'G02' | 'G03' = 'G01';

	const contours: Point[][] = [];
	let contour: Point[] = [];
	let current: Point = { x: 0, y: 0 };

	const scale = () => (inch ? MM_PER_INCH : 1);

	const parseCoordinate = (raw: string) => {
		const negative = raw.startsWith('-');
		let body = raw.replace(/^[+-]/, '');
		const total = integerDigits + decimalDigits;
		body = omitLeadingZeros ? body.padStart(total, '0') : body.padEnd(total, '0');
		const value = (Number(body) / 10 ** decimalDigits) * scale();
		return negative ? -value : value;
	};

	const startContour = (point: Point) => {
		if (contour.length > 1) contours.push(contour);
		contour = [point];
	};

	/** A flash is not part of a contour: ends the current path, the next draw starts at the flash point */
	const flushContour = () => {
		if (contour.length > 1) contours.push(contour);
		contour = [];
	};

	const lineTo = (point: Point) => {
		if (contour.length === 0) contour.push(current);
		contour.push(point);
	};

	const arcTo = (target: Point, centerOffset: Point) => {
		const center = { x: current.x + centerOffset.x, y: current.y + centerOffset.y };
		const startAngle = Math.atan2(current.y - center.y, current.x - center.x);
		const endAngle = Math.atan2(target.y - center.y, target.x - center.x);
		const radius = Math.hypot(current.x - center.x, current.y - center.y);
		if (radius === 0) return lineTo(target);

		const clockwise = mode === 'G02';
		let sweep = endAngle - startAngle;
		if (clockwise) {
			if (sweep >= 0) sweep -= 2 * Math.PI;
		} else if (sweep <= 0) sweep += 2 * Math.PI;
		// Identical start and end with G75 is a full circle: sweep above is already +-2 PI
		const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP_RADIANS));
		if (contour.length === 0) contour.push(current);
		for (let step = 1; step < steps; step++) {
			const angle = startAngle + (sweep * step) / steps;
			contour.push({
				x: center.x + radius * Math.cos(angle),
				y: center.y + radius * Math.sin(angle)
			});
		}
		contour.push(target);
	};

	const handleWord = (word: string) => {
		const command = word.trim();
		if (!command || /^G0?4/.test(command)) return;

		const gCodes = [...command.matchAll(/G(\d+)/g)].map((match) => Number(match[1]));
		for (const code of gCodes)
			switch (code) {
				case 1: {
					mode = 'G01';
					break;
				}
				case 2: {
					mode = 'G02';
					break;
				}
				case 3: {
					{
						mode = 'G03';
						// No default
					}
					break;
				}
			}

		const coordinates: Partial<Record<'X' | 'Y' | 'I' | 'J', number>> = {};
		for (const match of command.matchAll(/([IJXY])([+-]?\d+)/g))
			coordinates[match[1] as 'X' | 'Y' | 'I' | 'J'] = parseCoordinate(match[2]);

		const operation = /D0?([1-3])\s*$/.exec(command)?.[1];
		const hasMove = coordinates.X !== undefined || coordinates.Y !== undefined;
		if (!operation && !hasMove) return;

		const target = { x: coordinates.X ?? current.x, y: coordinates.Y ?? current.y };
		// Without an explicit D code the previous operation (draw) stays modal
		if (operation === '2') startContour(target);
		else if (operation === '3') flushContour();
		else if (mode === 'G01') lineTo(target);
		else arcTo(target, { x: coordinates.I ?? 0, y: coordinates.J ?? 0 });
		current = target;
	};

	for (const match of text.matchAll(/%([^%]*)%|([^%*]*)\*/g)) {
		const extended = match[1];
		if (extended === undefined) {
			handleWord(match[2]);
			continue;
		}
		for (const part of extended.split('*')) {
			const format = /^FS([LT])[AI]X(\d)(\d)Y(\d)(\d)$/.exec(part.trim());
			if (format) {
				omitLeadingZeros = format[1] === 'L';
				integerDigits = Number(format[2]);
				decimalDigits = Number(format[3]);
				continue;
			}
			if (/^MOIN$/.test(part.trim())) inch = true;
			else if (/^MOMM$/.test(part.trim())) inch = false;
		}
	}
	if (contour.length > 1) contours.push(contour);
	if (contours.length === 0) return undefined;

	const rounded = contours.map((points) =>
		points.map((point) => ({ x: roundCoordinate(point.x), y: roundCoordinate(point.y) }))
	);
	return { contours: rounded, bbox: boundingBox(rounded.flat()) };
};

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
