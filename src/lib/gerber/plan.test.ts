import { describe, expect, it } from 'vitest';

import { Project } from '$types/Project';

import { parseExcellon } from './excellon';
import { drillNpth, drillPth, edgeCuts } from './fixtures';
import { parseOutline } from './gerberOutline';
import { readFabPackage } from './package';
import { defaultToolKeys, planElements, type PlanOptions } from './plan';
import type { DrillHole } from './types';

const sample = () => {
	const pth = parseExcellon(drillPth, 'drill-L1-L2.drl');
	const npth = parseExcellon(drillNpth, 'drill_npth.drl');
	return {
		holes: [...pth.holes, ...npth.holes],
		tools: [...pth.tools, ...npth.tools],
		outline: parseOutline(edgeCuts)
	};
};

const options = (overrides: Partial<PlanOptions> = {}): PlanOptions => ({
	toolKeys: [],
	groupDistance: 2.6,
	minMargin: 0.3,
	circleDepth: 5,
	rectangleDepth: 5,
	...overrides
});

const hole = (x: number, y: number, diameter = 1): DrillHole => ({
	x,
	y,
	diameter,
	toolKey: 'a#T1'
});
const planHoles = (holes: DrillHole[], overrides: Partial<PlanOptions> = {}) =>
	planElements(holes, undefined, options({ toolKeys: ['a#T1'], ...overrides }));

describe('defaultToolKeys', () => {
	it('selects plated lead-size drills only (no vias, no mounting holes)', () => {
		const { tools } = sample();
		expect(defaultToolKeys(tools)).toEqual(['drill-L1-L2.drl#T10']);
	});
});

describe('planElements with the sample board', () => {
	const { holes, tools, outline } = sample();
	const plan = planElements(holes, outline, options({ toolKeys: defaultToolKeys(tools) }));

	it('sizes the panel from the outline', () => {
		expect(plan.panel).toEqual({ width: 23.6, height: 16.2 });
		expect(plan.warnings).toEqual([]);
	});

	it('turns the 2-pin header into one rectangle at the translated position, no Y flip', () => {
		expect(plan.circles).toEqual([]);
		expect(plan.rectangles).toHaveLength(1);
		// holes at (-6.35, +-1.27), origin at (-11.8, -8.1): x = 5.45, y = 8.1
		expect(plan.rectangles[0]).toMatchObject({
			x: 5.45,
			y: 8.1,
			width: 2.6,
			height: 5.1,
			rotation: 0,
			depth: 5
		});
	});

	it('keeps all holes for the preview and marks the selected ones', () => {
		expect(plan.holes).toHaveLength(13);
		expect(plan.holes.filter((candidate) => candidate.selected)).toHaveLength(2);
	});

	it('turns the mounting holes into circles when their tool is selected', () => {
		const all = planElements(
			holes,
			outline,
			options({ toolKeys: ['drill_npth.drl#T10'], circleDepth: 3 })
		);
		expect(all.circles).toHaveLength(2);
		expect(all.circles[0]).toMatchObject({ x: 21.22, y: 13.82, radius: 1.9, depth: 3 });
	});

	it('produces data that survives project validation', () => {
		const everything = planElements(
			holes,
			outline,
			options({ toolKeys: tools.map((tool) => tool.key), groupDistance: 0 })
		);
		expect(everything.circles).toHaveLength(13);
		const result = Project.safeParse({
			name: 'sample',
			image: '',
			label: '',
			panelSettings: { ...everything.panel, pcbThickness: 1.6, smdHeight: 1.5, printTolerance: 0 },
			zoom: 100,
			circles: everything.circles,
			rectangles: plan.rectangles,
			legs: []
		});
		expect(result.success).toBe(true);
	});
});

describe('planElements grouping', () => {
	it('makes a circle of a lone hole with radius from drill and margin', () => {
		const plan = planHoles([hole(10, 10, 0.8), hole(30, 10, 0.8)]);
		expect(plan.rectangles).toEqual([]);
		expect(plan.circles).toHaveLength(2);
		// 0.4 + 0.3 = 0.7
		expect(plan.circles[0].radius).toBe(0.7);
	});

	it('never groups holes of different diameters', () => {
		const plan = planHoles([hole(10, 10, 1), hole(12.54, 10, 0.8)]);
		expect(plan.circles).toHaveLength(2);
		expect(plan.rectangles).toEqual([]);
	});

	it('groups a 2 x 4 DIP footprint into one rectangle when the group distance covers the row gap', () => {
		const holes = [0, 1, 2, 3].flatMap((row) => [
			hole(10, 10 + row * 2.54),
			hole(17.62, 10 + row * 2.54)
		]);
		expect(planHoles(holes, { groupDistance: 2.6 }).rectangles).toHaveLength(2);
		const joined = planHoles(holes, { groupDistance: 8 });
		expect(joined.rectangles).toHaveLength(1);
		expect(joined.rectangles[0]).toMatchObject({ width: 10.2, height: 10.2, rotation: 0 });
	});

	it('rotates the rectangle of a diagonal row counter-clockwise like the input angle', () => {
		const step = 2.54 / Math.SQRT2;
		const plan = planHoles([
			hole(10, 10),
			hole(10 + step, 10 + step),
			hole(10 + 2 * step, 10 + 2 * step)
		]);
		expect(plan.rectangles).toHaveLength(1);
		expect(plan.rectangles[0].rotation).toBe(45);
		// no outline: the panel starts 2 mm before the lowest hole (x = 10, y = 10)
		expect(plan.rectangles[0].x).toBeCloseTo(2 + step, 1);
		expect(plan.rectangles[0].y).toBeCloseTo(2 + step, 1);
		// along the row: 2 pitches + 2 x half pitch = 3 x 2.54; across: one pitch
		expect(plan.rectangles[0].width).toBeCloseTo(7.7, 1);
		expect(plan.rectangles[0].height).toBeCloseTo(2.6, 1);
	});

	it('disables grouping with a zero distance', () => {
		const plan = planHoles([hole(10, 10), hole(12.54, 10)], { groupDistance: 0 });
		expect(plan.circles).toHaveLength(2);
	});

	it('estimates the panel without an outline and warns about holes outside one', () => {
		const plan = planHoles([hole(10, 10), hole(30, 20)]);
		expect(plan.panel).toEqual({ width: 24, height: 14 });
		const outlined = planElements(
			[hole(100, 100)],
			{ contours: [], bbox: { minX: 0, minY: 0, maxX: 20, maxY: 20 } },
			options({ toolKeys: ['a#T1'] })
		);
		expect(outlined.warnings.join(',')).toContain('outside');
	});

	it('enlarges a tiny board to the minimum panel size with a warning', () => {
		const plan = planElements(
			[hole(2, 2)],
			{ contours: [], bbox: { minX: 0, minY: 0, maxX: 5, maxY: 5 } },
			options({ toolKeys: ['a#T1'] })
		);
		expect(plan.panel).toEqual({ width: 10, height: 10 });
		expect(plan.warnings.join(',')).toContain('smaller');
	});
});

describe('readFabPackage', () => {
	it('finds drills and the outline among the other files', () => {
		const result = readFabPackage([
			{
				name: 'F_Cu.gbr',
				text: '%TF.FileFunction,Copper,L1,Top*%\n%FSLAX46Y46*%\nD10*\nX1Y1D03*\nM02*'
			},
			{ name: 'bom.csv', text: 'Designator,Comment' },
			{ name: 'Edge_Cuts.gbr', text: edgeCuts },
			{ name: 'drill-L1-L2.drl', text: drillPth },
			{ name: 'drill_npth.drl', text: drillNpth }
		]);
		expect(result.holes).toHaveLength(13);
		expect(result.tools).toHaveLength(3);
		expect(result.outlineFile).toBe('Edge_Cuts.gbr');
		expect(result.outline?.bbox.maxX).toBe(11.8);
		expect(result.warnings).toEqual([]);
	});

	it('warns when drill file or outline is missing', () => {
		const result = readFabPackage([{ name: 'readme.txt', text: 'hello' }]);
		expect(result.warnings.join(',')).toContain('No drill file');
		expect(result.warnings.join(',')).toContain('No board outline');
	});
});
