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

	const delta = 0.1;
	switch (direction) {
		case 'left': {
			element.x -= delta;
			break;
		}
		case 'right': {
			element.x += delta;
			break;
		}
		case 'up': {
			element.y -= delta;
			break;
		}
		case 'down': {
			element.y += delta;
			break;
		}
	}

	// Trigger reactivity by reassigning only the specific array
	projectStore.update((v) => {
		if ('radius' in element) {
			// CircleData has radius property
			v.circles = [...v.circles];
		} else if ('width' in element && 'depth' in element) {
			// RectangleData has width and depth properties
			v.rectangles = [...v.rectangles];
		} else {
			// LegData
			v.legs = [...v.legs];
		}
		return v;
	});
};
