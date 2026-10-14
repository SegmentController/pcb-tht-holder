import { describe, expect, it } from 'vitest';

import { isExcellon, parseExcellon } from './excellon';
import { drillNpth, drillPth } from './fixtures';

describe('parseExcellon', () => {
	it('reads tools and holes of a plated drill file', () => {
		const { holes, tools, warnings } = parseExcellon(drillPth, 'drill-L1-L2.drl');
		expect(warnings).toEqual([]);
		expect(holes).toHaveLength(11);
		expect(tools.map((tool) => [tool.id, tool.diameter, tool.count, tool.plated])).toEqual([
			['T10', 1, 2, true],
			['T11', 0.3, 9, true]
		]);
		expect(holes[0]).toMatchObject({ x: -6.35, y: -1.27, diameter: 1 });
		expect(holes[1]).toMatchObject({ x: -6.35, y: 1.27, diameter: 1 });
		expect(holes.at(-1)).toMatchObject({ x: 2.99, y: -3.81, diameter: 0.3 });
	});

	it('marks non-plated tools from the file function attribute', () => {
		const { holes, tools } = parseExcellon(drillNpth, 'drill_npth.drl');
		expect(holes).toHaveLength(2);
		expect(tools).toMatchObject([{ id: 'T10', diameter: 3.2, plated: false, count: 2 }]);
	});

	it('detects Excellon by its header', () => {
		expect(isExcellon(drillPth)).toBe(true);
		expect(isExcellon('%FSLAX46Y46*%\nG01*\n')).toBe(false);
		expect(isExcellon('')).toBe(false);
	});

	it('converts inch files and applies leading zero suppression defaults', () => {
		const text = ['M48', 'INCH,LZ', 'T1C0.0394', '%', 'T1', 'X01Y-02', 'M30'].join('\n');
		const { holes, tools } = parseExcellon(text, 'a.drl');
		// 2.4 format, trailing zeros omitted: 01 -> 010000 = 1.0000 in, -02 -> -2.0000 in
		expect(holes).toMatchObject([{ x: 25.4, y: -50.8 }]);
		expect(tools[0].diameter).toBeCloseTo(1, 2);
	});

	it('applies trailing zero suppression (TZ keeps trailing zeros, drops leading)', () => {
		const text = ['M48', 'METRIC,TZ,000.000', 'T1C0.8', '%', 'T1', 'X5000Y12500', 'M30'].join('\n');
		const { holes } = parseExcellon(text, 'a.drl');
		// 6 digits, padded on the left: 005000 -> 5.000, 012500 -> 12.500
		expect(holes).toMatchObject([{ x: 5, y: 12.5 }]);
	});

	it('keeps X and Y modal', () => {
		const text = ['M48', 'METRIC', 'T1C0.8', '%', 'T1', 'X1.0Y2.0', 'X3.0', 'Y4.0', 'M30'].join(
			'\n'
		);
		const { holes } = parseExcellon(text, 'a.drl');
		expect(holes.map(({ x, y }) => [x, y])).toEqual([
			[1, 2],
			[3, 2],
			[3, 4]
		]);
	});

	it('uses via drill and non-plated aperture functions per tool', () => {
		const text = [
			'M48',
			'METRIC',
			'; #@! TA.AperFunction,Plated,PTH,ViaDrill',
			'T1C0.3',
			'; #@! TA.AperFunction,NonPlated,NPTH,MechanicalDrill',
			'T2C3.0',
			'%',
			'T1',
			'X1.0Y1.0',
			'T2',
			'X5.0Y5.0',
			'M30'
		].join('\n');
		const { tools } = parseExcellon(text, 'mixed.drl');
		expect(tools).toMatchObject([
			{ id: 'T1', via: true, plated: true },
			{ id: 'T2', via: false, plated: false }
		]);
	});

	it('skips slots with a warning and does not throw on garbage', () => {
		const slot = ['M48', 'METRIC', 'T1C1.0', '%', 'T1', 'X1.0Y1.0G85X4.0Y1.0', 'X9.0Y9.0'].join(
			'\n'
		);
		const result = parseExcellon(slot, 'a.drl');
		expect(result.holes).toHaveLength(1);
		expect(result.warnings.join(',')).toContain('slot');

		expect(() => parseExcellon('\u0000\u0001 garbage ;;; X Y T', 'x.drl')).not.toThrow();
		expect(parseExcellon('', 'x.drl').holes).toEqual([]);
	});
});
