/** Project setup shared by the element operation tests */
import { setProjectStoreValue } from '$stores/projectStore';
import { clearUndoStack } from '$stores/undoStore';
import { CircleData } from '$types/CircleData';
import { LegData } from '$types/LegData';
import { Project } from '$types/Project';
import { RectangleData } from '$types/RectangleData';

export const PANEL = { width: 60, height: 40 };

export const circleOf = (id: string, radius = 2, depth = 5) =>
	CircleData.parse({ id, x: 10, y: 10, radius, depth });

export const rectangleOf = (id: string, width = 8, height = 4, rotation = 0) =>
	RectangleData.parse({ id, x: 10, y: 10, width, height, depth: 5, rotation });

export const legOf = (id: string) => LegData.parse({ id, x: 3, y: 3, width: 2, height: 2 });

/** Replaces the project store with an empty panel plus the given elements and clears the undo stack */
export const resetProject = (
	elements: { circles?: CircleData[]; rectangles?: RectangleData[]; legs?: LegData[] } = {}
) => {
	setProjectStoreValue(
		Project.parse({
			name: 'p',
			image: '',
			zoom: 100,
			panelSettings: { ...PANEL, pcbThickness: 1.6, smdHeight: 3, printTolerance: 0 },
			circles: elements.circles ?? [],
			rectangles: elements.rectangles ?? [],
			legs: elements.legs ?? []
		})
	);
	clearUndoStack();
};
