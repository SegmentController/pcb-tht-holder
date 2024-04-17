import { projectStore } from '$stores/projectStore';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { RectangleData } from '$types/RectangleData';

type GenericElement = CircleData | RectangleData | LegData;

export type FinemoveDirection = 'left' | 'up' | 'right' | 'down';

const selectedElements: GenericElement[] = [];

export const selectElementByMouseEnter = (element: GenericElement) =>
	selectedElements.push(element);

export const deselectElementByMouseLeave = (element: GenericElement) => {
	let index = selectedElements.findIndex((elementItem) => elementItem == element);
	while (index >= 0) {
		selectedElements.splice(index, 1);
		index = selectedElements.findIndex((elementItem) => elementItem == element);
	}
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
