import { describe, expect, it } from 'vitest';

import { isExcellon, parseExcellon } from './excellon';
import { drillNpth, drillPth } from './fixtures';

const file = (...lines: string[]) => lines.join('\n');

describe('parseExcellon: sample files', () => {
	it('reads tools, roles and holes of a plated drill file', () => {
		const { holes, tools, warnings, formatDeclared } = parseExcellon(drillPth, 'drill-L1-L2.drl');
		expect(warnings).toEqual([]);
		expect(formatDeclared).toBe(false);
		expect(holes).toHaveLength(11);
		expect(
			tools.map((tool) => [tool.id, tool.diameter, tool.count, tool.plated, tool.role])
		).toEqual([
			['T10', 1, 2, true, 'component'],
			['T11', 0.3, 9, true, 'component']
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
		expect(isExcellon('﻿M48\nMETRIC')).toBe(true);
	});
});

describe('parseExcellon: number formats', () => {
	it('converts inch files and applies the leading zero default (trailing zeros suppressed)', () => {
		const text = file('M48', 'INCH,LZ', 'T1C0.0394', '%', 'T1', 'X01Y-02', 'M30');
		const { holes, tools } = parseExcellon(text, 'a.drl');
		// 2.4 format: 01 -> 010000 = 1.0000 in, -02 -> -2.0000 in
		expect(holes).toMatchObject([{ x: 25.4, y: -50.8 }]);
		expect(tools[0].diameter).toBeCloseTo(1, 2);
	});

	it('applies trailing zero suppression (TZ keeps trailing zeros, drops leading)', () => {
		const text = file('M48', 'METRIC,TZ,000.000', 'T1C0.8', '%', 'T1', 'X5000Y12500', 'M30');
		const { holes, formatDeclared } = parseExcellon(text, 'a.drl');
		// 6 digits, padded on the left: 005000 -> 5.000, 012500 -> 12.500
		expect(holes).toMatchObject([{ x: 5, y: 12.5 }]);
		expect(formatDeclared).toBe(true);
	});

	it('reads the FILE_FORMAT and FORMAT comments and tool feeds', () => {
		const text = file(
			'M48',
			';FILE_FORMAT=4:4',
			'METRIC',
			'T01F00S00C0.8',
			'%',
			'T01',
			'X012345Y-054321',
			'M30'
		);
		const { holes, tools } = parseExcellon(text, 'a.drl');
		// 4.4: 012345 padded right to 8 digits = 1234.5000 / no, leading zeros kept -> 01234500
		expect(tools[0].diameter).toBe(0.8);
		expect(holes[0].x).toBeCloseTo(123.45, 2);
		expect(holes[0].y).toBeCloseTo(-543.21, 2);
	});

	it('keeps X and Y modal and supports G90/G91 and ICI', () => {
		const modal = file('M48', 'METRIC', 'T1C0.8', '%', 'T1', 'X1.0Y2.0', 'X3.0', 'Y4.0', 'M30');
		expect(parseExcellon(modal, 'a.drl').holes.map(({ x, y }) => [x, y])).toEqual([
			[1, 2],
			[3, 2],
			[3, 4]
		]);
		const relative = file(
			'M48',
			'METRIC',
			'T1C0.8',
			'%',
			'G91',
			'T1',
			'X1.0Y1.0',
			'X2.0Y0.5',
			'M30'
		);
		expect(parseExcellon(relative, 'a.drl').holes.map(({ x, y }) => [x, y])).toEqual([
			[1, 1],
			[3, 1.5]
		]);
	});

	it('guesses the unit from the tool sizes when it is not declared', () => {
		const inch = file('M48', 'T1C0.032', '%', 'T1', 'X1.0Y2.0', 'M30');
		const result = parseExcellon(inch, 'a.drl');
		expect(result.unitDeclared).toBe(false);
		expect(result.holes[0]).toMatchObject({ x: 25.4, y: 50.8 });
		const metric = file('M48', 'T1C0.8', 'T2C1.2', '%', 'T1', 'X1.0Y2.0', 'M30');
		expect(parseExcellon(metric, 'a.drl').holes[0]).toMatchObject({ x: 1, y: 2 });
	});

	it('reads files with CR only or CRLF line ends and a byte order mark', () => {
		const text = `${String.fromCodePoint(65_279)}${['M48', 'METRIC', 'T1C0.8', '%', 'T1', 'X1.0Y2.0', 'X3.0Y4.0', 'M30'].join('\r')}`;
		expect(parseExcellon(text, 'a.drl').holes).toHaveLength(2);
		expect(parseExcellon(text.replaceAll('\r', '\r\n'), 'a.drl').holes).toHaveLength(2);
	});
});

describe('parseExcellon: tool attributes and plating', () => {
	it('uses via drill and non-plated aperture functions per tool', () => {
		const text = file(
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
		);
		const { tools } = parseExcellon(text, 'mixed.drl');
		expect(tools).toMatchObject([
			{ id: 'T1', role: 'via', plated: true },
			{ id: 'T2', role: 'mechanical', plated: false }
		]);
	});

	it('flags blind and buried files and reads the XNC style tool attributes', () => {
		const text = file(
			'M48',
			'; #@! TF.FileFunction,Plated,1,2,Blind',
			'METRIC',
			'; #@! TA.AperFunction,ViaDrill',
			'T01C0.300',
			'%',
			'G05',
			'T01',
			'X008.150Y012.050',
			'M30'
		);
		const { tools } = parseExcellon(text, 'blind.drl');
		expect(tools[0]).toMatchObject({ plated: true, role: 'blind' });
	});

	it('takes non-plated from the file name when the file says nothing', () => {
		const text = file('M48', 'METRIC', 'T1C3.2', '%', 'T1', 'X1.0Y1.0', 'M30');
		expect(parseExcellon(text, 'board-NPTH.drl').tools[0].plated).toBe(false);
		expect(parseExcellon(text, 'Drill_NPTH_Through.DRL').tools[0].plated).toBe(false);
		expect(parseExcellon(text, 'board-PTH.drl').tools[0].plated).toBe(true);
	});
});

describe('parseExcellon: slots, repeats and bad input', () => {
	it('reads G85 slots', () => {
		const text = file(
			'M48',
			'METRIC',
			'T1C1.0',
			'%',
			'T1',
			'X1.0Y1.0G85X4.0Y1.0',
			'X9.0Y9.0',
			'M30'
		);
		const { holes, warnings } = parseExcellon(text, 'a.drl');
		expect(warnings).toEqual([]);
		expect(holes).toMatchObject([
			{ x: 1, y: 1, diameter: 1, slot: { x: 4, y: 1 } },
			{ x: 9, y: 9 }
		]);
		expect(holes[1].slot).toBeUndefined();
	});

	it('reads routed slots (G00, M15, G01, M16) of the XNC specification', () => {
		const text = file(
			'M48',
			'METRIC',
			'T01C0.6',
			'T03C0.8',
			'%',
			'G05',
			'T01',
			'X9.01Y3.3375',
			'T03',
			'G00X8.01Y3.825',
			'M15',
			'G01X6.54Y3.825',
			'M16',
			'G05',
			'T03',
			'X8.0Y8.0',
			'M30'
		);
		const { holes } = parseExcellon(text, 'a.drl');
		expect(holes).toHaveLength(3);
		expect(holes[1]).toMatchObject({
			x: 8.01,
			y: 3.825,
			diameter: 0.8,
			slot: { x: 6.54, y: 3.825 }
		});
		expect(holes[2]).toMatchObject({ x: 8, y: 8 });
		expect(holes[2].slot).toBeUndefined();
	});

	it('approximates arc routs by a chord and says so', () => {
		const text = file(
			'M48',
			'METRIC',
			'T1C0.8',
			'%',
			'T1',
			'G00X5.05Y2.6',
			'M15',
			'G03X6.0Y1.6A1.0',
			'M16',
			'M30'
		);
		const { holes, warnings } = parseExcellon(text, 'a.drl');
		expect(holes).toHaveLength(1);
		expect(warnings.join(',')).toContain('arc');
	});

	it('expands repeats and skips holes of undefined tools with a warning', () => {
		const text = file(
			'M48',
			'METRIC',
			'T1C0.8',
			'%',
			'T1',
			'X1.0Y1.0',
			'R3X2.0Y0',
			'T9',
			'X0Y0',
			'M30'
		);
		const { holes, warnings } = parseExcellon(text, 'a.drl');
		expect(holes.map((hole) => hole.x)).toEqual([1, 3, 5, 7]);
		expect(warnings.join(',')).toContain('undefined tool');
	});

	it('never throws on garbage and stops at M30', () => {
		expect(() => parseExcellon('\u0000\u0001 garbage ;;; X Y T', 'x.drl')).not.toThrow();
		expect(parseExcellon('', 'x.drl').holes).toEqual([]);
		const text = file('M48', 'METRIC', 'T1C0.8', '%', 'T1', 'X1.0Y1.0', 'M30', 'X5.0Y5.0');
		expect(parseExcellon(text, 'a.drl').holes).toHaveLength(1);
	});
});
