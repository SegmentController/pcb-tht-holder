import { describe, expect, it } from 'vitest';

import { CircleData } from '$types/CircleData';
import { LegData } from '$types/LegData';
import { RectangleData } from '$types/RectangleData';

import { isLegOverlappingCircle, isLegOverlappingRectangle } from './legOverlap';

// Leg occupies x 10..14, y 10..14 (top-left positioned)
const leg = LegData.parse({ id: 'leg', x: 10, y: 10, width: 4, height: 4 });
const circle = (x: number, y: number, radius: number) =>
	CircleData.parse({ id: 'c', x, y, radius, depth: 5 });
const rectangle = (x: number, y: number, width: number, height: number, rotation = 0) =>
	RectangleData.parse({ id: 'r', x, y, width, height, depth: 5, rotation });

describe('isLegOverlappingCircle', () => {
	it('detects a circle centered inside the leg', () => {
		expect(isLegOverlappingCircle(leg, circle(12, 12, 1))).toBe(true);
	});

	it('detects a circle overlapping an edge', () => {
		expect(isLegOverlappingCircle(leg, circle(15, 12, 1.5))).toBe(true);
	});

	it('does not count a circle tangent to an edge', () => {
		expect(isLegOverlappingCircle(leg, circle(15, 12, 1))).toBe(false);
	});

	it('uses the corner distance, not the bounding box', () => {
		// corner (14,14) to center (15,15) is ~1.414
		expect(isLegOverlappingCircle(leg, circle(15, 15, 1.2))).toBe(false);
		expect(isLegOverlappingCircle(leg, circle(15, 15, 1.5))).toBe(true);
	});

	it('ignores distant circles', () => {
		expect(isLegOverlappingCircle(leg, circle(50, 50, 3))).toBe(false);
	});
});

describe('isLegOverlappingRectangle', () => {
	describe('non-rotated', () => {
		it('detects overlap', () => {
			expect(isLegOverlappingRectangle(leg, rectangle(13, 13, 4, 4))).toBe(true);
		});

		it('detects a rectangle containing the leg', () => {
			expect(isLegOverlappingRectangle(leg, rectangle(12, 12, 20, 20))).toBe(true);
		});

		it('counts touching edges as overlap', () => {
			expect(isLegOverlappingRectangle(leg, rectangle(16, 12, 4, 4))).toBe(true);
		});

		it('rejects separated rectangles', () => {
			expect(isLegOverlappingRectangle(leg, rectangle(20, 12, 4, 4))).toBe(false);
			expect(isLegOverlappingRectangle(leg, rectangle(12, 20, 4, 4))).toBe(false);
		});
	});

	describe('rotated', () => {
		it('detects a 45 degree rectangle overlapping a leg corner', () => {
			expect(isLegOverlappingRectangle(leg, rectangle(15, 15, 4, 4, 45))).toBe(true);
		});

		it('detects a leg corner inside the rotated rectangle', () => {
			expect(isLegOverlappingRectangle(leg, rectangle(12, 12, 20, 20, 30))).toBe(true);
		});

		it('detects a thin bar crossing the leg with no corner inside either shape', () => {
			// 30 x 0.5 bar through the leg center at 30deg: all four of its corners are far outside
			// the leg and all four leg corners are outside the bar
			expect(isLegOverlappingRectangle(leg, rectangle(12, 12, 30, 0.5, 30))).toBe(true);
		});

		it('rejects a rotated rectangle whose AABB overlaps but whose body does not', () => {
			// A long 45deg bar runs diagonally past the leg: its AABB covers the leg, the bar itself does not
			expect(isLegOverlappingRectangle(leg, rectangle(20, 8, 20, 1, 45))).toBe(false);
		});

		it('rejects distant rotated rectangles', () => {
			expect(isLegOverlappingRectangle(leg, rectangle(50, 50, 4, 4, 33))).toBe(false);
		});

		it('agrees with the non-rotated test for a 90 degree rotation', () => {
			const tall = rectangle(15.5, 12, 3, 8, 90); // becomes 8 wide, 3 tall around (15.5,12)
			expect(isLegOverlappingRectangle(leg, tall)).toBe(true);
			expect(isLegOverlappingRectangle(leg, rectangle(30, 12, 3, 8, 90))).toBe(false);
		});
	});
});
