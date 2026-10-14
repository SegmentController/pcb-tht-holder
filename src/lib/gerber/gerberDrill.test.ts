import { describe, expect, it } from 'vitest';

import { drillsFromGerber, isGerberDrillLayer } from './gerberDrill';
import type { PlotRecord, PlotResult } from './types';

const plot = (records: PlotRecord[], attributes: Record<string, string[]> = {}): PlotResult => ({
	defs: '',
	objects: '',
	complement: false,
	warnings: [],
	records,
	attributes
});

const flash = (
	x: number,
	y: number,
	size: number,
	functionValue?: string,
	shape: 'C' | 'O' | 'R' | 'P' | 'other' = 'C',
	height = size
): PlotRecord => ({ type: 'flash', x, y, shape, width: size, height, function: functionValue });

describe('isGerberDrillLayer', () => {
	it('recognises plated and non-plated drill layers by the X2 file function', () => {
		expect(isGerberDrillLayer({ FileFunction: ['Plated', '1', '2', 'PTH', 'Drill'] })).toBe(true);
		expect(isGerberDrillLayer({ FileFunction: ['NonPlated', '1', '2', 'NPTH', 'Drill'] })).toBe(
			true
		);
		expect(isGerberDrillLayer({ FileFunction: ['plated'] })).toBe(true);
	});

	it('rejects other layers and files without a file function', () => {
		expect(isGerberDrillLayer({ FileFunction: ['Copper', 'L1', 'Top'] })).toBe(false);
		expect(isGerberDrillLayer({ FileFunction: ['Profile', 'NP'] })).toBe(false);
		expect(isGerberDrillLayer({})).toBe(false);
	});
});

describe('drillsFromGerber', () => {
	it('reads circular flashes as holes of the aperture diameter', () => {
		const result = drillsFromGerber(
			plot([flash(10, 20, 0.8, 'ComponentDrill'), flash(12.54, 20, 0.8, 'ComponentDrill')], {
				FileFunction: ['Plated', '1', '2', 'PTH']
			}),
			'board-PTH.gbr'
		);

		expect(result.holes).toEqual([
			{ x: 10, y: 20, diameter: 0.8, toolKey: 'board-PTH.gbr#D0.8:ComponentDrill' },
			{ x: 12.54, y: 20, diameter: 0.8, toolKey: 'board-PTH.gbr#D0.8:ComponentDrill' }
		]);
		expect(result.tools).toEqual([
			{
				key: 'board-PTH.gbr#D0.8:ComponentDrill',
				file: 'board-PTH.gbr',
				id: 'D0.8',
				diameter: 0.8,
				plated: true,
				role: 'component',
				count: 2
			}
		]);
		expect(result.warnings).toEqual([]);
	});

	it('splits tools of equal diameter by their declared function', () => {
		const result = drillsFromGerber(
			plot([flash(0, 0, 0.3, 'ViaDrill'), flash(1, 0, 0.3, 'ComponentDrill'), flash(2, 0, 0.3)]),
			'd.gbr'
		);
		expect(result.tools.map((tool) => [tool.id, tool.role, tool.count])).toEqual([
			['D0.3', 'via', 1],
			['D0.3', 'component', 1],
			['D0.3', 'unknown', 1]
		]);
		expect(new Set(result.tools.map((tool) => tool.key)).size).toBe(3);
	});

	it('maps every declared drill function to a role', () => {
		const roleOf = (functionValue: string) =>
			drillsFromGerber(plot([flash(0, 0, 1, functionValue)]), 'd.gbr').tools[0].role;
		expect(roleOf('MechanicalDrill')).toBe('mechanical');
		expect(roleOf('BackDrill')).toBe('other');
		expect(roleOf('CastellatedDrill')).toBe('other');
		expect(roleOf('OtherDrill')).toBe('other');
		expect(roleOf('ViaDrill')).toBe('via');
		expect(roleOf('SomethingNew')).toBe('unknown');
	});

	it('lets a later part of a multi-valued function win and ignores unknown parts', () => {
		const [tool] = drillsFromGerber(
			plot([flash(0, 0, 1, 'ComponentDrill,PressFit')]),
			'd.gbr'
		).tools;
		expect(tool.role).toBe('component');
	});

	it('treats blind and buried drills as blind whatever the aperture says', () => {
		for (const marker of ['Blind', 'Buried']) {
			const [tool] = drillsFromGerber(
				plot([flash(0, 0, 0.2, 'ViaDrill')], { FileFunction: ['Plated', '1', '2', marker] }),
				'd.gbr'
			).tools;
			expect(tool.role).toBe('blind');
		}
	});

	describe('plating', () => {
		const platedOf = (attributes: Record<string, string[]>, fileName: string) =>
			drillsFromGerber(plot([flash(0, 0, 1)], attributes), fileName).tools[0].plated;

		it('follows the file function', () => {
			expect(platedOf({ FileFunction: ['Plated', '1', '2'] }, 'a.gbr')).toBe(true);
			expect(platedOf({ FileFunction: ['NonPlated', '1', '2'] }, 'a.gbr')).toBe(false);
		});

		it('falls back to the file name when there is no file function', () => {
			expect(platedOf({}, 'board.gbr')).toBe(true);
			expect(platedOf({}, 'board-NPTH.gbr')).toBe(false);
			expect(platedOf({}, 'board-npth.gbr')).toBe(false);
		});

		it('trusts the file function over the file name', () => {
			expect(platedOf({ FileFunction: ['Plated'] }, 'board-NPTH.gbr')).toBe(true);
			expect(platedOf({ FileFunction: ['NonPlated'] }, 'board-PTH.gbr')).toBe(false);
		});
	});

	describe('slots', () => {
		it('reads a draw as a slot as wide as the stroke', () => {
			const result = drillsFromGerber(
				plot([
					{
						type: 'draw',
						points: [
							{ x: 1, y: 2 },
							{ x: 4, y: 2 }
						],
						width: 1.2
					}
				]),
				'd.gbr'
			);
			expect(result.holes).toEqual([
				{
					x: 1,
					y: 2,
					diameter: 1.2,
					toolKey: 'd.gbr#D1.2',
					slot: { x: 4, y: 2 }
				}
			]);
			expect(result.warnings).toEqual([]);
		});

		it('reads a routed path as straight slots and says so once', () => {
			const result = drillsFromGerber(
				plot([
					{
						type: 'draw',
						points: [
							{ x: 0, y: 0 },
							{ x: 2, y: 0 },
							{ x: 2, y: 3 }
						],
						width: 1
					},
					{
						type: 'draw',
						points: [
							{ x: 5, y: 0 },
							{ x: 6, y: 0 },
							{ x: 6, y: 1 }
						],
						width: 1
					}
				]),
				'd.gbr'
			);
			expect(result.holes.map((hole) => hole.slot)).toEqual([
				{ x: 2, y: 0 },
				{ x: 2, y: 3 },
				{ x: 6, y: 0 },
				{ x: 6, y: 1 }
			]);
			expect(result.warnings).toEqual(['d.gbr: routed paths are read as straight slots']);
			expect(result.tools[0].count).toBe(4);
		});

		it('reads a horizontal obround as a slot along its long side', () => {
			const [hole] = drillsFromGerber(plot([flash(5, 5, 3, undefined, 'O', 1)]), 'd.gbr').holes;
			expect(hole).toMatchObject({ x: 4, y: 5, diameter: 1, slot: { x: 6, y: 5 } });
		});

		it('reads a vertical rectangle as a slot along its long side', () => {
			const [hole] = drillsFromGerber(plot([flash(5, 5, 1, undefined, 'R', 3)]), 'd.gbr').holes;
			expect(hole).toMatchObject({ x: 5, y: 4, diameter: 1, slot: { x: 5, y: 6 } });
		});

		it('keeps a square flash as a zero length slot', () => {
			const [hole] = drillsFromGerber(plot([flash(5, 5, 2, undefined, 'R')]), 'd.gbr').holes;
			expect(hole).toMatchObject({ x: 5, y: 5, diameter: 2, slot: { x: 5, y: 5 } });
		});
	});

	describe('unsupported geometry', () => {
		it('skips regions and non-circular flashes with one warning each', () => {
			const result = drillsFromGerber(
				plot([
					{ type: 'region', points: [] },
					{ type: 'region', points: [] },
					flash(0, 0, 1, undefined, 'P'),
					flash(1, 1, 1, undefined, 'other'),
					flash(2, 2, 0.5)
				]),
				'd.gbr'
			);
			expect(result.holes).toHaveLength(1);
			expect(result.warnings).toEqual([
				'd.gbr: filled regions in a drill layer are skipped',
				'd.gbr: non-circular drill flashes are skipped'
			]);
		});
	});

	it('removes float noise from coordinates and diameters', () => {
		const [hole] = drillsFromGerber(
			plot([flash(0.1 + 0.2, 1.000_04, 0.300_000_000_000_000_04)]),
			'd.gbr'
		).holes;
		expect(hole).toEqual({ x: 0.3, y: 1, diameter: 0.3, toolKey: 'd.gbr#D0.3' });
	});

	it('returns nothing for an empty layer', () => {
		expect(drillsFromGerber(plot([]), 'd.gbr')).toEqual({ holes: [], tools: [], warnings: [] });
	});
});
