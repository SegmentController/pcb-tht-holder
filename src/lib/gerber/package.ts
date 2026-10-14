import { isExcellon, parseExcellon } from './excellon';
import { hasProfileAttribute, looksLikeOutlineName, parseOutline } from './gerberOutline';
import type { DrillHole, DrillTool, FabFile, FabPackage } from './types';

/** File name extensions that can only mean fabrication data (used to route a drop to the importer) */
const FAB_EXTENSION = /\.(zip|drl|xln|exc|drd|gbr|gko|gm1|gml|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp)$/i;

export const isFabFileName = (fileName: string) => FAB_EXTENSION.test(fileName);

/**
 * Reads a fabrication package: every Excellon drill file and the board outline layer.
 * Other files (copper, mask, BOM, pick and place) are ignored. Warnings explain what was skipped.
 */
export const readFabPackage = (files: readonly FabFile[]): FabPackage => {
	const warnings: string[] = [];
	const holes: DrillHole[] = [];
	const tools: DrillTool[] = [];
	let outlineFile: FabFile | undefined;

	const sorted = files.toSorted((a, b) => a.name.localeCompare(b.name));
	for (const file of sorted) {
		if (isExcellon(file.text)) {
			const result = parseExcellon(file.text, file.name);
			holes.push(...result.holes);
			tools.push(...result.tools);
			warnings.push(...result.warnings);
			continue;
		}

		// The profile attribute beats a name match when several candidates exist
		if (hasProfileAttribute(file.text)) {
			if (!outlineFile || !hasProfileAttribute(outlineFile.text)) outlineFile = file;
		} else if (!outlineFile && looksLikeOutlineName(file.name) && /%FS|%MO|^G0/m.test(file.text))
			outlineFile = file;
	}

	const outline = outlineFile ? parseOutline(outlineFile.text) : undefined;
	if (outlineFile && !outline) warnings.push(`${outlineFile.name}: no outline geometry found`);
	if (!outlineFile) warnings.push('No board outline (Edge.Cuts) found, panel size is estimated');
	if (holes.length === 0) warnings.push('No drill file found');

	return { holes, tools, outline, outlineFile: outline ? outlineFile?.name : undefined, warnings };
};
