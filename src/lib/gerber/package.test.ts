import { describe, expect, it } from 'vitest';

import { copperTop, drillNpth, drillPth, edgeCuts, maskTop, silkTop } from './fixtures';
import { isFabFileName, readFabPackage } from './package';
import { defaultToolKeys, planElements } from './plan';

const gerber = (...lines: string[]) => ['%FSLAX46Y46*%', '%MOMM*%', ...lines, 'M02*'].join('\n');
const square = (size: number, attribute = '') =>
	gerber(
		attribute,
		'%ADD10C,0.1*%',
		'D10*',
		'G01*',
		'X0Y0D02*',
		`X${size * 1e6}Y0D01*`,
		`X${size * 1e6}Y${size * 1e6}D01*`,
		`X0Y${size * 1e6}D01*`,
		'X0Y0D01*'
	);
const excellon = (...lines: string[]) => ['M48', 'METRIC', ...lines, 'M30'].join('\n');

describe('readFabPackage: the sample package', () => {
	const files = [
		{ name: 'F_Cu.gbr', text: copperTop },
		{ name: 'F_Mask.gbr', text: maskTop },
		{ name: 'F_SilkScreen.gbr', text: silkTop },
		{ name: 'Edge_Cuts.gbr', text: edgeCuts },
		{ name: 'drill-L1-L2.drl', text: drillPth },
		{ name: 'drill_npth.drl', text: drillNpth },
		{ name: 'bom.csv', text: 'Designator,Comment' }
	];
	const result = readFabPackage(files);

	it('finds drills, outline and the three top layers', () => {
		expect(result.holes).toHaveLength(13);
		expect(result.outlineFile).toBe('Edge_Cuts.gbr');
		expect(result.outline?.bbox).toEqual({ minX: -11.8, minY: -8.1, maxX: 11.8, maxY: 8.1 });
		expect(Object.keys(result.layout ?? {}).toSorted()).toEqual(['copper', 'mask', 'silk']);
		expect(result.warnings).toEqual([]);
	});

	it('selects only the component holes by default', () => {
		const keys = defaultToolKeys(result.tools);
		expect(keys).toEqual(['drill-L1-L2.drl#T10']);
		const plan = planElements(result.holes, result.outline, {
			toolKeys: keys,
			groupDistance: 2.6,
			minMargin: 0.3,
			circleDepth: 5,
			rectangleDepth: 5
		});
		expect(plan.rectangles).toHaveLength(1);
		expect(plan.origin).toEqual({ x: -11.8, y: -8.1 });
	});
});

describe('readFabPackage: CAD naming conventions', () => {
	const copper = gerber('%ADD10C,1*%', 'D10*', 'X1000000Y1000000D03*');
	const outline = square(20);
	const drill = excellon('T1C0.8', '%', 'T1', 'X5.0Y5.0');
	const layers = (names: {
		copper: string;
		mask: string;
		silk: string;
		outline: string;
		drill: string;
	}) =>
		readFabPackage([
			{ name: names.copper, text: copper },
			{ name: names.mask, text: copper },
			{ name: names.silk, text: copper },
			{ name: names.outline, text: outline },
			{ name: names.drill, text: drill },
			{ name: 'B_Cu.gbr', text: gerber('%ADD10C,1*%', 'D10*', 'X9000000Y9000000D03*') }
		]);

	it.each([
		[
			'KiCad',
			{
				copper: 'board-F_Cu.gbr',
				mask: 'board-F_Mask.gbr',
				silk: 'board-F_Silkscreen.gbr',
				outline: 'board-Edge_Cuts.gbr',
				drill: 'board-PTH.drl'
			}
		],
		[
			'KiCad 5',
			{
				copper: 'board-F.Cu.gtl',
				mask: 'board-F.Mask.gts',
				silk: 'board-F.SilkS.gto',
				outline: 'board-Edge.Cuts.gm1',
				drill: 'board.drl'
			}
		],
		[
			'Protel / Altium',
			{
				copper: 'board.GTL',
				mask: 'board.GTS',
				silk: 'board.GTO',
				outline: 'board.GKO',
				drill: 'board.TXT'
			}
		],
		[
			'Eagle',
			{
				copper: 'board.cmp',
				mask: 'board.stc',
				silk: 'board.plc',
				outline: 'board.gml',
				drill: 'board.drd'
			}
		],
		[
			'EasyEDA / JLC',
			{
				copper: 'Gerber_TopLayer.GTL',
				mask: 'Gerber_TopSolderMaskLayer.GTS',
				silk: 'Gerber_TopSilkscreenLayer.GTO',
				outline: 'Gerber_BoardOutlineLayer.GKO',
				drill: 'Drill_PTH_Through.DRL'
			}
		]
	])('recognises %s file names', (_name, names) => {
		const result = layers(names);
		expect(Object.keys(result.layout ?? {}).toSorted()).toEqual(['copper', 'mask', 'silk']);
		expect(result.outline?.bbox.maxX).toBe(20);
		expect(result.holes).toHaveLength(1);
		expect(result.warnings).toEqual([]);
	});

	it('trusts the X2 file function over the file name', () => {
		const result = readFabPackage([
			{ name: 'layer1.gbr', text: square(10, '%TF.FileFunction,Profile,NP*%') },
			{
				name: 'layer2.gbr',
				text: gerber(
					'%TF.FileFunction,Copper,L1,Top*%',
					'%ADD10C,1*%',
					'D10*',
					'X1000000Y1000000D03*'
				)
			},
			{
				name: 'layer3.gbr',
				text: gerber(
					'%TF.FileFunction,Copper,L2,Bot*%',
					'%ADD10C,1*%',
					'D10*',
					'X1000000Y1000000D03*'
				)
			},
			{
				name: 'layer4.gbr',
				text: gerber('%TF.FileFunction,Legend,Bot*%', '%ADD10C,1*%', 'D10*', 'X1000000Y1000000D03*')
			}
		]);
		expect(result.outlineFile).toBe('layer1.gbr');
		expect(Object.keys(result.layout ?? {})).toEqual(['copper']);
	});

	it('recognises file extensions of fabrication data for routing a drop', () => {
		for (const name of ['a.zip', 'a.GTL', 'a.drl', 'a.xln', 'a.gbr', 'a.gko', 'a.cmp', 'a.GM1'])
			expect(isFabFileName(name)).toBe(true);
		for (const name of ['a.png', 'a.tht3d', 'a.csv', 'a.json'])
			expect(isFabFileName(name)).toBe(false);
	});
});

describe('readFabPackage: drills in Gerber format and fallbacks', () => {
	it('reads Gerber X2 drill files: holes from flashes, slots from draws, roles from apertures', () => {
		const text = gerber(
			'%TF.FileFunction,Plated,1,2,PTH*%',
			'%TA.AperFunction,ComponentDrill*%',
			'%ADD10C,1.0*%',
			'%TA.AperFunction,ViaDrill*%',
			'%ADD11C,0.3*%',
			'%TA.AperFunction,ComponentDrill*%',
			'%ADD12C,1.6*%',
			'D10*',
			'X10000000Y10000000D03*',
			'D11*',
			'X20000000Y10000000D03*',
			'D12*',
			'G01*',
			'X30000000Y10000000D02*',
			'X34000000Y10000000D01*'
		);
		const result = readFabPackage([
			{ name: 'board-PTH.gbr', text },
			{ name: 'board-Edge.gbr', text: square(50, '%TF.FileFunction,Profile,NP*%') }
		]);
		expect(result.holes).toHaveLength(3);
		expect(result.tools.map((tool) => [tool.diameter, tool.role, tool.plated])).toEqual([
			[1, 'component', true],
			[0.3, 'via', true],
			[1.6, 'component', true]
		]);
		const slot = result.holes.find((hole) => hole.slot);
		expect(slot).toMatchObject({ x: 30, y: 10, diameter: 1.6, slot: { x: 34, y: 10 } });
		expect(defaultToolKeys(result.tools)).toHaveLength(2);
	});

	it('reads non-plated Gerber drill layers as non-plated', () => {
		const text = gerber(
			'%TF.FileFunction,NonPlated,1,2,NPTH*%',
			'%ADD10C,3.2*%',
			'D10*',
			'X1000000Y1000000D03*'
		);
		const result = readFabPackage([{ name: 'npth.gbr', text }]);
		expect(result.tools[0]).toMatchObject({ plated: false, diameter: 3.2 });
	});

	it('falls back to the component pads of the copper layer when there is no drill file', () => {
		const copper = gerber(
			'%TF.FileFunction,Copper,L1,Top*%',
			'%TA.AperFunction,ComponentPad*%',
			'%ADD10C,1.8*%',
			'%TA.AperFunction,SMDPad,CuDef*%',
			'%ADD11R,1X1*%',
			'D10*',
			'X5000000Y5000000D03*',
			'X7540000Y5000000D03*',
			'D11*',
			'X1000000Y1000000D03*'
		);
		const result = readFabPackage([{ name: 'F_Cu.gbr', text: copper }]);
		expect(result.holes.map((hole) => [hole.x, hole.y])).toEqual([
			[5, 5],
			[7.54, 5]
		]);
		expect(result.tools[0]).toMatchObject({ role: 'pad', diameter: 1.8 });
		expect(result.warnings.join(',')).toContain('component pads');
	});

	it('guesses the coordinate layout of an undeclared Excellon file from the board outline', () => {
		// 100 x 80 mm board, holes written as 3.3 trailing-zero-suppressed numbers without any declaration
		const outline = gerber(
			'%ADD10C,0.1*%',
			'D10*',
			'G01*',
			'X0Y0D02*',
			'X100000000Y0D01*',
			'X100000000Y80000000D01*',
			'X0Y80000000D01*',
			'X0Y0D01*'
		);
		const drill = ['M48', 'T1C0.8', '%', 'T1', 'X5000Y7000', 'X90500Y40250', 'M30'].join('\n');
		const result = readFabPackage([
			{ name: 'Edge.gbr', text: outline },
			{ name: 'a.drl', text: drill }
		]);
		const plan = planElements(result.holes, result.outline, {
			toolKeys: result.tools.map((tool) => tool.key),
			groupDistance: 0,
			minMargin: 0.3,
			circleDepth: 5,
			rectangleDepth: 5
		});
		expect(plan.warnings.join(',')).not.toContain('outside');
		expect(
			result.holes.every((hole) => hole.x >= 0 && hole.x <= 100 && hole.y >= 0 && hole.y <= 80)
		).toBe(true);
	});

	it('warns instead of failing when nothing useful is in the package', () => {
		const result = readFabPackage([{ name: 'readme.txt', text: 'hello' }]);
		expect(result.warnings.join(',')).toContain('No drill file');
		expect(result.warnings.join(',')).toContain('No board outline');
		expect(result.holes).toEqual([]);
	});

	it('survives garbage in every file type', () => {
		const junk = '\u0000%%**M48\n;;;X1Y1G85G85 T0C\n%FSLAX99Y99*%\n';
		expect(() =>
			readFabPackage(
				['a.drl', 'b.gbr', 'F_Cu.gbr', 'Edge_Cuts.gbr', 'c.GTL'].map((name) => ({
					name,
					text: junk
				}))
			)
		).not.toThrow();
	});
});
