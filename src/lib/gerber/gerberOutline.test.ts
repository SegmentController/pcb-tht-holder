import { describe, expect, it } from 'vitest';

import { edgeCuts } from './fixtures';
import { hasProfileAttribute, looksLikeOutlineName, parseOutline } from './gerberOutline';

describe('parseOutline', () => {
	it('reads the rounded rectangle of the sample board', () => {
		const outline = parseOutline(edgeCuts)!;
		expect(outline.contours).toHaveLength(1);
		expect(outline.bbox).toEqual({ minX: -11.8, minY: -8.1, maxX: 11.8, maxY: 8.1 });
	});

	it('flattens arcs including the quadrant extremes', () => {
		// Half circle of radius 5 around (0, 0), counter-clockwise from (5, 0) to (-5, 0)
		const text = [
			'%FSLAX24Y24*%',
			'%MOMM*%',
			'G75*',
			'G01*',
			'X50000Y0D02*',
			'G03*',
			'X-50000Y0I-50000J0D01*',
			'M02*'
		].join('\n');
		const outline = parseOutline(text)!;
		expect(outline.bbox.minX).toBeCloseTo(-5, 3);
		expect(outline.bbox.maxX).toBeCloseTo(5, 3);
		expect(outline.bbox.maxY).toBeCloseTo(5, 3);
		expect(outline.bbox.minY).toBeCloseTo(0, 3);
	});

	it('goes clockwise for G02 and converts inches', () => {
		const text = [
			'%FSLAX24Y24*%',
			'%MOIN*%',
			'G75*',
			'X10000Y0D02*',
			'G02*',
			'X-10000Y0I-10000J0D01*',
			'M02*'
		].join('\n');
		const { bbox } = parseOutline(text)!;
		// Radius 1 in = 25.4 mm, clockwise from (1, 0) through (0, -1)
		expect(bbox.minY).toBeCloseTo(-25.4, 2);
		expect(bbox.maxY).toBeCloseTo(0, 3);
		expect(bbox.maxX).toBeCloseTo(25.4, 2);
	});

	it('supports trailing zero omission', () => {
		const text = ['%FSTAX24Y24*%', '%MOMM*%', 'X10D02*', 'X1000Y2D01*', 'M02*'].join('\n');
		// 2.4 format = 6 digits, padded on the right: X10 and X1000 are both 100000 = 10.0000 mm
		const { bbox } = parseOutline(text)!;
		expect(bbox.minX).toBeCloseTo(10, 4);
		expect(bbox.maxX).toBeCloseTo(10, 4);
		expect(bbox.maxY).toBeGreaterThan(0);
	});

	it('returns undefined without geometry', () => {
		expect(parseOutline('')).toBeUndefined();
		expect(parseOutline('%FSLAX46Y46*%\n%MOMM*%\nM02*')).toBeUndefined();
	});

	it('recognises outline layers', () => {
		expect(hasProfileAttribute(edgeCuts)).toBe(true);
		expect(looksLikeOutlineName('board-Edge_Cuts.gbr')).toBe(true);
		expect(looksLikeOutlineName('board.gko')).toBe(true);
		expect(looksLikeOutlineName('F_Cu.gbr')).toBe(false);
	});
});
