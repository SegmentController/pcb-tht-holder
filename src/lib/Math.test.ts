import { describe, expect, it } from 'vitest';

import { MathMax, MathMinMax } from './Math';

describe('MathMax', () => {
	it('returns 0 for an empty array', () => {
		expect(MathMax([])).toBe(0);
	});

	it('returns the largest value', () => {
		expect(MathMax([3, 9, -2, 7])).toBe(9);
	});

	it('handles all-negative values without defaulting to 0', () => {
		expect(MathMax([-5, -3, -10])).toBe(-3);
	});

	it('works on typed arrays', () => {
		expect(MathMax(new Float32Array([1.5, 4.25, 2]))).toBe(4.25);
	});

	it('handles arrays too large for spread arguments', () => {
		const values = new Float32Array(1_000_000);
		values[999_999] = 42;
		expect(MathMax(values)).toBe(42);
	});
});

describe('MathMinMax', () => {
	it('keeps values inside the range', () => {
		expect(MathMinMax(5, 0, 10)).toBe(5);
	});

	it('clamps to the lower bound', () => {
		expect(MathMinMax(-3, 0, 10)).toBe(0);
	});

	it('clamps to the upper bound', () => {
		expect(MathMinMax(15, 0, 10)).toBe(10);
	});

	it('returns min when the range is inverted', () => {
		expect(MathMinMax(5, 10, 0)).toBe(10);
	});
});
