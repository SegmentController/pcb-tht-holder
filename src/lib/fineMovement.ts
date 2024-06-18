import type { KonvaMouseEvent } from 'svelte-konva';

import { projectStore } from '$stores/projectStore';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { RectangleData } from '$types/RectangleData';

type GenericElement = CircleData | RectangleData | LegData;

export type FinemoveDirection = 'left' | 'up' | 'right' | 'down';

const selectedElements: GenericElement[] = [];

const setCursor = (event: KonvaMouseEvent, cursor: 'pointer' | 'default') => {
	const eventContainer = event.detail?.target?.getStage()?.container();
	if (eventContainer) eventContainer.style.cursor = cursor;
};

export const selectElementByMouseEnter = (event: KonvaMouseEvent, element: GenericElement) => {
	selectedElements.push(element);
	setCursor(event, 'pointer');
};

export const deselectElementByMouseLeave = (event: KonvaMouseEvent, element: GenericElement) => {
	let index = selectedElements.findIndex((elementItem) => elementItem == element);
	while (index >= 0) {
		selectedElements.splice(index, 1);
		index = selectedElements.findIndex((elementItem) => elementItem == element);
	}
	setCursor(event, 'default');
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
