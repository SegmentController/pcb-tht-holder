import type { KonvaMouseEvent } from 'svelte-konva';

import { FINE_MOVEMENT_DELTA } from '$lib/constants';
import {
	flipRectangleDimensions,
	resetRectangleRotation,
	rotateRectangleDegrees
} from '$lib/elements/rectangle';
import { projectStore } from '$stores/projectStore';
import { type GenericElement, isCircle, isRectangle } from '$types/typeGuards';

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

export const getSelectedElementInfo = (): string | undefined => {
	if (selectedElements.size !== 1) return undefined;

	const element = selectedElements.values().next().value;
	if (!element) return undefined;

	if (isCircle(element)) return `Circle ${element.radius}x${element.depth}mm`;
	else if (isRectangle(element))
		return `Rectangle ${element.width}x${element.height}x${element.depth}mm ${element.rotation}°`;
	else
		// Leg
		return 'Leg';
};

export const finemoveSelectedElement = (direction: FinemoveDirection, multiplier = 1) => {
	if (selectedElements.size !== 1) return;

	const element = selectedElements.values().next().value;
	if (!element) return;

	const delta = FINE_MOVEMENT_DELTA * multiplier;
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
		if (isCircle(element)) v.circles = [...v.circles];
		else if (isRectangle(element)) v.rectangles = [...v.rectangles];
		else v.legs = [...v.legs];

		return v;
	});
};

export const flipSelectedRectangleDimensions = () => {
	if (selectedElements.size !== 1) return;

	const element = selectedElements.values().next().value;
	if (!element) return;

	if (isRectangle(element)) flipRectangleDimensions(element);
};

export const rotateSelectedRectangleDegrees = (delta: number) => {
	if (selectedElements.size !== 1) return;

	const element = selectedElements.values().next().value;
	if (!element) return;

	if (isRectangle(element)) rotateRectangleDegrees(element, delta);
};

export const resetSelectedRectangleRotation = () => {
	if (selectedElements.size !== 1) return;

	const element = selectedElements.values().next().value;
	if (!element) return;

	if (isRectangle(element)) resetRectangleRotation(element);
};
