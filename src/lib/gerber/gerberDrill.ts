import type { DrillHole, DrillRole, DrillTool, PlotResult } from './types';
import { roundCoordinate } from './types';

export interface GerberDrillResult {
	holes: DrillHole[];
	tools: DrillTool[];
	warnings: string[];
}

const ROLE_BY_FUNCTION: Record<string, DrillRole> = {
	viadrill: 'via',
	componentdrill: 'component',
	mechanicaldrill: 'mechanical',
	backdrill: 'other',
	castellateddrill: 'other',
	otherdrill: 'other'
};

/** Layer is a drill/rout layer by its X2 file function (`Plated`, `NonPlated`) */
export const isGerberDrillLayer = (attributes: Record<string, string[]>) =>
	/^(plated|nonplated)$/i.test(attributes.FileFunction?.[0] ?? '');

/**
 * Holes and slots of a drill layer written as Gerber (Ucamco's recommended way, KiCad's "Gerber X2"
 * drill option): flashes are drill holes with the aperture diameter, draws and arcs are slots.
 * Obround and rectangular flashes are read as slots along their long side.
 */
export const drillsFromGerber = (plot: PlotResult, fileName: string): GerberDrillResult => {
	const function_ = plot.attributes.FileFunction ?? [];
	const lower = function_.map((part) => part.toLowerCase());
	const plated = lower[0] === 'plated' || (lower[0] !== 'nonplated' && !/npth/i.test(fileName));
	const blind = lower.includes('blind') || lower.includes('buried');

	const warnings = new Set<string>();
	const holes: DrillHole[] = [];
	const tools = new Map<string, DrillTool>();

	const toolFor = (diameter: number, functionValue: string | undefined) => {
		const size = roundCoordinate(diameter);
		const id = `D${size}`;
		const key = `${fileName}#${id}${functionValue ? `:${functionValue}` : ''}`;
		let tool = tools.get(key);
		if (!tool) {
			let role: DrillRole = 'unknown';
			for (const part of (functionValue ?? '').toLowerCase().split(','))
				role = ROLE_BY_FUNCTION[part] ?? role;
			if (blind) role = 'blind';
			tool = { key, file: fileName, id, diameter: size, plated, role, count: 0 };
			tools.set(key, tool);
		}
		tool.count++;
		return tool.key;
	};

	for (const record of plot.records)
		if (record.type === 'region')
			warnings.add(`${fileName}: filled regions in a drill layer are skipped`);
		else if (record.type === 'draw') {
			if (record.points.length > 2)
				warnings.add(`${fileName}: routed paths are read as straight slots`);
			for (let index = 0; index < record.points.length - 1; index++) {
				const [start, end] = [record.points[index], record.points[index + 1]];
				holes.push({
					x: roundCoordinate(start.x),
					y: roundCoordinate(start.y),
					diameter: roundCoordinate(record.width),
					toolKey: toolFor(record.width, record.function),
					slot: { x: roundCoordinate(end.x), y: roundCoordinate(end.y) }
				});
			}
		} else if (record.shape === 'C')
			holes.push({
				x: roundCoordinate(record.x),
				y: roundCoordinate(record.y),
				diameter: roundCoordinate(record.width),
				toolKey: toolFor(record.width, record.function)
			});
		else if (record.shape === 'O' || record.shape === 'R') {
			const diameter = Math.min(record.width, record.height);
			const half = (Math.max(record.width, record.height) - diameter) / 2;
			const horizontal = record.width >= record.height;
			const dx = horizontal ? half : 0;
			const dy = horizontal ? 0 : half;
			holes.push({
				x: roundCoordinate(record.x - dx),
				y: roundCoordinate(record.y - dy),
				diameter: roundCoordinate(diameter),
				toolKey: toolFor(diameter, record.function),
				slot: { x: roundCoordinate(record.x + dx), y: roundCoordinate(record.y + dy) }
			});
		} else warnings.add(`${fileName}: non-circular drill flashes are skipped`);

	return { holes, tools: [...tools.values()], warnings: [...warnings] };
};
