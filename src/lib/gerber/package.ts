import {
	type ExcellonResult,
	FORMAT_CANDIDATES,
	isExcellon,
	parseExcellon,
	type ZeroMode
} from './excellon';
import { drillsFromGerber, isGerberDrillLayer } from './gerberDrill';
import { looksLikeOutlineName, outlineFromRecords } from './gerberOutline';
import { keepoutsFromRecords } from './legs';
import { KEEP_NONE, plotLayer, type PlotOptions } from './plotter';
import {
	type BoardOutline,
	type DrillHole,
	type DrillTool,
	type FabFile,
	type FabPackage,
	type PcbLayout,
	type PlotResult
} from './types';

/** File name extensions that can only mean fabrication data (used to route a drop to the importer) */
const FAB_EXTENSION =
	/\.(zip|drl|drd|xln|exc|ncd|gbr|ger|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gko|gm\d+|gml|gd\d|gdl|gpt|gpb|cmp|sol|stc|sts|plc|pls|crc|crs|oln|art|pho|txt|nc|tap|top|bot|smt|smb|sst|ssb|tsm|bsm|tsk|bsk|dim|mil|fab|npt|cnc)$/i;

export const isFabFileName = (fileName: string) => FAB_EXTENSION.test(fileName);

type Role = 'copper' | 'mask' | 'silk' | 'outline' | 'drill';

const LAYOUT_PREFIX = { copper: 'c', mask: 'm', silk: 's' } as const;

/** Top side layers by the naming conventions of the CAD systems, most specific first */
const NAME_ROLES: readonly (readonly [Exclude<Role, 'outline' | 'drill'>, RegExp])[] = [
	[
		'silk',
		/(^|[^a-z])(f[ ._-]?silk(s|screen)?|top[ ._-]?(silk(screen)?|legend|overlay)|silk(screen)?[ ._-]?top|topsilk(screen)?|gto|plc|tsk|sst)([^a-z]|$)/
	],
	[
		'mask',
		/(^|[^a-z])(f[ ._-]?mask|top[ ._-]?(solder)?mask|(solder)?mask[ ._-]?top|topsolder(mask)?|topmask|gts|stc|tsm|smt)([^a-z]|$)/
	],
	[
		'copper',
		/(^|[^a-z])(f[ ._-]?cu|top[ ._-]?(layer|copper|cu)|toplayer|topcopper|copper[ ._-]?top|front[ ._-]?copper|gtl|cmp|top)([^a-z]|$)/
	]
];

/** Names that are never the layers we need: paste, fabrication and assembly drawings, lists */
const IGNORED_NAME =
	/paste|fab(rication)?([^a-z]|$)|assembl|courtyard|keepout|drawing|drillmap|drill[ ._-]?report|\.(csv|pos|dri|rpt|xml|json|pdf|png|jpe?g|svg|html?)$|\.(gtp|gbp|spt|spb|crc|crs|tcream|bcream)$/i;

/** How sure a name is that a file is the board outline: 2 conventional names, 1 mechanical layers */
const outlineWeight = (name: string) => {
	if (/\.gm1$/i.test(name) || looksLikeOutlineName(name)) return 2;
	return /\.(gm\d+|gml|out)$/i.test(name) ? 1 : 0;
};

/**
 * Role of a Gerber file: by its X2 file function when present (`byAttribute`), else by the
 * conventional names of the CAD systems (KiCad `F_Cu`, Altium/Protel `.GTL`, Eagle `.cmp`, OrCAD
 * `.TOP`, gEDA `top.gbr`, EasyEDA `Gerber_TopLayer.GTL`, DipTrace `Top.gbr` ...). Only top side
 * layers matter: through-hole parts are inserted from the top. `weight` ranks equal roles.
 */
export const roleOf = (file: FabFile): { role?: Role; weight: number; byAttribute: boolean } => {
	const header = file.text.slice(0, 6000);
	const function_ = /%tf\.filefunction,([^*]*)\*/i.exec(header);
	if (function_) {
		const parts = function_[1].split(',').map((part) => part.trim().toLowerCase());
		const [kind] = parts;
		const top = parts.includes('top') || parts.includes('l1');
		const found = (role?: Role) => ({ role, weight: 10, byAttribute: true });
		if (kind === 'profile') return found('outline');
		if (kind === 'plated' || kind === 'nonplated') return found('drill');
		if (kind === 'copper') return found(top ? 'copper' : undefined);
		if (kind === 'soldermask') {
			// Several masks on one side: the one on the copper is index 1
			const index = parts.find((part) => /^\d+$/.test(part));
			return found(top && (!index || index === '1') ? 'mask' : undefined);
		}
		if (kind === 'legend') return found(top ? 'silk' : undefined);
		return found();
	}

	const name = file.name.toLowerCase();
	// OrCAD writes the outline to `.FAB`; everything else called fab is a drawing
	if (name.endsWith('.fab')) return { role: 'outline', weight: 2, byAttribute: false };
	if (IGNORED_NAME.test(name)) return { weight: 0, byAttribute: false };
	const weight = outlineWeight(name);
	if (weight > 0) return { role: 'outline', weight, byAttribute: false };
	for (const [role, pattern] of NAME_ROLES)
		if (pattern.test(name)) return { role, weight: 1, byAttribute: false };
	if (/drill|\.(gdd|gdl|cnc)$/.test(name) && /%(FS|MO|AD)/.test(header))
		return { role: 'drill', weight: 1, byAttribute: false };
	return { weight: 0, byAttribute: false };
};

const isGerber = (text: string) => /%(FS|MO|AD)|^G0?[1-4]\*|^D\d+\*/m.test(text.slice(0, 20_000));

const inside = (hole: DrillHole, outline: BoardOutline, margin = 1) =>
	hole.x >= outline.bbox.minX - margin &&
	hole.x <= outline.bbox.maxX + margin &&
	hole.y >= outline.bbox.minY - margin &&
	hole.y <= outline.bbox.maxY + margin;

/**
 * Excellon files without a declared layout are ambiguous (integer digits, zero suppression, unit).
 * The candidate that lands the most holes on the board outline wins; the default stays unless a
 * candidate is clearly better.
 */
const refineLayout = (file: FabFile, first: ExcellonResult, outline: BoardOutline) => {
	if (first.formatDeclared || !first.hasIntegerCoordinates || first.holes.length === 0)
		return { result: first, guessed: false };
	const score = (candidate: ExcellonResult) =>
		candidate.holes.filter((hole) => inside(hole, outline)).length /
		Math.max(1, candidate.holes.length);

	let best = first;
	let bestScore = score(first);
	if (bestScore >= 0.95) return { result: first, guessed: false };
	const zeroModes: ZeroMode[] = ['leading-zeros-kept', 'trailing-zeros-kept'];
	for (const candidate of FORMAT_CANDIDATES) {
		if (first.unitDeclared && (candidate.unit === 'inch') !== first.inch) continue;
		for (const zeroMode of zeroModes) {
			const parsed = parseExcellon(file.text, file.name, {
				digits: { integer: candidate.integer, decimal: candidate.decimal },
				zeroMode,
				unit: candidate.unit
			});
			const value = score(parsed);
			if (value > bestScore + 0.2) {
				best = parsed;
				bestScore = value;
			}
		}
	}
	return { result: best, guessed: best !== first };
};

/**
 * What is read from the records of each picture layer. The mask is only drawn; copper gives its
 * flashes (pads) and the replica of the profile; the silkscreen outlines of the parts keep clear
 * the legs. The extent of everything is tracked by the plotter, so long traces need no record.
 */
const LAYER_PLOT_OPTIONS = {
	copper: {
		keep: (record) => record.type === 'flash' || /^profile$/i.test(record.function ?? '')
	},
	mask: { keep: KEEP_NONE },
	silk: {}
} satisfies Record<'copper' | 'mask' | 'silk', PlotOptions>;

const padHoles = (plot: PlotResult) => {
	const holes: DrillHole[] = [];
	const tools = new Map<string, DrillTool>();
	for (const record of plot.records) {
		if (record.type !== 'flash' || !/componentpad/i.test(record.function ?? '')) continue;
		const diameter = Math.round(Math.min(record.width, record.height) * 10) / 10;
		const key = `pads#${diameter}`;
		const tool = tools.get(key) ?? {
			key,
			file: 'copper layer',
			id: `pad ${diameter}`,
			diameter,
			plated: true,
			role: 'pad' as const,
			count: 0
		};
		tool.count++;
		tools.set(key, tool);
		holes.push({ x: record.x, y: record.y, diameter, toolKey: key });
	}
	return { holes, tools: [...tools.values()] };
};

/**
 * Reads a fabrication package: Excellon / XNC and Gerber-format drill files, the board outline and the
 * top copper, solder mask and silkscreen layers. Other files (bottom layers, paste, BOM, pick and place)
 * are ignored. Warnings explain what was skipped or guessed.
 */
export const readFabPackage = (files: readonly FabFile[]): FabPackage => {
	const warnings = new Set<string>();
	const sorted = files.toSorted((a, b) => a.name.localeCompare(b.name));

	const drillFiles: { file: FabFile; result: ExcellonResult }[] = [];
	const gerberDrills: { holes: DrillHole[]; tools: DrillTool[] }[] = [];
	const chosen: Partial<Record<Exclude<Role, 'drill'>, { file: FabFile; weight: number }>> = {};
	let outlineFileName: string | undefined;

	for (const file of sorted) {
		if (isExcellon(file.text)) {
			drillFiles.push({ file, result: parseExcellon(file.text, file.name) });
			continue;
		}
		if (!isGerber(file.text)) continue;
		const { role, weight, byAttribute } = roleOf(file);
		if (!role) continue;
		if (role === 'drill') {
			const plot = plotLayer(file.text, 'd', { svg: false });
			if (isGerberDrillLayer(plot.attributes) || byAttribute === false) {
				const drills = drillsFromGerber(plot, file.name);
				gerberDrills.push(drills);
				for (const warning of [...plot.warnings, ...drills.warnings])
					warnings.add(`${file.name}: ${warning}`);
			}
			continue;
		}
		const existing = chosen[role];
		if (!existing || weight > existing.weight) chosen[role] = { file, weight };
	}

	// Board outline
	let outline: BoardOutline | undefined;
	if (chosen.outline) {
		const plot = plotLayer(chosen.outline.file.text, 'o', { svg: false });
		outline = outlineFromRecords(plot.records);
		outlineFileName = outline ? chosen.outline.file.name : undefined;
		if (!outline) warnings.add(`${chosen.outline.file.name}: no outline geometry found`);
	} else warnings.add('No board outline (Edge.Cuts) found, panel size is estimated');

	// Drills
	const holes: DrillHole[] = [];
	const tools: DrillTool[] = [];
	for (const { file, result: first } of drillFiles) {
		let result = first;
		if (outline) {
			const refined = refineLayout(file, first, outline);
			result = refined.result;
			if (refined.guessed)
				warnings.add(
					`${file.name}: coordinate layout is not declared, guessed from the board outline`
				);
		} else if (!first.formatDeclared && first.hasIntegerCoordinates)
			warnings.add(`${file.name}: coordinate layout is not declared, defaults assumed`);
		holes.push(...result.holes);
		tools.push(...result.tools);
		for (const warning of result.warnings) warnings.add(warning);
	}
	for (const drills of gerberDrills) {
		holes.push(...drills.holes);
		tools.push(...drills.tools);
	}

	// Top layers for the picture; copper also tells the component pads when there is no drill data
	const layout: PcbLayout = {};
	let copperPlot: PlotResult | undefined;
	let silkPlot: PlotResult | undefined;
	for (const key of ['copper', 'mask', 'silk'] as const) {
		const entry = chosen[key];
		if (!entry) continue;
		const plot = plotLayer(entry.file.text, LAYOUT_PREFIX[key], LAYER_PLOT_OPTIONS[key]);
		if (key === 'copper') copperPlot = plot;
		if (key === 'silk') silkPlot = plot;
		if (!plot.objects) continue;
		const { records, attributes, ...layer } = plot;
		void records;
		void attributes;
		layout[key] = layer;
		for (const warning of plot.warnings) warnings.add(`${entry.file.name}: ${warning}`);
	}

	if (holes.length === 0 && copperPlot) {
		const pads = padHoles(copperPlot);
		if (pads.holes.length > 0) {
			holes.push(...pads.holes);
			tools.push(...pads.tools);
			warnings.add('No drill file found: component pads of the copper layer are used instead');
		}
	}
	if (holes.length === 0) warnings.add('No drill file found');

	// Without an outline file the profile may still be replicated in a layer with the Profile function
	if (!outline && copperPlot) {
		const replica = outlineFromRecords(
			copperPlot.records.filter((record) => /^profile$/i.test(record.function ?? ''))
		);
		if (replica) {
			outline = replica;
			outlineFileName = chosen.copper?.file.name;
		}
	}

	// Last resort: the extent of the copper
	if (!outline && copperPlot?.extent) {
		outline = { contours: [], bbox: copperPlot.extent };
		warnings.delete('No board outline (Edge.Cuts) found, panel size is estimated');
		warnings.add('No board outline found: the panel is the extent of the copper layer');
	}

	// SMD pads (through-hole pads are holes already) and the silkscreen outlines of the parts
	const partKeepouts = [
		...keepoutsFromRecords(
			(copperPlot?.records ?? []).filter((record) => record.type === 'flash'),
			(record) => /componentpad/i.test(record.type === 'region' ? '' : (record.function ?? ''))
		),
		...keepoutsFromRecords(silkPlot?.records ?? [])
	];

	return {
		holes,
		tools,
		outline,
		partKeepouts: partKeepouts.length > 0 ? partKeepouts : undefined,
		outlineFile: outlineFileName,
		layout: Object.keys(layout).length > 0 ? layout : undefined,
		warnings: [...warnings]
	};
};
