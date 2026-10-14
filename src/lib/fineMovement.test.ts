import { get } from 'svelte/store';
import type { KonvaMouseEvent } from 'svelte-konva';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { circleOf, legOf, rectangleOf, resetProject } from '$lib/elements/elementTestUtilities';
import { getProjectStoreValue } from '$stores/projectStore';
import { clearUndoStack, executeLastUndo, undoStoreLastItem } from '$stores/undoStore';
import type { GenericElement } from '$types/typeGuards';

import {
	deselectElementByMouseLeave,
	finemoveSelectedElement,
	flipSelectedRectangleDimensions,
	getSelectedElementInfo,
	pruneSelectedElements,
	resetSelectedRectangleRotation,
	rotateSelectedRectangleDegrees,
	selectElementByMouseEnter
} from './fineMovement';

vi.mock('$stores/modalStore', () => ({
	showModalCircleSettings: vi.fn(),
	showModalConfirm: vi.fn(),
	showModalNameEdit: vi.fn(),
	showModalRectangleSettings: vi.fn()
}));

const stage = () => {
	const container = { style: { cursor: '' } };
	const event = {
		target: { getStage: () => ({ container: () => container }) }
	} as unknown as KonvaMouseEvent;
	return { container, event };
};

describe('fineMovement', () => {
	let { container, event } = stage();
	const select = (element: GenericElement, measure = false) =>
		selectElementByMouseEnter(event, element, measure);
	const circle = () => getProjectStoreValue().circles[0];
	const rectangle = () => getProjectStoreValue().rectangles[0];
	const leg = () => getProjectStoreValue().legs[0];

	beforeEach(() => {
		vi.useFakeTimers();
		resetProject({
			circles: [circleOf('c', 2, 5)],
			rectangles: [rectangleOf('r', 8, 4, 30)],
			legs: [legOf('l')]
		});
		({ container, event } = stage());
	});

	afterEach(() => {
		pruneSelectedElements([]);
		clearUndoStack();
		vi.useRealTimers();
	});

	describe('selection', () => {
		it('describes nothing without a selection', () => {
			expect(getSelectedElementInfo()).toBeUndefined();
		});

		it('describes the hovered element', () => {
			select(circle());
			expect(getSelectedElementInfo()).toBe('Circle 2x5mm');

			deselectElementByMouseLeave(event, circle(), false);
			select(rectangle());
			expect(getSelectedElementInfo()).toBe('Rectangle 8x4x5mm 30°');

			deselectElementByMouseLeave(event, rectangle(), false);
			select(leg());
			expect(getSelectedElementInfo()).toBe('Leg');
		});

		it('is ambiguous while the pointer overlaps two elements', () => {
			select(circle());
			select(rectangle());

			expect(getSelectedElementInfo()).toBeUndefined();

			deselectElementByMouseLeave(event, rectangle(), false);
			expect(getSelectedElementInfo()).toBe('Circle 2x5mm');
		});

		it('forgets elements that were deleted without a mouse leave', () => {
			select(circle());

			pruneSelectedElements([rectangle(), leg()]);

			expect(getSelectedElementInfo()).toBeUndefined();
		});

		it('keeps elements that still exist when pruning', () => {
			select(circle());

			pruneSelectedElements([circle()]);

			expect(getSelectedElementInfo()).toBe('Circle 2x5mm');
		});
	});

	describe('cursor', () => {
		it('turns into a pointer over an element and back to default', () => {
			select(circle());
			expect(container.style.cursor).toBe('pointer');

			deselectElementByMouseLeave(event, circle(), false);
			expect(container.style.cursor).toBe('default');
		});

		it('stays a crosshair in measure mode', () => {
			select(circle(), true);
			expect(container.style.cursor).toBe('crosshair');

			deselectElementByMouseLeave(event, circle(), true);
			expect(container.style.cursor).toBe('crosshair');
		});

		it('survives an event without a stage', () => {
			const detached = { target: { getStage: () => null } } as unknown as KonvaMouseEvent;

			expect(() => selectElementByMouseEnter(detached, circle(), false)).not.toThrow();
			expect(() => deselectElementByMouseLeave(detached, circle(), false)).not.toThrow();
		});
	});

	describe('finemoveSelectedElement', () => {
		it.each([
			['left', 1, [9.9, 10]],
			['right', 1, [10.1, 10]],
			['up', 1, [10, 9.9]],
			['down', 1, [10, 10.1]],
			['right', 5, [10.5, 10]],
			['up', 5, [10, 9.5]]
		] as const)('nudges %s with multiplier %d', (direction, multiplier, expected) => {
			select(circle());

			finemoveSelectedElement(direction, multiplier);

			expect(circle().x).toBeCloseTo(expected[0], 10);
			expect(circle().y).toBeCloseTo(expected[1], 10);
		});

		it('moves rectangles and legs through their own operations', () => {
			select(rectangle());
			finemoveSelectedElement('right');
			expect(get(undoStoreLastItem)).toBe('Move rectangle');
			deselectElementByMouseLeave(event, rectangle(), false);

			select(leg());
			finemoveSelectedElement('down');
			expect(get(undoStoreLastItem)).toBe('Move leg');

			expect(rectangle().x).toBeCloseTo(10.1, 10);
			expect(leg().y).toBeCloseTo(3.1, 10);
		});

		it('merges a burst of nudges into one undo step', () => {
			select(circle());

			for (let step = 0; step < 5; step++) finemoveSelectedElement('right');
			expect(circle().x).toBeCloseTo(10.5, 10);

			executeLastUndo();
			expect(circle().x).toBe(10);
			expect(get(undoStoreLastItem)).toBeUndefined();
		});

		it('does nothing without exactly one hovered element', () => {
			finemoveSelectedElement('right');
			select(circle());
			select(rectangle());
			finemoveSelectedElement('right');

			expect(circle().x).toBe(10);
			expect(rectangle().x).toBe(10);
			expect(get(undoStoreLastItem)).toBeUndefined();
		});
	});

	describe('rectangle keys', () => {
		it('flips, rotates and resets the hovered rectangle', () => {
			select(rectangle());

			flipSelectedRectangleDimensions();
			expect([rectangle().width, rectangle().height]).toEqual([4, 8]);

			rotateSelectedRectangleDegrees(5);
			expect(rectangle().rotation).toBe(35);

			resetSelectedRectangleRotation();
			expect(rectangle().rotation).toBe(0);
		});

		it('ignores circles and legs', () => {
			select(circle());
			flipSelectedRectangleDimensions();
			rotateSelectedRectangleDegrees(5);
			resetSelectedRectangleRotation();
			deselectElementByMouseLeave(event, circle(), false);

			select(leg());
			flipSelectedRectangleDimensions();
			rotateSelectedRectangleDegrees(5);
			resetSelectedRectangleRotation();

			expect(rectangle()).toMatchObject({ width: 8, height: 4, rotation: 30 });
			expect(get(undoStoreLastItem)).toBeUndefined();
		});

		it('does nothing without a hovered element', () => {
			flipSelectedRectangleDimensions();
			rotateSelectedRectangleDegrees(5);
			resetSelectedRectangleRotation();

			expect(rectangle()).toMatchObject({ width: 8, height: 4, rotation: 30 });
		});
	});
});
