import { type DrillHole, type DrillTool, roundCoordinate } from './types';

export interface ExcellonResult {
	holes: DrillHole[];
	tools: DrillTool[];
	warnings: string[];
}

const MM_PER_INCH = 25.4;
const DEFAULT_DIGITS = { mm: { integer: 3, decimal: 3 }, inch: { integer: 2, decimal: 4 } };

type ZeroSuppression = 'leading-zeros-kept' | 'trailing-zeros-kept';

/**
 * Parses an Excellon drill file (as written by KiCad, Altium, EasyEDA, tscircuit, ...).
 *
 * Supports metric/inch, decimal and integer coordinates with either zero suppression, modal X/Y and
 * the X2 attributes that tell plated from non-plated tools and vias from component drills.
 * Slots and routing moves are skipped with a warning. Never throws: unreadable lines are ignored.
 *
 * @param text - File content
 * @param fileName - Used to name tools and as a plated/non-plated fallback (`NPTH` in the name)
 */
export const parseExcellon = (text: string, fileName: string): ExcellonResult => {
	const warnings: string[] = [];
	const diameters = new Map<string, { diameter: number; plated: boolean; via: boolean }>();
	const counts = new Map<string, number>();
	const holes: DrillHole[] = [];

	let inch = false;
	let unitDeclared = false;
	let digits = { ...DEFAULT_DIGITS.mm };
	let digitsDeclared = false;
	let zeros: ZeroSuppression = 'leading-zeros-kept';
	let incremental = false;
	let filePlated = !/npth|non[_-]?plated/i.test(fileName);
	let pendingVia = false;
	let pendingPlated: boolean | undefined;
	let currentTool: string | undefined;
	let x = 0;
	let y = 0;
	let slots = 0;
	let routing = 0;
	let repeats = 0;

	const toMm = (value: number) => (inch ? value * MM_PER_INCH : value);

	const setUnit = (isInch: boolean) => {
		inch = isInch;
		unitDeclared = true;
		if (!digitsDeclared) digits = { ...DEFAULT_DIGITS[isInch ? 'inch' : 'mm'] };
	};

	const parseNumber = (raw: string) => {
		if (raw.includes('.')) return Number.parseFloat(raw);

		const negative = raw.startsWith('-');
		let body = raw.replace(/^[+-]/, '');
		const total = digits.integer + digits.decimal;
		body = zeros === 'leading-zeros-kept' ? body.padEnd(total, '0') : body.padStart(total, '0');
		const value = Number(body) / 10 ** digits.decimal;
		return negative ? -value : value;
	};

	const applyFormat = (comment: string) => {
		// KiCad: FORMAT={-:-/ absolute / metric / decimal} or {3:3/ absolute / metric / suppress trailing zeros}
		if (/metric/i.test(comment) && !unitDeclared) setUnit(false);
		else if (/inch|imperial/i.test(comment) && !unitDeclared) setUnit(true);
		const format = /(\d+):(\d+)/.exec(comment);
		if (format) {
			digits = { integer: Number(format[1]), decimal: Number(format[2]) };
			digitsDeclared = true;
		}
		if (/suppress trailing/i.test(comment)) zeros = 'leading-zeros-kept';
		else if (/suppress leading/i.test(comment)) zeros = 'trailing-zeros-kept';
	};

	const applyComment = (comment: string) => {
		const attribute = /#@!\s*(T[AF])\.([A-Za-z]+),?(.*)$/.exec(comment);
		if (attribute) {
			const [, kind, name, value] = attribute;
			const parts = new Set(value.split(',').map((part) => part.trim().toLowerCase()));
			if (kind === 'TF' && name === 'FileFunction')
				if (parts.has('nonplated')) filePlated = false;
				else if (parts.has('plated')) filePlated = true;

			if (kind === 'TA' && name === 'AperFunction') {
				pendingVia = parts.has('viadrill');
				if (parts.has('nonplated') || parts.has('npth')) pendingPlated = false;
				else if (parts.has('plated') || parts.has('pth')) pendingPlated = true;
			}
			return;
		}
		if (/^\s*format\s*=/i.test(comment) || /^\s*file_format\s*=/i.test(comment))
			applyFormat(comment);
		else if (/^\s*type\s*=\s*non/i.test(comment)) filePlated = false;
		else if (/^\s*type\s*=\s*plated/i.test(comment)) filePlated = true;
	};

	const defineTool = (id: string, diameter: number) => {
		diameters.set(id, {
			diameter: roundCoordinate(toMm(diameter)),
			plated: pendingPlated ?? filePlated,
			via: pendingVia
		});
		pendingVia = false;
		pendingPlated = undefined;
	};

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line === '%') continue;

		if (line.startsWith(';')) {
			applyComment(line.slice(1));
			continue;
		}

		const unit = /^(metric|inch)\b(.*)$/i.exec(line);
		if (unit) {
			setUnit(unit[1].toUpperCase() === 'INCH');
			const options = unit[2].toUpperCase();
			if (options.includes('TZ')) zeros = 'trailing-zeros-kept';
			else if (options.includes('LZ')) zeros = 'leading-zeros-kept';
			const format = /(0+)\.(0+)/.exec(options);
			if (format) {
				digits = { integer: format[1].length, decimal: format[2].length };
				digitsDeclared = true;
			}
			continue;
		}
		if (line === 'M71') {
			setUnit(false);
			continue;
		}
		if (line === 'M72') {
			setUnit(true);
			continue;
		}
		if (/^G90\b/.test(line)) incremental = false;
		else if (/^G91\b/.test(line)) incremental = true;

		// Tool definition or selection: T10C1.000 / T10
		const tool = /^T(\d+)(?:.*?C([\d.]+))?/.exec(line);
		if (tool && !/^[XY]/.test(line)) {
			const id = `T${Number(tool[1])}`;
			if (tool[2] === undefined) {
				if (diameters.has(id)) currentTool = id;
			} else {
				defineTool(id, Number.parseFloat(tool[2]));
				// A definition inside the program body also selects the tool
				currentTool = id;
			}
			continue;
		}

		if (/^R\d/.test(line)) {
			repeats++;
			continue;
		}
		if (/G85/.test(line)) {
			slots++;
			continue;
		}
		if (/^G0[0-3]\b/.test(line) || /^M1[56]\b/.test(line)) {
			routing++;
			continue;
		}

		const xMatch = /X([+-]?[\d.]+)/.exec(line);
		const yMatch = /Y([+-]?[\d.]+)/.exec(line);
		if (!xMatch && !yMatch) continue;

		if (xMatch) x = incremental ? x + parseNumber(xMatch[1]) : parseNumber(xMatch[1]);
		if (yMatch) y = incremental ? y + parseNumber(yMatch[1]) : parseNumber(yMatch[1]);

		const info = currentTool ? diameters.get(currentTool) : undefined;
		if (!currentTool || !info || !Number.isFinite(x) || !Number.isFinite(y)) continue;

		const toolKey = `${fileName}#${currentTool}`;
		counts.set(toolKey, (counts.get(toolKey) ?? 0) + 1);
		holes.push({
			x: roundCoordinate(toMm(x)),
			y: roundCoordinate(toMm(y)),
			diameter: info.diameter,
			toolKey
		});
	}

	if (!unitDeclared && holes.length > 0)
		warnings.push(`${fileName}: units not declared, assumed inch`);
	if (slots > 0) warnings.push(`${fileName}: ${slots} slot(s) skipped`);
	if (routing > 0) warnings.push(`${fileName}: ${routing} routing move(s) skipped`);
	if (repeats > 0) warnings.push(`${fileName}: ${repeats} repeat command(s) not supported`);

	const tools: DrillTool[] = [...diameters.entries()]
		.map(([id, info]) => ({
			key: `${fileName}#${id}`,
			file: fileName,
			id,
			...info,
			count: counts.get(`${fileName}#${id}`) ?? 0
		}))
		.filter((tool) => tool.count > 0);

	return { holes, tools, warnings };
};

/** True when the first meaningful line is the Excellon header `M48` */
export const isExcellon = (text: string) => {
	for (const rawLine of text.slice(0, 4000).split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith(';') || line === '%') continue;
		return line.startsWith('M48');
	}
	return false;
};
