import { describe, expect, it } from 'vitest';

import { CircleData } from './CircleData';
import { LegData } from './LegData';
import { RectangleData } from './RectangleData';
import { isCircle, isLeg, isRectangle } from './typeGuards';

const circle = CircleData.parse({ id: 'c', x: 1, y: 2, radius: 3, depth: 4 });
const rectangle = RectangleData.parse({ id: 'r', x: 1, y: 2, width: 3, height: 4, depth: 5 });
const leg = LegData.parse({ id: 'l', x: 1, y: 2, width: 3, height: 4 });

describe('type guards', () => {
	it('recognizes circles only', () => {
		expect(isCircle(circle)).toBe(true);
		expect(isCircle(rectangle)).toBe(false);
		expect(isCircle(leg)).toBe(false);
	});

	it('recognizes rectangles only', () => {
		expect(isRectangle(rectangle)).toBe(true);
		expect(isRectangle(circle)).toBe(false);
		expect(isRectangle(leg)).toBe(false);
	});

	it('recognizes legs only', () => {
		expect(isLeg(leg)).toBe(true);
		expect(isLeg(rectangle)).toBe(false);
		expect(isLeg(circle)).toBe(false);
	});

	it('classifies every element as exactly one type', () => {
		for (const element of [circle, rectangle, leg])
			expect(
				[isCircle(element), isRectangle(element), isLeg(element)].filter(Boolean)
			).toHaveLength(1);
	});
});
