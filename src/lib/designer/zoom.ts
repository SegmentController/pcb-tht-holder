import { tick } from 'svelte';

import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '$lib/constants';
import { MathMinMax } from '$lib/util/math';

/** Wheel delta (px) that makes up one zoom step: one mouse-wheel notch, a short trackpad pinch */
export const WHEEL_STEP_DELTA = 100;

/** `WheelEvent.deltaMode` -> pixels: pixel, line, page */
const DELTA_MODE_SCALE = [1, 40, 800];

/**
 * Folds a wheel delta into the running accumulator.
 * Scrolling up (negative deltaY) zooms in. Returns whole zoom steps (positive = zoom in) and the
 * remainder to carry over, so a trackpad pinch (many tiny deltas) and a wheel notch both feel the same.
 */
export const accumulateWheel = (accumulator: number, deltaY: number, deltaMode = 0) => {
	const total = accumulator - deltaY * (DELTA_MODE_SCALE[deltaMode] ?? 1);
	const steps = Math.trunc(total / WHEEL_STEP_DELTA);
	return { steps, remainder: total - steps * WHEEL_STEP_DELTA };
};

/** Zoom after applying whole steps, clamped to the slider range */
export const applyZoomSteps = (current: number, steps: number) =>
	MathMinMax(current + steps * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);

export interface WheelZoomParameter {
	getZoom: () => number;
	setZoom: (zoom: number) => void;
}

/**
 * Ctrl/Cmd + wheel (and trackpad pinch, which arrives as ctrl + wheel) zooms the canvas in zoom steps
 * and keeps the point under the cursor in place. Plain wheel is left alone: it scrolls/pans natively.
 * The listener is non-passive so the browser's own page zoom can be suppressed.
 */
export const wheelZoom = (node: HTMLElement, parameter: WheelZoomParameter) => {
	let accumulator = 0;

	const onWheel = async (event: WheelEvent) => {
		if (!event.ctrlKey && !event.metaKey) return;
		event.preventDefault();

		const { steps, remainder } = accumulateWheel(accumulator, event.deltaY, event.deltaMode);
		accumulator = remainder;
		if (steps === 0) return;

		const before = parameter.getZoom();
		const after = applyZoomSteps(before, steps);
		if (after === before) return;

		const canvas = node.querySelector('canvas');
		const rect = canvas?.getBoundingClientRect();
		parameter.setZoom(after);
		if (!canvas || !rect || rect.width === 0 || rect.height === 0) return;

		// Fraction of the canvas under the cursor is zoom-invariant: put it back under the cursor
		const fractionX = (event.clientX - rect.left) / rect.width;
		const fractionY = (event.clientY - rect.top) / rect.height;
		await tick();
		const resized = canvas.getBoundingClientRect();
		node.scrollLeft += resized.left + fractionX * resized.width - event.clientX;
		window.scrollBy(0, resized.top + fractionY * resized.height - event.clientY);
	};

	node.addEventListener('wheel', onWheel, { passive: false });
	return { destroy: () => node.removeEventListener('wheel', onWheel) };
};
