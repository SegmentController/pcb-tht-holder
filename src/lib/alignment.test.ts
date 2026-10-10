import { describe, expect, it } from 'vitest';

import { CircleData } from '$types/CircleData';
import { LegData } from '$types/LegData';
import { RectangleData } from '$types/RectangleData';

import { calculateSnapPosition, detectAlignments } from './alignment';

const circle = (id: string, x: number, y: number, radius = 2) =>
	CircleData.parse({ id, x, y, radius, depth: 5 });
const rectangle = (id: string, x: number, y: number, width = 10, height = 4, rotation = 0) =>
	RectangleData.parse({ id, x, y, width, height, depth: 5, rotation });
const leg = (id: string, x: number, y: number, width = 2, height = 2) =>
	LegData.parse({ id, x, y, width, height });

const verticalXs = (lines: ReturnType<typeof detectAlignments>) =>
	lines.filter((line) => line.x1 === line.x2).map((line) => line.x1);
const horizontalYs = (lines: ReturnType<typeof detectAlignments>) =>
	lines.filter((line) => line.y1 === line.y2).map((line) => line.y1);

describe('detectAlignments', () => {
	it('returns nothing when no elements are close', () => {
		expect(detectAlignments(circle('a', 10, 10), [circle('b', 50, 50)], 100, 100)).toEqual([]);
	});

	it('finds left, center and right lines for vertically stacked circles', () => {
		const lines = detectAlignments(circle('a', 10, 10), [circle('b', 10, 30)], 100, 100);
		expect(verticalXs(lines).toSorted((a, b) => a - b)).toEqual([8, 10, 12]);
		expect(horizontalYs(lines)).toEqual([]);
	});

	it('spans the line from the topmost to the bottommost element edge', () => {
		const lines = detectAlignments(circle('a', 10, 10), [circle('b', 10, 30)], 100, 100);
		const center = lines.find((line) => line.x1 === 10)!;
		expect([center.y1, center.y2]).toEqual([8, 32]);
	});

	it('skips the dragged element itself by id', () => {
		const dragged = circle('a', 10, 10);
		expect(detectAlignments(dragged, [dragged], 100, 100)).toEqual([]);
	});

	it('aligns within the threshold but not beyond it', () => {
		expect(
			verticalXs(detectAlignments(circle('a', 10, 10), [circle('b', 10.05, 40)], 100, 100))
		).not.toHaveLength(0);
		expect(
			verticalXs(detectAlignments(circle('a', 10, 10), [circle('b', 10.15, 40)], 100, 100))
		).toHaveLength(0);
	});

	it('deduplicates lines produced by several elements at the same position', () => {
		const lines = detectAlignments(
			circle('a', 10, 10),
			[circle('b', 10, 30), circle('c', 10, 50)],
			100,
			100
		);
		expect(verticalXs(lines)).toHaveLength(3);
	});

	it('clamps line ends to the panel', () => {
		const lines = detectAlignments(circle('a', 10, 1), [circle('b', 10, 9)], 100, 10);
		const center = lines.find((line) => line.x1 === 10)!;
		expect([center.y1, center.y2]).toEqual([0, 10]);
	});

	it('aligns rectangle edges with circle edges', () => {
		// rectangle spans x 45..55, circle spans x 45..49
		const lines = detectAlignments(rectangle('r', 50, 50), [circle('c', 47, 20)], 100, 100);
		expect(verticalXs(lines)).toContain(45);
	});

	it('uses the axis-aligned bounds of rotated rectangles', () => {
		// 10x4 rotated by 90deg covers x 48..52, y 45..55
		const lines = detectAlignments(
			rectangle('r', 50, 50, 10, 4, 90),
			[circle('c', 50, 20)], // x edges 48..52
			100,
			100
		);
		const xs = verticalXs(lines);
		expect(xs.some((x) => Math.abs(x - 48) < 1e-6)).toBe(true);
		expect(xs.some((x) => Math.abs(x - 52) < 1e-6)).toBe(true);
	});

	it('treats legs as top-left positioned with a derived center', () => {
		// leg spans x 10..14, center x 12
		const lines = detectAlignments(leg('l', 10, 10, 4, 4), [circle('c', 12, 40, 1)], 100, 100);
		expect(verticalXs(lines)).toEqual([12]);
	});

	it('aligns horizontal edges and centers', () => {
		const lines = detectAlignments(circle('a', 10, 20), [circle('b', 50, 20)], 100, 100);
		expect(horizontalYs(lines).toSorted((a, b) => a - b)).toEqual([18, 20, 22]);
	});
});

describe('calculateSnapPosition', () => {
	it('returns the original position when nothing is in range', () => {
		const dragged = circle('a', 10.5, 10.5);
		expect(calculateSnapPosition(dragged, [circle('b', 10, 30)])).toEqual({ x: 10.5, y: 10.5 });
	});

	it('snaps x to a nearby alignment while leaving y alone', () => {
		const result = calculateSnapPosition(circle('a', 10.15, 10.5), [circle('b', 10, 30)]);
		expect(result.x).toBeCloseTo(10);
		expect(result.y).toBe(10.5);
	});

	it('snaps x and y independently', () => {
		const result = calculateSnapPosition(circle('a', 10.15, 30.1), [circle('b', 10, 30)]);
		expect(result.x).toBeCloseTo(10);
		expect(result.y).toBeCloseTo(30);
	});

	it('picks the closest candidate regardless of order', () => {
		const result = calculateSnapPosition(circle('a', 10.15, 10.5), [
			circle('far', 10.3, 40),
			circle('near', 10.1, 60)
		]);
		expect(result.x).toBeCloseTo(10.1);
	});

	it('ignores the dragged element itself', () => {
		const dragged = circle('a', 10.15, 10.5);
		expect(calculateSnapPosition(dragged, [dragged])).toEqual({ x: 10.15, y: 10.5 });
	});

	it('snaps legs by their top-left position', () => {
		const result = calculateSnapPosition(leg('a', 10.1, 0), [leg('b', 10, 20)]);
		expect(result.x).toBeCloseTo(10);
	});

	it('snaps a circle edge to a rectangle edge by moving the circle center', () => {
		// circle left edge 7.9 vs rectangle left edge 8 -> move center by +0.1
		const result = calculateSnapPosition(circle('a', 9.9, 30), [rectangle('r', 13, 10, 10, 4)]);
		expect(result.x).toBeCloseTo(10);
	});
});
