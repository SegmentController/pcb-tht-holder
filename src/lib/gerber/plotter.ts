import { circlePath, compileMacro, polygonSvg, regularPolygonPoints } from './macro';
import type { BoundingBox, PlotRecord, PlotResult, Point } from './types';

const MM_PER_INCH = 25.4;
const MAX_RECORDS = 400_000;
const ARC_STEP = (5 * Math.PI) / 180;
const DARK = '\u0001D';
const CLEAR = '\u0001C';

/** Micrometre precision is plenty for a picture and keeps dense boards small */
const number = (value: number) => String(Math.round(value * 1e3) / 1e3);

type Kind = 'C' | 'R' | 'O' | 'P' | 'macro' | 'block';

interface Aperture {
	id: string;
	kind: Kind;
	/** Stroke width for round apertures, minimum side for rectangles, 0 otherwise */
	width: number;
	/** Size of standard apertures (circle: diameter twice) */
	w: number;
	h: number;
	function?: string;
	/** Block aperture only: markup (with colour tokens) and the objects' data */
	markup?: string;
	records?: PlotRecord[];
	toggled?: boolean;
}

interface Sink {
	svg: string[];
	records: PlotRecord[];
	/** Consecutive objects of one kind and polarity, written as one element */
	batch?: { key: string; parts: string[]; wrap: (parts: string[]) => string };
}

interface Matrix {
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
}

const applyMatrix = (m: Matrix, x: number, y: number): Point => ({
	x: m.a * x + m.c * y + m.e,
	y: m.b * x + m.d * y + m.f
});

const transformRecord = (record: PlotRecord, m: Matrix): PlotRecord => {
	const scale = Math.hypot(m.a, m.b);
	if (record.type === 'flash') {
		const { x, y } = applyMatrix(m, record.x, record.y);
		return { ...record, x, y, width: record.width * scale, height: record.height * scale };
	}
	const points = record.points.map((point) => applyMatrix(m, point.x, point.y));
	return record.type === 'draw'
		? { ...record, points, width: record.width * scale }
		: { ...record, points };
};

/** Points along an arc after its start, at most 5 degrees apart; `sweep` is signed (counterclockwise positive) */
const arcPoints = (center: Point, radius: number, start: number, sweep: number) => {
	const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ARC_STEP));
	return Array.from({ length: steps }, (_, index) => {
		const angle = start + (sweep * (index + 1)) / steps;
		return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
	});
};

/** Convex hull (monotone chain) */
const convexHull = (points: readonly Point[]) => {
	const sorted = points.toSorted((p, q) => p.x - q.x || p.y - q.y);
	const cross = (o: Point, p: Point, q: Point) =>
		(p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
	const build = (input: readonly Point[]) => {
		const hull: Point[] = [];
		for (const point of input) {
			while (hull.length >= 2 && cross(hull.at(-2)!, hull.at(-1)!, point) <= 0) hull.pop();
			hull.push(point);
		}
		hull.pop();
		return hull;
	};
	return [...build(sorted), ...build(sorted.toReversed())];
};

const obroundPath = (w: number, h: number) => {
	const radius = Math.min(w, h) / 2;
	const dx = w / 2 - radius;
	const dy = h / 2 - radius;
	const arc = (x: number, y: number) =>
		`A${number(radius)} ${number(radius)} 0 0 1 ${number(x)} ${number(y)}`;
	return `M${number(-dx)} ${number(-h / 2)}H${number(dx)}${arc(w / 2, -dy)}V${number(dy)}${arc(dx, h / 2)}H${number(-dx)}${arc(-w / 2, dy)}V${number(-dy)}${arc(-dx, -h / 2)}Z`;
};

/** Pieces with exposure on/off are stacked in a mask so that exposure-off holes stay transparent */
const apertureMarkup = (
	id: string,
	shapes: readonly { exposure: boolean; svg: string }[],
	extent: number,
	defs: string[]
) => {
	if (shapes.every((shape) => shape.exposure)) return shapes.map((shape) => shape.svg).join('');
	const box = Math.ceil(extent * 100) / 100 + 0.01;
	const bounds = `x="${number(-box)}" y="${number(-box)}" width="${number(2 * box)}" height="${number(2 * box)}"`;
	defs.push(
		`<mask id="${id}k" maskUnits="userSpaceOnUse" ${bounds}>${shapes
			.map((shape) => `<g fill="${shape.exposure ? '#fff' : '#000'}">${shape.svg}</g>`)
			.join('')}</mask>`
	);
	return `<rect ${bounds} mask="url(#${id}k)"/>`;
};

const toggledMarkup = (markup: string) =>
	markup.replaceAll(DARK, '\u0002').replaceAll(CLEAR, DARK).replaceAll('\u0002', CLEAR);

/** Hole of a standard aperture: transparent, it only removes area from the aperture */
const holePath = (round: boolean, values: readonly number[]) => {
	const [holeW, holeH = holeW] = values;
	if (!(holeW > 0)) return '';
	return round || values.length < 2
		? circlePath(0, 0, holeW / 2)
		: `M${number(-holeW / 2)} ${number(-holeH / 2)}h${number(holeW)}v${number(holeH)}h${number(-holeW)}Z`;
};

export interface PlotOptions {
	/**
	 * Which records are kept in the result (default: all). The extent of every record is tracked
	 * either way, so a caller that only needs a few kinds does not hold millions of the others.
	 */
	keep?: (record: PlotRecord) => boolean;
	/** `false` leaves `defs` and `objects` empty: for layers that are only read for their records */
	svg?: boolean;
}

/** Keeps no record at all (the layer is only drawn) */
export const KEEP_NONE = () => false;

/** Grows `extent` by the geometry of a record (a flash by its aperture size) */
const growExtent = (extent: BoundingBox, record: PlotRecord) => {
	if (record.type === 'flash') {
		extent.minX = Math.min(extent.minX, record.x - record.width / 2);
		extent.maxX = Math.max(extent.maxX, record.x + record.width / 2);
		extent.minY = Math.min(extent.minY, record.y - record.height / 2);
		extent.maxY = Math.max(extent.maxY, record.y + record.height / 2);
		return;
	}
	for (const { x, y } of record.points) {
		if (x < extent.minX) extent.minX = x;
		if (x > extent.maxX) extent.maxX = x;
		if (y < extent.minY) extent.minY = y;
		if (y > extent.maxY) extent.maxY = y;
	}
};

/**
 * Plots a Gerber (RS-274X / X2) file to SVG markup and semantic records.
 *
 * Implements Ucamco's Gerber Layer Format Specification (rev. 2026.05): `FS`/`MO`, standard apertures
 * with holes, aperture macros (primitives 0, 1, 4, 5, 7, 20, 21 and the deprecated 2, 6, 22) with
 * exposure, plot modes `G01/G02/G03/G75`, regions, dark/clear polarity, `LM/LR/LS` aperture
 * transformations, block apertures (`AB`), step and repeat (`SR`) and attributes (`TF/TA/TD`).
 * Legacy constructs seen in older files are accepted too: `G74`, `G54/G55`, `G70/G71`, `G90/G91`,
 * trailing zero omission, incremental coordinates, modal coordinate data, `M00`, and the deprecated
 * `IP/MI/OF/SF/IR/AS` commands. Never throws: unreadable parts are skipped and reported as warnings.
 *
 * @param text - Gerber file content
 * @param prefix - Id prefix of the generated definitions, unique per layer in one SVG document
 * @param options - What to keep of the result, see {@link PlotOptions}
 */
export const plotLayer = (text: string, prefix: string, options: PlotOptions = {}): PlotResult => {
	const { keep, svg: withSvg = true } = options;
	const warnings = new Set<string>();
	const macros = new Map<string, string[]>();
	const apertures = new Map<number, Aperture>();
	const defs: string[] = [];
	const attributes: Record<string, string[]> = {};
	const apertureAttributes = new Map<string, string>();

	const top: Sink = { svg: [], records: [] };
	const sinks: Sink[] = [top];
	const extent: BoundingBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
	const blocks: { code: number }[] = [];
	let repeat: { x: number; y: number; i: number; j: number } | undefined;
	let repeatCount = 0;

	let scale = 1;
	let integerDigits = 4;
	let decimalDigits = 6;
	let omitLeading = true;
	let incremental = false;
	let clear = false;
	let mirrorX = false;
	let mirrorY = false;
	let rotation = 0;
	let scaling = 1;
	let mode = 1;
	let singleQuadrant = false;
	let operation = 1;
	let region = false;
	let complement = false;
	let current: Point = { x: 0, y: 0 };
	let aperture: Aperture | undefined;
	let stopped = false;
	let capped = false;
	let recordCount = 0;

	// Deprecated image transformations: coordinate data only, applied as MI, SF, OF, IR, AS
	const legacy = {
		mirrorA: false,
		mirrorB: false,
		scaleA: 1,
		scaleB: 1,
		offsetA: 0,
		offsetB: 0,
		turns: 0,
		swap: false
	};
	const legacyActive = () =>
		legacy.mirrorA ||
		legacy.mirrorB ||
		legacy.scaleA !== 1 ||
		legacy.scaleB !== 1 ||
		legacy.offsetA !== 0 ||
		legacy.offsetB !== 0 ||
		legacy.turns !== 0 ||
		legacy.swap;
	const legacyMap = (x: number, y: number, withOffset: boolean): Point => {
		let px = (legacy.mirrorA ? -x : x) * legacy.scaleA + (withOffset ? legacy.offsetA : 0);
		let py = (legacy.mirrorB ? -y : y) * legacy.scaleB + (withOffset ? legacy.offsetB : 0);
		for (let turn = 0; turn < legacy.turns; turn++) [px, py] = [-py, px];
		return legacy.swap ? { x: py, y: px } : { x: px, y: py };
	};

	// Current object path (draws) and region contours
	let path = '';
	let pathPoints: Point[] = [];
	let pathAperture: Aperture | undefined;
	let contour = '';
	let contourPoints: Point[] = [];
	let contours: { d: string; points: Point[] }[] = [];

	const sink = () => sinks.at(-1)!;
	const token = () => (clear ? CLEAR : DARK);
	const flushBatch = (target: Sink) => {
		if (target.batch) target.svg.push(target.batch.wrap(target.batch.parts));
		target.batch = undefined;
	};
	/**
	 * Files records into a sink. Only the top level (what ends up on the board) is filtered and
	 * measured; blocks and step-and-repeat groups keep everything until they are placed.
	 */
	const store = (target: Sink, records: PlotRecord[]) => {
		if (target !== top) {
			for (const record of records) target.records.push(record);
			return;
		}
		for (const record of records) {
			growExtent(extent, record);
			if (!keep || keep(record)) top.records.push(record);
		}
	};
	const count = (target: Sink, records: PlotRecord[]) => {
		recordCount += Math.max(1, records.length);
		if (!clear) store(target, records);
		if (recordCount > MAX_RECORDS) {
			warnings.add('Too many objects: the rest of the file was skipped');
			capped = true;
			stopped = true;
		}
	};
	const emit = (svg: string, records: PlotRecord[]) => {
		const target = sink();
		if (withSvg) {
			flushBatch(target);
			target.svg.push(svg);
		}
		count(target, records);
	};
	/** Strokes and flashes of equal polarity (and width) share one element: far less markup per object */
	const emitBatched = (
		key: string,
		part: string,
		wrap: (parts: string[]) => string,
		records: PlotRecord[]
	) => {
		const target = sink();
		if (withSvg) {
			if (target.batch?.key !== key) {
				flushBatch(target);
				target.batch = { key, parts: [], wrap };
			}
			target.batch!.parts.push(part);
		}
		count(target, records);
	};

	const transformed = () => mirrorX || mirrorY || rotation !== 0 || scaling !== 1;
	const placement = (x: number, y: number) =>
		transformed()
			? `transform="translate(${number(x)} ${number(y)})${rotation ? ` rotate(${number(rotation)})` : ''} scale(${number((mirrorX ? -1 : 1) * scaling)} ${number((mirrorY ? -1 : 1) * scaling)})"`
			: `x="${number(x)}" y="${number(y)}"`;
	const matrixAt = (x: number, y: number): Matrix => {
		const radians = (rotation * Math.PI) / 180;
		const cos = Math.cos(radians);
		const sin = Math.sin(radians);
		const sx = (mirrorX ? -1 : 1) * scaling;
		const sy = (mirrorY ? -1 : 1) * scaling;
		return { a: cos * sx, b: sin * sx, c: -sin * sy, d: cos * sy, e: x, f: y };
	};

	const flushPath = () => {
		if (path && pathPoints.length > 0) {
			if (!pathAperture) {
				// Geometry still counts (outlines): drawn as a hairline
				warnings.add('Draw without a selected aperture');
				pathAperture = { id: '', kind: 'C', width: 0, w: 0, h: 0 };
			}
			const width = pathAperture.width * scaling;
			const draw: PlotRecord = {
				type: 'draw',
				points: pathPoints,
				width,
				function: pathAperture.function
			};
			if (pathAperture.kind === 'R') {
				// Deprecated: a rectangular aperture is dragged along the segments without rotating
				const halfW = (pathAperture.w * scaling) / 2;
				const halfH = (pathAperture.h * scaling) / 2;
				const pieces = pathPoints.map((point, index) => {
					const next = pathPoints[index + 1] ?? point;
					return polygonSvg(
						convexHull(
							[point, next].flatMap(({ x, y }) => [
								{ x: x - halfW, y: y - halfH },
								{ x: x + halfW, y: y - halfH },
								{ x: x + halfW, y: y + halfH },
								{ x: x - halfW, y: y + halfH }
							])
						).map((corner) => [corner.x, corner.y] as const)
					);
				});
				emit(`<g fill="${token()}">${pieces.join('')}</g>`, [draw]);
			} else if (pathAperture.kind === 'C' || pathAperture.kind === 'O') {
				const color = token();
				emitBatched(
					`s${color}${number(width)}`,
					path,
					(parts) =>
						`<path d="${parts.join('')}" fill="none" stroke="${color}" stroke-width="${number(width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
					[draw]
				);
			} else warnings.add('Draws with polygon, macro and block apertures are skipped');
		}
		path = '';
		pathPoints = [];
	};
	const flushContour = () => {
		if (contour && contourPoints.length > 1) contours.push({ d: contour, points: contourPoints });
		contour = '';
		contourPoints = [];
	};
	const endRegion = () => {
		flushContour();
		for (const item of contours)
			emit(`<path d="${item.d}Z" fill="${token()}"/>`, [{ type: 'region', points: item.points }]);
		contours = [];
		region = false;
	};

	const coordinate = (raw: string) => {
		if (raw.includes('.')) return Number.parseFloat(raw) * scale;
		const negative = raw.startsWith('-');
		let body = raw.replace(/^[+-]/, '');
		const total = integerDigits + decimalDigits;
		body = omitLeading ? body.padStart(total, '0') : body.padEnd(total, '0');
		const value = (Number(body) / 10 ** decimalDigits) * scale;
		return negative ? -value : value;
	};

	/** Appends a segment, starting the path/contour at the current point when needed */
	const append = (segment: string, points: Point[]) => {
		const start = `M${number(current.x)} ${number(current.y)}`;
		if (region) {
			if (!contour) {
				contour = start;
				contourPoints = [current];
			}
			contour += segment;
			contourPoints.push(...points);
		} else {
			if (!path) {
				path = start;
				pathPoints = [current];
				pathAperture = aperture;
			}
			path += segment;
			pathPoints.push(...points);
		}
	};

	const arc = (target: Point, index: number, index_: number) => {
		const counterClockwise = mode === 3;
		const sweepFor = (center: Point) => {
			const start = Math.atan2(current.y - center.y, current.x - center.x);
			const end = Math.atan2(target.y - center.y, target.x - center.x);
			let sweep = end - start;
			if (counterClockwise) {
				if (sweep <= 0) sweep += 2 * Math.PI;
			} else if (sweep >= 0) sweep -= 2 * Math.PI;
			return { start, sweep };
		};
		const line = () => append(`L${number(target.x)} ${number(target.y)}`, [target]);

		let center = { x: current.x + index, y: current.y + index_ };
		if (singleQuadrant) {
			// Offsets are unsigned: take the candidate centre with a quarter arc and least deviation
			if (current.x === target.x && current.y === target.y) return line();
			let best: { center: Point; deviation: number } | undefined;
			for (const sx of [1, -1])
				for (const sy of [1, -1]) {
					const candidate = {
						x: current.x + sx * Math.abs(index),
						y: current.y + sy * Math.abs(index_)
					};
					const deviation = Math.abs(
						Math.hypot(current.x - candidate.x, current.y - candidate.y) -
							Math.hypot(target.x - candidate.x, target.y - candidate.y)
					);
					if (
						Math.abs(sweepFor(candidate).sweep) <= Math.PI / 2 + 1e-6 &&
						(!best || deviation < best.deviation)
					)
						best = { center: candidate, deviation };
				}
			if (!best) return line();
			center = best.center;
		}

		const radius = Math.hypot(current.x - center.x, current.y - center.y);
		if (radius === 0) return line();

		const { start, sweep: measured } = sweepFor(center);
		const full = !singleQuadrant && current.x === target.x && current.y === target.y;
		const sweep = full ? (counterClockwise ? 2 * Math.PI : -2 * Math.PI) : measured;
		const flag = counterClockwise ? 1 : 0;
		const arcTo = (point: Point, large: number) =>
			`A${number(radius)} ${number(radius)} 0 ${large} ${flag} ${number(point.x)} ${number(point.y)}`;
		const points = arcPoints(center, radius, start, sweep);
		points[points.length - 1] = target;
		if (full) {
			const opposite = { x: 2 * center.x - current.x, y: 2 * center.y - current.y };
			append(arcTo(opposite, 0) + arcTo(target, 0), points);
		} else append(arcTo(target, Math.abs(sweep) > Math.PI ? 1 : 0), points);
	};

	const defineAperture = (code: number, name: string, rawParameters: string) => {
		const values = rawParameters
			.split(/[Xx]/)
			.map(Number)
			.filter((value) => Number.isFinite(value));
		const id = `${prefix}${code}`;
		const scaled = values.map((value) => value * scale);
		let kind: Kind = 'macro';
		let markup: string;
		let width = 0;
		let w: number;
		let h: number;

		switch (name) {
			case 'C': {
				kind = 'C';
				w = h = scaled[0] ?? 0;
				width = w;
				const hole = holePath(true, scaled.slice(1));
				markup = hole
					? `<path fill-rule="evenodd" d="${circlePath(0, 0, w / 2)}${hole}"/>`
					: `<circle r="${number(w / 2)}"/>`;

				break;
			}
			case 'R':
			case 'O': {
				kind = name;
				w = scaled[0] ?? 0;
				h = scaled[1] ?? w;
				width = Math.min(w, h);
				const hole = holePath(false, scaled.slice(2));
				const outline =
					name === 'O'
						? obroundPath(w, h)
						: `M${number(-w / 2)} ${number(-h / 2)}h${number(w)}v${number(h)}h${number(-w)}Z`;
				markup = `<path fill-rule="evenodd" d="${outline}${hole}"/>`;

				break;
			}
			case 'P': {
				kind = 'P';
				w = h = scaled[0] ?? 0;
				width = w;
				const points = regularPolygonPoints(values[1] ?? 3, w, values[2] ?? 0);
				const hole = holePath(false, scaled.slice(3));
				markup = `<path fill-rule="evenodd" d="M${points.map(([x, y]) => `${number(x)} ${number(y)}`).join('L')}Z${hole}"/>`;

				break;
			}
			default: {
				const lines = macros.get(name);
				if (!lines) {
					warnings.add(`Unknown aperture macro ${name}`);
					return;
				}
				const compiled = compileMacro(lines, values, warnings);
				const body = apertureMarkup(id, compiled.shapes, compiled.extent, defs);
				markup = scale === 1 ? body : `<g transform="scale(${scale})">${body}</g>`;
				w = h = compiled.extent * 2 * scale;
			}
		}
		defs.push(`<g id="${id}">${markup}</g>`);
		apertures.set(code, {
			id,
			kind,
			width,
			w,
			h,
			function: apertureAttributes.get('.AperFunction')
		});
	};

	const closeBlock = () => {
		const block = blocks.pop();
		flushBatch(sink());
		const closed = sinks.length > 1 ? sinks.pop() : undefined;
		if (!block || !closed) return;
		const id = `${prefix}b${block.code}`;
		const markup = closed.svg.join('');
		defs.push(`<g id="${id}">${markup}</g>`);
		apertures.set(block.code, {
			id,
			kind: 'block',
			width: 0,
			w: 0,
			h: 0,
			markup,
			records: closed.records
		});
	};

	const closeRepeat = () => {
		if (!repeat) return;
		const parameters = repeat;
		repeat = undefined;
		flushBatch(sink());
		const closed = sinks.length > 1 ? sinks.pop() : undefined;
		if (!closed) return;
		const id = `${prefix}s${repeatCount++}`;
		defs.push(`<g id="${id}">${closed.svg.join('')}</g>`);
		// Copied first in Y, then in X (the order matters when clear objects overlap)
		for (let x = 0; x < parameters.x && !capped; x++)
			for (let y = 0; y < parameters.y && !capped; y++) {
				const dx = x * parameters.i;
				const dy = y * parameters.j;
				if (withSvg) sink().svg.push(`<use href="#${id}" x="${number(dx)}" y="${number(dy)}"/>`);
				const matrix = { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy };
				store(
					sink(),
					closed.records.map((record) => transformRecord(record, matrix))
				);
				recordCount += Math.max(1, closed.records.length);
				if (recordCount > MAX_RECORDS) {
					warnings.add('Too many objects: the rest of the file was skipped');
					capped = true;
					stopped = true;
				}
			}
	};

	const flash = (target: Point) => {
		if (!aperture) {
			warnings.add('Flash without a selected aperture');
			return;
		}
		if (aperture.kind === 'block') {
			let useId = aperture.id;
			if (clear) {
				// A block flashed in clear polarity toggles the polarity of all its objects
				useId = `${aperture.id}t`;
				if (!aperture.toggled) {
					aperture.toggled = true;
					defs.push(`<g id="${useId}">${toggledMarkup(aperture.markup ?? '')}</g>`);
				}
			}
			const matrix = matrixAt(target.x, target.y);
			emit(
				`<use href="#${useId}" ${placement(target.x, target.y)}/>`,
				(aperture.records ?? []).map((record) => transformRecord(record, matrix))
			);
			return;
		}
		const color = token();
		emitBatched(
			`u${color}`,
			`<use href="#${aperture.id}" ${placement(target.x, target.y)}/>`,
			(parts) => `<g fill="${color}">${parts.join('')}</g>`,
			[
				{
					type: 'flash',
					x: target.x,
					y: target.y,
					shape: aperture.kind === 'macro' ? 'other' : aperture.kind,
					width: aperture.w * scaling,
					height: aperture.h * scaling,
					function: aperture.function
				}
			]
		);
	};

	const handleAttribute = (command: string, name: string, value: string) => {
		const values = value
			.split(',')
			.map((part) => part.trim())
			.filter((part) => part.length > 0);
		switch (command) {
			case 'TF': {
				attributes[name.replace(/^\./, '')] = values;
				break;
			}
			case 'TA': {
				apertureAttributes.set(name, values.join(','));
				break;
			}
			case 'TD': {
				if (name) apertureAttributes.delete(name);
				else apertureAttributes.clear();

				break;
			}
			// No default
		}
	};

	const handleExtended = (block: string) => {
		const parts = block.split('*').map((part) => part.trim());
		if (parts[0].startsWith('AM')) {
			macros.set(
				parts[0].slice(2),
				parts.slice(1).filter((line) => line.length > 0)
			);
			return;
		}
		for (const part of parts) {
			if (!part) continue;
			const format = /^FS([DLT]?)([AI]?)X(\d)(\d)Y(\d)(\d)$/.exec(part);
			if (format) {
				omitLeading = format[1] !== 'T';
				incremental = format[2] === 'I';
				integerDigits = Number(format[3]);
				decimalDigits = Number(format[4]);
				continue;
			}
			const attribute = /^T([ADFO])(\.?[$A-Z_a-z][\w$.]*)?(?:,(.*))?$/s.exec(part);
			if (attribute) {
				handleAttribute(`T${attribute[1]}`, attribute[2] ?? '', attribute[3] ?? '');
				continue;
			}
			const definition = /^AD\s*D0*(\d+)([^,]+)(?:,(.*))?$/.exec(part);
			if (definition) {
				defineAperture(Number(definition[1]), definition[2], definition[3] ?? '');
				continue;
			}
			switch (part) {
				case 'MOMM': {
					scale = 1;
					break;
				}
				case 'MOIN': {
					scale = MM_PER_INCH;
					break;
				}
				case 'LPD':
				case 'LPC': {
					flushPath();
					clear = part === 'LPC';

					break;
				}
				default: {
					if (/^LM(N|X|Y|XY)$/.test(part)) {
						mirrorX = part === 'LMX' || part === 'LMXY';
						mirrorY = part === 'LMY' || part === 'LMXY';
					} else if (part.startsWith('LR')) rotation = Number(part.slice(2)) || 0;
					else if (part.startsWith('LS')) scaling = Number(part.slice(2)) || 1;
					else if (part.startsWith('AB')) {
						const code = /^AB\s*D0*(\d+)$/.exec(part);
						if (code) {
							blocks.push({ code: Number(code[1]) });
							sinks.push({ svg: [], records: [] });
						} else closeBlock();
					} else if (part.startsWith('SR')) {
						const steps = /^SRX(\d+)Y(\d+)I([\d+.-]+)J([\d+.-]+)$/.exec(part);
						if (repeat) closeRepeat();
						if (steps) {
							const next = {
								x: Number(steps[1]),
								y: Number(steps[2]),
								i: Number(steps[3]) * scale,
								j: Number(steps[4]) * scale
							};
							// X1Y1 is the legacy way to close a statement or a harmless header
							if (next.x > 1 || next.y > 1) {
								repeat = next;
								sinks.push({ svg: [], records: [] });
							}
						}
					} else if (part === 'IPNEG') complement = true;
					else if (part === 'IPPOS') complement = false;
					else if (part.startsWith('MI')) {
						legacy.mirrorA = part.includes('A1');
						legacy.mirrorB = part.includes('B1');
					} else if (part.startsWith('SF')) {
						legacy.scaleA = Number(/A([\d.]+)/.exec(part)?.[1] ?? 1);
						legacy.scaleB = Number(/B([\d.]+)/.exec(part)?.[1] ?? 1);
					} else if (part.startsWith('OF')) {
						legacy.offsetA = Number(/A([\d+.-]+)/.exec(part)?.[1] ?? 0) * scale;
						legacy.offsetB = Number(/B([\d+.-]+)/.exec(part)?.[1] ?? 0) * scale;
					} else if (part.startsWith('IR'))
						legacy.turns = (Math.round(Number(part.slice(2)) / 90) + 4) % 4;
					else if (part.startsWith('AS')) legacy.swap = part === 'ASAYBX';
				}
			}
		}
	};

	const handleWord = (word: string) => {
		const command = word.replaceAll(/\s+/g, '').toUpperCase();
		if (!command || /^G0*4(?!\d)/.test(command)) return;

		const coordinates: Partial<Record<'X' | 'Y' | 'I' | 'J', string>> = {};
		let dCode: number | undefined;
		for (const [, letter, digits] of command.matchAll(/([DGIJMXY])([+-]?[\d.]+)/g))
			switch (letter) {
				case 'G': {
					const code = Number(digits);
					if (code >= 1 && code <= 3) mode = code;
					else
						switch (code) {
							case 36: {
								flushPath();
								region = true;

								break;
							}
							case 37: {
								endRegion();
								break;
							}
							case 74: {
								singleQuadrant = true;
								break;
							}
							case 75: {
								singleQuadrant = false;
								break;
							}
							case 70: {
								scale = MM_PER_INCH;
								break;
							}
							case 71: {
								scale = 1;
								break;
							}
							case 90: {
								incremental = false;
								break;
							}
							case 91: {
								{
									incremental = true;
									// No default
								}
								break;
							}
						}
					break;
				}
				case 'D': {
					dCode = Number(digits);
					break;
				}
				case 'M': {
					// M02 ends the file, M00 is the historical equivalent
					if (Number(digits) === 0 || Number(digits) === 2) stopped = true;
					break;
				}
				default: {
					coordinates[letter as 'X' | 'Y' | 'I' | 'J'] = digits;
				}
			}

		if (dCode !== undefined && dCode >= 10) {
			flushPath();
			aperture = apertures.get(dCode);
			if (!aperture) warnings.add(`Aperture D${dCode} is not defined`);
			return;
		}
		const hasMove = coordinates.X !== undefined || coordinates.Y !== undefined;
		const hasOffset = coordinates.I !== undefined || coordinates.J !== undefined;
		if (dCode !== undefined && dCode >= 1 && dCode <= 3) operation = dCode;
		else if (!hasMove && !hasOffset) return;

		// Omitted axes are modal; legacy MI/SF/OF/IR/AS act on the coordinate data of the file
		let target = current;
		if (hasMove) {
			const fileX = coordinates.X === undefined ? undefined : coordinate(coordinates.X);
			const fileY = coordinates.Y === undefined ? undefined : coordinate(coordinates.Y);
			const mapped = legacyActive()
				? legacyMap(fileX ?? 0, fileY ?? 0, !incremental)
				: { x: fileX ?? 0, y: fileY ?? 0 };
			const pick = (value: number | undefined, mappedValue: number, held: number) => {
				if (value === undefined) return held;
				return incremental ? held + mappedValue : mappedValue;
			};
			target = {
				x: pick(fileX, mapped.x, current.x),
				y: pick(fileY, mapped.y, current.y)
			};
		}
		const rawOffset = {
			x: coordinates.I === undefined ? 0 : coordinate(coordinates.I),
			y: coordinates.J === undefined ? 0 : coordinate(coordinates.J)
		};
		const offset = legacyActive() ? legacyMap(rawOffset.x, rawOffset.y, false) : rawOffset;

		if (operation === 2) {
			flushPath();
			flushContour();
		} else if (operation === 3) {
			flushPath();
			if (!region) flash(target);
		} else if (mode === 1) append(`L${number(target.x)} ${number(target.y)}`, [target]);
		else arc(target, offset.x, offset.y);
		current = target;
	};

	try {
		for (const match of text.matchAll(/%([^%]*)%|([^%*]*)\*/g)) {
			if (stopped) break;
			if (match[1] === undefined) handleWord(match[2]);
			else handleExtended(match[1]);
		}
		flushPath();
		if (region) {
			warnings.add('Region statement was not closed');
			endRegion();
		}
		if (repeat) closeRepeat();
		while (blocks.length > 0) {
			warnings.add('Aperture block was not closed');
			closeBlock();
		}
		flushBatch(top);
	} catch (error) {
		warnings.add(`Plotting stopped: ${error instanceof Error ? error.message : String(error)}`);
	}

	const declared = (attributes.FilePolarity?.[0] ?? '').toLowerCase();
	let polarity: PlotResult['polarity'];
	if (declared === 'negative') polarity = 'Negative';
	else if (declared === 'positive') polarity = 'Positive';

	return {
		defs: withSvg ? defs.join('') : '',
		objects: top.svg.join(''),
		records: top.records,
		extent: extent.minX <= extent.maxX ? extent : undefined,
		attributes,
		complement,
		polarity,
		warnings: [...warnings]
	};
};
