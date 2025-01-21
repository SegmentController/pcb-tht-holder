import type { KonvaMouseEvent } from 'svelte-konva';

import { projectStore } from '$stores/projectStore';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { RectangleData } from '$types/RectangleData';

type GenericElement = CircleData | RectangleData | LegData;

export type FinemoveDirection = 'left' | 'up' | 'right' | 'down';

const selectedElements: GenericElement[] = [];

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
	selectedElements.push(element);
	setStageCursor(event, getModeBasedCursor(isMeasurementMode, true));
};

export const deselectElementByMouseLeave = (
	event: KonvaMouseEvent,
	element: GenericElement,
	isMeasurementMode: boolean
) => {
	let index = selectedElements.findIndex((elementItem) => elementItem == element);
	while (index >= 0) {
		selectedElements.splice(index, 1);
		index = selectedElements.findIndex((elementItem) => elementItem == element);
	}
	setStageCursor(event, getModeBasedCursor(isMeasurementMode, false));
};

export const finemoveSelectedElement = (direction: FinemoveDirection) => {
	if (selectedElements.length != 1) return;

	switch (direction) {
		case 'left': {
			selectedElements[0].x -= 0.1;
			break;
		}
		case 'right': {
			selectedElements[0].x += 0.1;
			break;
		}
		case 'up': {
			selectedElements[0].y -= 0.1;
			break;
		}
		case 'down': {
			selectedElements[0].y += 0.1;
			break;
		}
	}
	projectStore.update((v) => v);
};
