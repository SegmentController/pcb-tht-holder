import { describe, expect, it } from 'vitest';

import { rotatedHalfExtents } from './geometry';

describe('rotatedHalfExtents', () => {
	it('returns plain half sizes without rotation', () => {
		expect(rotatedHalfExtents(10, 4, 0)).toEqual({ x: 5, y: 2 });
	});

	it('swaps the extents for a quarter turn', () => {
		const { x, y } = rotatedHalfExtents(10, 4, 90);
		expect(x).toBeCloseTo(2);
		expect(y).toBeCloseTo(5);
	});

	it('grows both extents for a 45 degree turn', () => {
		const { x, y } = rotatedHalfExtents(10, 4, 45);
		expect(x).toBeCloseTo((5 + 2) * Math.SQRT1_2);
		expect(y).toBeCloseTo((5 + 2) * Math.SQRT1_2);
	});

	it('is symmetric for opposite rotation directions', () => {
		const left = rotatedHalfExtents(10, 4, 30);
		const right = rotatedHalfExtents(10, 4, -30);
		expect(left.x).toBeCloseTo(right.x);
		expect(left.y).toBeCloseTo(right.y);
	});
});
