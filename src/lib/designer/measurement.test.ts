import { get, writable } from 'svelte/store';
import type { KonvaMouseEvent } from 'svelte-konva';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	cleanupMeasurement,
	emptyMeasurementInfo,
	type MeasurementInfo,
	stageMeasureModeMouseDown,
	stageMeasureModeMouseUp,
	stageMouseMove
} from './measurement';

type Modifiers = { shiftKey?: boolean; ctrlKey?: boolean };

describe('measurement', () => {
	let frames: Map<number, () => void>;
	let nextFrame: number;
	let container: { style: { cursor: string } };
	let info: ReturnType<typeof writable<MeasurementInfo>>;

	const event = (offsetX = 0, offsetY = 0, modifiers: Modifiers = {}) =>
		({
			target: { getStage: () => ({ container: () => container }) },
			evt: { offsetX, offsetY, shiftKey: false, ctrlKey: false, ...modifiers }
		}) as unknown as KonvaMouseEvent;
	const flushFrames = () => {
		const callbacks = [...frames.values()];
		frames.clear();
		for (const callback of callbacks) callback();
	};
	const startAt = (x: number, y: number, scale = 1) =>
		stageMeasureModeMouseDown(event(x, y), info, scale, scale);

	beforeEach(() => {
		frames = new Map();
		nextFrame = 1;
		container = { style: { cursor: '' } };
		info = writable<MeasurementInfo>(structuredClone(emptyMeasurementInfo));
		vi.stubGlobal(
			'requestAnimationFrame',
			vi.fn((callback: () => void) => {
				frames.set(nextFrame, callback);
				return nextFrame++;
			})
		);
		vi.stubGlobal(
			'cancelAnimationFrame',
			vi.fn((id: number) => frames.delete(id))
		);
	});

	afterEach(() => {
		cleanupMeasurement();
		vi.unstubAllGlobals();
	});

	describe('mouse down and up', () => {
		it('starts a measurement at the position in millimetres', () => {
			startAt(40, 20, 2);

			expect(get(info)).toMatchObject({
				visible: true,
				startPoint: { x: 20, y: 10 },
				endPoint: { x: 20, y: 10 },
				textPoint: { x: 20, y: 10 },
				text: '0 mm [0°]'
			});
		});

		it('hides it again on mouse up', () => {
			startAt(1, 1);

			stageMeasureModeMouseUp(event(), info);

			expect(get(info).visible).toBe(false);
		});
	});

	describe('mouse move', () => {
		it('measures the distance and angle, centred text, once per frame', () => {
			startAt(0, 0);

			stageMouseMove(event(3, 4), true, info, 1, 1);
			expect(get(info).endPoint).toEqual({ x: 0, y: 0 });
			flushFrames();

			expect(get(info)).toMatchObject({
				endPoint: { x: 3, y: 4 },
				textPoint: { x: 1.5, y: 2 },
				text: '5.0 mm [53°]'
			});
		});

		it('converts pixels with the zoom scale', () => {
			startAt(10, 10, 2);

			stageMouseMove(event(70, 10), true, info, 2, 2);
			flushFrames();

			expect(get(info).text).toBe('30.0 mm [0°]');
		});

		it('reports angles above the start as negative', () => {
			startAt(0, 10);

			stageMouseMove(event(3, 7), true, info, 1, 1);
			flushFrames();

			expect(get(info).text).toBe('4.2 mm [-45°]');
		});

		it('keeps only the latest position of a burst', () => {
			startAt(0, 0);

			stageMouseMove(event(1, 0), true, info, 1, 1);
			stageMouseMove(event(2, 0), true, info, 1, 1);
			stageMouseMove(event(9, 0), true, info, 1, 1);

			expect(frames.size).toBe(1);
			flushFrames();
			expect(get(info).endPoint).toEqual({ x: 9, y: 0 });
		});

		it('locks to the horizontal with shift and to the vertical with ctrl', () => {
			startAt(5, 5);

			stageMouseMove(event(15, 9, { shiftKey: true }), true, info, 1, 1);
			flushFrames();
			expect(get(info).endPoint).toEqual({ x: 15, y: 5 });

			stageMouseMove(event(15, 9, { ctrlKey: true }), true, info, 1, 1);
			flushFrames();
			expect(get(info).endPoint).toEqual({ x: 5, y: 9 });
		});

		it('leaves the measurement alone while the button is not held', () => {
			stageMouseMove(event(8, 8), true, info, 1, 1);
			flushFrames();

			expect(get(info)).toEqual(emptyMeasurementInfo);
			expect(container.style.cursor).toBe('crosshair');
		});

		it('resets a leftover crosshair when measure mode ended', () => {
			container.style.cursor = 'crosshair';

			stageMouseMove(event(), false, info, 1, 1);
			flushFrames();

			expect(container.style.cursor).toBe('default');
		});

		it('does not even schedule a frame outside measure mode', () => {
			container.style.cursor = 'pointer';

			stageMouseMove(event(), false, info, 1, 1);

			expect(frames.size).toBe(0);
			expect(container.style.cursor).toBe('pointer');
		});
	});

	it('cleanup cancels the pending frame', () => {
		startAt(0, 0);
		stageMouseMove(event(3, 4), true, info, 1, 1);

		cleanupMeasurement();
		flushFrames();

		expect(get(info).text).toBe('0 mm [0°]');
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});
});
