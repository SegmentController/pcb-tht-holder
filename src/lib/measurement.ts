import type { Writable } from 'svelte/store';
import type { KonvaMouseEvent } from 'svelte-konva';

export type MeasurementInfo = {
	visible: boolean;
	startPoint: { x: number; y: number };
	endPoint: { x: number; y: number };
	textPoint: { x: number; y: number };
	text: string;
};
export const empytMeasurementInfo: MeasurementInfo = {
	visible: false,
	startPoint: { x: 0, y: 0 },
	endPoint: { x: 0, y: 0 },
	textPoint: { x: 0, y: 0 },
	text: ''
};

export const stageMouseMove = (
	event: KonvaMouseEvent,
	isMeasurementMode: boolean,
	info: Writable<MeasurementInfo>,
	scaleX: number,
	scaleY: number
) => {
	const eventContainer = event.target.getStage()?.container();
	if (eventContainer)
		if (isMeasurementMode) {
			if (eventContainer.style.cursor !== 'crosshair') eventContainer.style.cursor = 'crosshair';
		} else {
			if (eventContainer.style.cursor === 'crosshair') eventContainer.style.cursor = 'default';
		}

	if (isMeasurementMode)
		info.update((previous) => {
			previous.endPoint = event.evt.shiftKey
				? { x: event.evt.offsetX / scaleX, y: previous.startPoint.y }
				: (event.evt.ctrlKey
					? { x: previous.startPoint.x, y: event.evt.offsetY / scaleY }
					: { x: event.evt.offsetX / scaleX, y: event.evt.offsetY / scaleY });

			previous.textPoint = {
				x: previous.startPoint.x + (previous.endPoint.x - previous.startPoint.x) / 2,
				y: previous.startPoint.y + (previous.endPoint.y - previous.startPoint.y) / 2
			};

			let distance = Math.hypot(
				Math.abs(previous.startPoint.x - previous.endPoint.x),
				Math.abs(previous.startPoint.y - previous.endPoint.y)
			);
			distance = Math.round(distance * 10) / 10;

			const deltaY = previous.endPoint.y - previous.startPoint.y;
			const deltaX = previous.endPoint.x - previous.startPoint.x;
			const radians = Math.atan2(deltaY, deltaX);
			const degrees = Math.round(radians * (180 / Math.PI));

			previous.text = `${distance.toFixed(1)} mm [${degrees}°]`;
			return previous;
		});
};

export const stageMeasureModeMouseDown = (
	event: KonvaMouseEvent,
	info: Writable<MeasurementInfo>,
	scaleX: number,
	scaleY: number
) => {
	info.update((previous) => {
		previous.startPoint = { x: event.evt.offsetX / scaleX, y: event.evt.offsetY / scaleY };
		previous.endPoint = previous.startPoint;
		previous.textPoint = previous.startPoint;
		previous.text = `0 mm [0°]`;
		previous.visible = true;
		return previous;
	});
};

export const stageMeasureModeMouseUp = (
	event: KonvaMouseEvent,
	info: Writable<MeasurementInfo>
) => {
	info.update((previous) => {
		previous.visible = false;
		return previous;
	});
};
