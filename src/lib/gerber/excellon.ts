import {
	type DrillHole,
	type DrillRole,
	type DrillTool,
	type Point,
	roundCoordinate
} from './types';

export type ZeroMode = 'leading-zeros-kept' | 'trailing-zeros-kept';

export interface ExcellonOptions {
	/** Overrides what the file declares or what is assumed: digits before/after the decimal point */
	digits?: { integer: number; decimal: number };
	zeroMode?: ZeroMode;
	unit?: 'mm' | 'inch';
}

export interface ExcellonResult {
	holes: DrillHole[];
	tools: DrillTool[];
	warnings: string[];
	/** The file says how integer coordinates are laid out (`FILE_FORMAT`, `METRIC,000.000`, ...) */
	formatDeclared: boolean;
	/** The file says whether it is metric or inch */
	unitDeclared: boolean;
	/** The unit the coordinates were read in */
	inch: boolean;
	/** Some coordinates carry no decimal point, so the layout matters */
	hasIntegerCoordinates: boolean;
}

const MM_PER_INCH = 25.4;
const BOM = new RegExp(`^${String.fromCodePoint(65_279)}`);

/** Candidate layouts tried against the board outline when a file does not declare its format */
export const FORMAT_CANDIDATES: readonly {
	unit: 'mm' | 'inch';
	integer: number;
	decimal: number;
}[] = [
	{ unit: 'mm', integer: 3, decimal: 3 },
	{ unit: 'mm', integer: 3, decimal: 4 },
	{ unit: 'mm', integer: 2, decimal: 4 },
	{ unit: 'mm', integer: 4, decimal: 4 },
	{ unit: 'inch', integer: 2, decimal: 4 },
	{ unit: 'inch', integer: 3, decimal: 3 },
	{ unit: 'inch', integer: 2, decimal: 3 }
];

const ROLE_BY_FUNCTION: Record<string, DrillRole> = {
	viadrill: 'via',
	componentdrill: 'component',
	mechanicaldrill: 'mechanical',
	backdrill: 'other',
	castellateddrill: 'other',
	otherdrill: 'other'
};

/**
 * Parses an Excellon / XNC drill file (as written by KiCad, Altium, Eagle, EasyEDA, DipTrace, tscircuit ...).
 *
 * Covers the XNC specification (rev. 2021.11) and the legacy dialects found in the wild: metric/inch
 * by `METRIC`/`INCH`/`M71`/`M72` or guessed from the tool sizes, decimal and integer coordinates with
 * leading or trailing zero suppression, `FMAT`, `FILE_FORMAT` and `;FORMAT=` layouts, tool
 * definitions with feed/speed parameters, modal X/Y, incremental mode (`G91`, `ICI`), repeats (`R`),
 * slots as `G85` and as routed paths (`G00/M15/G01/M16`) and the X2 attribute comments for plating and
 * tool function. Arcs in routed slots are approximated by their chord. Never throws.
 *
 * @param text - File content
 * @param fileName - Used to name tools and as a plated/non-plated fallback (`NPTH` in the name)
 * @param options - Override the coordinate layout
 */
export const parseExcellon = (
	text: string,
	fileName: string,
	options: ExcellonOptions = {}
): ExcellonResult => {
	const warnings = new Set<string>();
	const lines = text
		.replace(BOM, '')
		.split(/\r\n|\r|\n/)
		.map((line) => line.trim());

	// Header declarations first: the layout and unit must be known before any coordinate is read
	let inch: boolean | undefined;
	let digits: { integer: number; decimal: number } | undefined;
	let zeroMode: ZeroMode | undefined;
	const rawDiameters: number[] = [];
	for (const line of lines) {
		if (line.startsWith(';')) {
			if (/metric/i.test(line) && inch === undefined) inch = false;
			else if (/inch|imperial/i.test(line) && inch === undefined) inch = true;
			const format = /(?:file_format|format)\s*=\s*{?\s*(\d+):(\d+)/i.exec(line);
			if (format) digits = { integer: Number(format[1]), decimal: Number(format[2]) };
			if (/suppress trailing/i.test(line)) zeroMode = 'leading-zeros-kept';
			else if (/suppress leading/i.test(line)) zeroMode = 'trailing-zeros-kept';
			continue;
		}
		const unit = /^(metric|inch)\b(.*)$/i.exec(line);
		if (unit) {
			inch = unit[1].toUpperCase() === 'INCH';
			const rest = unit[2].toUpperCase();
			if (rest.includes('TZ')) zeroMode = 'trailing-zeros-kept';
			else if (rest.includes('LZ')) zeroMode = 'leading-zeros-kept';
			const format = /(0+)\.(0+)/.exec(rest);
			if (format) digits = { integer: format[1].length, decimal: format[2].length };
		} else if (line === 'M71') inch = false;
		else if (line === 'M72') inch = true;
		const tool = /^T\d+.*?C([\d.]+)/.exec(line);
		if (tool) rawDiameters.push(Number.parseFloat(tool[1]));
	}

	const formatDeclared = digits !== undefined || zeroMode !== undefined;
	const unitDeclared = inch !== undefined;
	if (options.unit) inch = options.unit === 'inch';
	if (inch === undefined) {
		// Inch drills are 0.008" to 0.25", metric ones 0.2 to 6 mm: unambiguous in practice
		const largest = Math.max(0, ...rawDiameters);
		inch = rawDiameters.length > 0 && largest <= 0.3;
		if (rawDiameters.length > 0)
			warnings.add(
				`${fileName}: units not declared, assumed ${inch ? 'inch' : 'mm'} from the tool sizes`
			);
	}
	const layout = options.digits ?? digits ?? { integer: inch ? 2 : 3, decimal: inch ? 4 : 3 };
	const zeros = options.zeroMode ?? zeroMode ?? 'leading-zeros-kept';
	const toMm = (value: number) => (inch ? value * MM_PER_INCH : value);

	const parseNumber = (raw: string) => {
		if (raw.includes('.')) return Number.parseFloat(raw);
		const negative = raw.startsWith('-');
		let body = raw.replace(/^[+-]/, '');
		const total = layout.integer + layout.decimal;
		body = zeros === 'leading-zeros-kept' ? body.padEnd(total, '0') : body.padStart(total, '0');
		const value = Number(body) / 10 ** layout.decimal;
		return negative ? -value : value;
	};

	// File level plating: `TF.FileFunction,Plated|NonPlated,i,j,PTH|NPTH|Blind|Buried`
	let filePlated = !/npth|non[ _-]?plated/i.test(fileName);
	let fileBlind = false;
	let pendingRole = 'unknown' as DrillRole;
	let pendingPlated: boolean | undefined;

	const tools = new Map<string, { diameter: number; plated: boolean; role: DrillRole }>();
	const counts = new Map<string, number>();
	const holes: DrillHole[] = [];

	let currentTool: string | undefined;
	let routing = false;
	let toolDown = false;
	let routeCode = 1;
	let incremental = false;
	let position: Point = { x: 0, y: 0 };
	let lastHole: Point | undefined;
	let integerCoordinates = false;
	let finished = false;
	const skipped = { arcs: 0, repeats: 0, undefinedTool: 0 };

	const addHole = (start: Point, end?: Point) => {
		if (!currentTool) return;
		const tool = tools.get(currentTool);
		if (!tool) {
			skipped.undefinedTool++;
			return;
		}
		const toolKey = `${fileName}#${currentTool}`;
		counts.set(toolKey, (counts.get(toolKey) ?? 0) + 1);
		holes.push({
			x: roundCoordinate(toMm(start.x)),
			y: roundCoordinate(toMm(start.y)),
			diameter: tool.diameter,
			toolKey,
			...(end && { slot: { x: roundCoordinate(toMm(end.x)), y: roundCoordinate(toMm(end.y)) } })
		});
	};

	const readCoordinates = (part: string, base: Point) => {
		const xMatch = /X([+-]?[\d.]+)/.exec(part);
		const yMatch = /Y([+-]?[\d.]+)/.exec(part);
		if (!xMatch && !yMatch) return;
		for (const match of [xMatch, yMatch])
			if (match && !match[1].includes('.')) integerCoordinates = true;
		const x = xMatch ? parseNumber(xMatch[1]) : undefined;
		const y = yMatch ? parseNumber(yMatch[1]) : undefined;
		const move = (value: number | undefined, held: number) => {
			if (value === undefined) return held;
			return incremental ? held + value : value;
		};
		return { x: move(x, base.x), y: move(y, base.y) };
	};

	const applyComment = (comment: string) => {
		const attribute = /#@!\s*T([AF])\.([A-Za-z]+),?(.*)$/.exec(comment);
		if (!attribute) {
			if (/^\s*type\s*=\s*non/i.test(comment)) filePlated = false;
			else if (/^\s*type\s*=\s*plated/i.test(comment)) filePlated = true;
			return;
		}
		const [, kind, name, value] = attribute;
		const parts = value.split(',').map((part) => part.trim().toLowerCase());
		if (kind === 'F' && name === 'FileFunction') {
			if (parts.includes('nonplated')) filePlated = false;
			else if (parts.includes('plated')) filePlated = true;
			fileBlind = parts.includes('blind') || parts.includes('buried');
		}
		if (kind === 'A' && name === 'AperFunction') {
			pendingRole = 'unknown';
			for (const part of parts) pendingRole = ROLE_BY_FUNCTION[part] ?? pendingRole;
			if (parts.includes('nonplated') || parts.includes('npth')) pendingPlated = false;
			else if (parts.includes('plated') || parts.includes('pth')) pendingPlated = true;
		}
	};

	for (const line of lines) {
		if (finished) break;
		if (!line || line === '%') continue;
		if (line.startsWith(';')) {
			applyComment(line.slice(1));
			continue;
		}
		const upper = line.toUpperCase();

		if (
			/^(METRIC|INCH|M7[12]|M48|M95|FMAT|VER|DETECT|ICI|G9[0-3]|G05|M47|M0?1\b|OSTOP|ATC|BLKD|HEADER)/.test(
				upper
			)
		) {
			if (upper.startsWith('ICI')) incremental = /ON/.test(upper);
			else if (upper.startsWith('G91')) incremental = true;
			else if (upper.startsWith('G90')) incremental = false;
			else if (upper.startsWith('G05')) {
				routing = false;
				toolDown = false;
			}
			continue;
		}
		if (/^M(30|00|02)\b/.test(upper)) {
			finished = true;
			continue;
		}

		// Tool definition `T01C0.8F200S65` or selection `T01`
		const tool = /^T0*(\d+)(.*)$/.exec(upper);
		if (tool) {
			const id = `T${Number(tool[1])}`;
			const rest = tool[2];
			const diameter = /C([\d.]+)/.exec(rest);
			if (diameter) {
				const size = toMm(Number.parseFloat(diameter[1]));
				let role = pendingRole;
				if (fileBlind) role = 'blind';
				tools.set(id, {
					diameter: roundCoordinate(size),
					plated: pendingPlated ?? filePlated,
					role
				});
				pendingRole = 'unknown';
				pendingPlated = undefined;
				// A definition in the program body also selects the tool
				currentTool = id;
			} else if (tool[1] === '0') currentTool = undefined;
			else currentTool = id;
			if (/^[XY]/.test(rest)) {
				const target = readCoordinates(rest, position);
				if (target) {
					position = target;
					if (!routing) addHole(position);
				}
			}
			continue;
		}

		if (/^R\d/.test(upper)) {
			// Repeat: R<count>X<dx>Y<dy> drills `count` more holes at incremental offsets
			const repeat = /^R(\d+)/.exec(upper);
			const delta = readCoordinates(upper, { x: 0, y: 0 });
			if (repeat && delta && lastHole) {
				let at = { ...lastHole };
				for (let step = 0; step < Number(repeat[1]); step++) {
					at = { x: at.x + delta.x, y: at.y + delta.y };
					addHole(at);
				}
				position = at;
				lastHole = at;
			} else skipped.repeats++;
			continue;
		}

		if (upper.startsWith('M15')) {
			toolDown = true;
			continue;
		}
		if (upper.startsWith('M16') || upper.startsWith('M17')) {
			toolDown = false;
			continue;
		}

		// G code on a coordinate line: G00 (route), G01 (linear), G02/G03 (arc), G85 (slot)
		const slot = /^(.*?)G85(.*)$/.exec(upper);
		if (slot) {
			const start = readCoordinates(slot[1], position);
			const end = readCoordinates(slot[2], start ?? position);
			if (start && end) {
				addHole(start, end);
				position = end;
				lastHole = end;
			}
			continue;
		}
		const route = /^G0([0-3])(.*)$/.exec(upper);
		let body = upper;
		if (route) {
			routeCode = Number(route[1]);
			routing = true;
			body = route[2];
		}
		const target = readCoordinates(body, position);
		if (!target) continue;

		if (routing) {
			if (toolDown && routeCode !== 0) {
				if (routeCode > 1) skipped.arcs++;
				addHole(position, target);
			}
			position = target;
		} else {
			position = target;
			lastHole = target;
			addHole(target);
		}
	}

	if (skipped.arcs > 0)
		warnings.add(`${fileName}: ${skipped.arcs} arc slot(s) approximated by a straight slot`);
	if (skipped.repeats > 0)
		warnings.add(`${fileName}: ${skipped.repeats} repeat command(s) ignored`);
	if (skipped.undefinedTool > 0)
		warnings.add(`${fileName}: ${skipped.undefinedTool} hole(s) use an undefined tool`);

	const result: DrillTool[] = [...tools.entries()]
		.map(([id, info]) => ({
			key: `${fileName}#${id}`,
			file: fileName,
			id,
			...info,
			count: counts.get(`${fileName}#${id}`) ?? 0
		}))
		.filter((item) => item.count > 0);

	return {
		holes,
		tools: result,
		warnings: [...warnings],
		formatDeclared,
		unitDeclared,
		inch,
		hasIntegerCoordinates: integerCoordinates
	};
};

/** True when the first meaningful line is the Excellon / XNC header `M48` (or the file is a bare `T..` program) */
export const isExcellon = (text: string) => {
	for (const rawLine of text
		.slice(0, 4000)
		.replace(BOM, '')
		.split(/\r\n|\r|\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith(';') || line === '%') continue;
		return /^(m48|metric|inch|fmat)/i.test(line);
	}
	return false;
};
