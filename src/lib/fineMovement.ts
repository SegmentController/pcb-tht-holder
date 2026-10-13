import type { KonvaMouseEvent } from 'svelte-konva';

import { FINE_MOVEMENT_DELTA } from '$lib/constants';
import { moveCircle } from '$lib/elements/circle';
import { moveLeg } from '$lib/elements/leg';
import {
	flipRectangleDimensions,
	moveRectangle,
	resetRectangleRotation,
	rotateRectangleDegrees
} from '$lib/elements/rectangle';
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

/** Drops selections of elements that no longer exist (deleted without a mouseleave event) */
export const pruneSelectedElements = (elements: readonly GenericElement[]) => {
	for (const element of selectedElements)
		if (!elements.includes(element)) selectedElements.delete(element);
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
	let x = element.x;
	let y = element.y;
	switch (direction) {
		case 'left': {
			x -= delta;
			break;
		}
		case 'right': {
			x += delta;
			break;
		}
		case 'up': {
			y -= delta;
			break;
		}
		case 'down': {
			y += delta;
			break;
		}
	}

	// Holding an arrow key moves many times: those share one undo entry
	const coalesceKey = `nudge:${element.id}`;
	if (isCircle(element)) moveCircle(element, x, y, coalesceKey);
	else if (isRectangle(element)) moveRectangle(element, x, y, coalesceKey);
	else moveLeg(element, x, y, coalesceKey);
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
