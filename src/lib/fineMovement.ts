import type { KonvaMouseEvent } from 'svelte-konva';

import { projectStore } from '$stores/projectStore';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { RectangleData } from '$types/RectangleData';

type GenericElement = CircleData | RectangleData | LegData;

export type FinemoveDirection = 'left' | 'up' | 'right' | 'down';

const selectedElements = new Set<GenericElement>();

const getModeBasedCursor = (
	isMeasurementMode: boolean,
	isSelected: boolean
): 'pointer' | 'default' | 'crosshair' => {
	if (isMeasurementMode) return 'crosshair';
	return isSelected ? 'pointer' : 'default';
};

const setStageCursor = (event: KonvaMouseEvent, cursor: 'pointer' | 'default' | 'crosshair') => {
	const eventContainer = event.target.getStage()?.container();
	if (eventContainer) eventContainer.style.cursor = cursor;
};

export const selectElementByMouseEnter = (
	event: KonvaMouseEvent,
	element: GenericElement,
	isMeasurementMode: boolean
) => {
	selectedElements.add(element);
	setStageCursor(event, getModeBasedCursor(isMeasurementMode, true));
};

export const deselectElementByMouseLeave = (
	event: KonvaMouseEvent,
	element: GenericElement,
	isMeasurementMode: boolean
) => {
	selectedElements.delete(element);
	setStageCursor(event, getModeBasedCursor(isMeasurementMode, false));
};

export const finemoveSelectedElement = (direction: FinemoveDirection) => {
	if (selectedElements.size !== 1) return;

	const element = selectedElements.values().next().value;
	if (!element) return;

	switch (direction) {
		case 'left': {
			element.x -= 0.1;
			break;
		}
		case 'right': {
			element.x += 0.1;
			break;
		}
		case 'up': {
			element.y -= 0.1;
			break;
		}
		case 'down': {
			element.y += 0.1;
			break;
		}
	}
	projectStore.update((v) => v);
};
