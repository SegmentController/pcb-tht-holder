import { describe, expect, it } from 'vitest';

import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '$lib/constants';

import { accumulateWheel, applyZoomSteps, WHEEL_STEP_DELTA } from './zoom';

describe('accumulateWheel', () => {
	it('zooms in one step per wheel notch scrolled up', () => {
		expect(accumulateWheel(0, -WHEEL_STEP_DELTA)).toEqual({ steps: 1, remainder: 0 });
	});

	it('zooms out when scrolling down', () => {
		expect(accumulateWheel(0, WHEEL_STEP_DELTA * 2)).toEqual({ steps: -2, remainder: 0 });
	});

	it('carries small trackpad deltas over until a whole step is reached', () => {
		let accumulator = 0;
		let total = 0;
		for (let index = 0; index < 25; index++) {
			const result = accumulateWheel(accumulator, -10);
			accumulator = result.remainder;
			total += result.steps;
		}
		expect(total).toBe(2);
		expect(accumulator).toBe(50);
	});

	it('scales line and page delta modes to pixels', () => {
		expect(accumulateWheel(0, -3, 1).steps).toBe(1);
		expect(accumulateWheel(0, -1, 2).steps).toBe(8);
	});
});

describe('applyZoomSteps', () => {
	it('moves by the zoom step', () => {
		expect(applyZoomSteps(100, 1)).toBe(100 + ZOOM_STEP);
		expect(applyZoomSteps(100, -2)).toBe(100 - 2 * ZOOM_STEP);
	});

	it('clamps to the slider range', () => {
		expect(applyZoomSteps(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
		expect(applyZoomSteps(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
		expect(applyZoomSteps(100, 1000)).toBe(ZOOM_MAX);
	});
});
