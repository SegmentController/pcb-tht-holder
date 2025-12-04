import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/base/ContextMenu.svelte';
import type { RectangleSettings } from '$components/modal/ModalRectangleSettings.svelte';
import { ELEMENT_DRAGGABLE, ELEMENT_OPACITY, RECTANGLE_COLOR } from '$lib/constants';
import { getLibraryStoreValue, setLibraryStoreValue } from '$stores/libraryStore';
import {
	showModalConfirm,
	showModalNameEdit,
	showModalRectangleSettings
} from '$stores/modalStore';
import { getProjectStoreValue, projectStore } from '$stores/projectStore';
import { addUndo } from '$stores/undoStore';
import type { RectangleData } from '$types/RectangleData';

export const addNewRectangle = async (source?: RectangleSettings) => {
	const project = getProjectStoreValue();
	const rectangle: RectangleData = {
		depth: source?.depth || 5,

		id: nanoid(),
		x: project.panelSettings.width / 2,
		y: project.panelSettings.height / 2,
		width: source?.width || 10,
		height: source?.height || 5,
		rotation: source?.rotation || 0,

		fill: RECTANGLE_COLOR,
		draggable: ELEMENT_DRAGGABLE,
		opacity: ELEMENT_OPACITY
	};
	project.rectangles.push(rectangle);
	updateRectangleChanges(project.rectangles);

	if (!source) {
		const { confirmed, settings } = await showModalRectangleSettings(rectangle);
		if (confirmed) {
			rectangle.width = settings.width;
			rectangle.height = settings.height;
			rectangle.depth = settings.depth;
			rectangle.rotation = settings.rotation;
			updateRectangleChanges();
		} else deleteRectangle(rectangle);
	}
};
export const duplicateRectangle = (source: RectangleData) => addNewRectangle(source);
export const flipRectangleDimensions = (rectangle: RectangleData) => {
	const previousWidth = rectangle.width;
	const previousHeight = rectangle.height;

	rectangle.width = previousHeight;
	rectangle.height = previousWidth;
	updateRectangleChanges();

	// Add undo entry
	addUndo('Flip rectangle', () => {
		rectangle.width = previousWidth;
		rectangle.height = previousHeight;
		updateRectangleChanges();
	});
};
export const addRectangleToLibrary = async (source: RectangleData) => {
	const { confirmed, name } = await showModalNameEdit('rectangle');
	if (confirmed) {
		const library = getLibraryStoreValue();
		library.push({
			name,
			type: 'rectangle',
			width: source.width,
			height: source.height,
			depth: source.depth,
			rotation: source.rotation
		});
		setLibraryStoreValue(library);
	}
};
export const modifyRectangle = async (rectangle: RectangleData) => {
	// Capture current state BEFORE showing modal
	const previousWidth = rectangle.width;
	const previousHeight = rectangle.height;
	const previousDepth = rectangle.depth;
	const previousRotation = rectangle.rotation;

	const { confirmed, settings } = await showModalRectangleSettings(rectangle);

	if (confirmed) {
		// Check if anything actually changed
		const hasChanges =
			settings.width !== previousWidth ||
			settings.height !== previousHeight ||
			settings.depth !== previousDepth ||
			settings.rotation !== previousRotation;

		if (hasChanges) {
			// Apply changes
			rectangle.width = settings.width;
			rectangle.height = settings.height;
			rectangle.depth = settings.depth;
			rectangle.rotation = settings.rotation;
			updateRectangleChanges();

			// Add undo entry with closure capturing previous values
			addUndo('Modify rectangle', () => {
				rectangle.width = previousWidth;
				rectangle.height = previousHeight;
				rectangle.depth = previousDepth;
				rectangle.rotation = previousRotation;
				updateRectangleChanges();
			});
		}
	}
};
export const rotateRectangleDegrees = (rectangle: RectangleData, delta: number) => {
	const previousRotation = rectangle.rotation;
	const updatedRotation = (rectangle.rotation + delta + 360) % 360;

	rectangle.rotation = updatedRotation;
	updateRectangleChanges();

	// Add undo entry
	addUndo('Rotate rectangle', () => {
		rectangle.rotation = previousRotation;
		updateRectangleChanges();
	});
};
export const resetRectangleRotation = (rectangle: RectangleData) => {
	rectangle.rotation = 0;
	updateRectangleChanges();
};
export const deleteRectangle = (rectangle: RectangleData) => {
	const project = getProjectStoreValue();
	project.rectangles = project.rectangles.filter((r) => r !== rectangle);
	updateRectangleChanges();
	addUndo('Delete rectangle', () => {
		const currentProject = getProjectStoreValue();
		currentProject.rectangles.push(rectangle);
		updateRectangleChanges();
	});
};
export const updateRectangleChanges = (rectangles?: RectangleData[]) =>
	projectStore.update((value) => {
		if (rectangles) value.rectangles = rectangles;
		return value;
	});

export const getContextMenuItemForRectangle = (id: string): ContextMenuItem[] | undefined => {
	const project = getProjectStoreValue();

	const rectangle = project.rectangles.find((r) => r.id === id);
	if (rectangle)
		return [
			{
				name: `Rectangle ${rectangle.width}x${rectangle.height}x${rectangle.depth}mm ${rectangle.rotation}°`
			},
			{
				name: 'Properties...',
				onClick: () => modifyRectangle(rectangle)
			},
			{ name: 'Flip dimensions', onClick: () => flipRectangleDimensions(rectangle) },
			{ name: 'Duplicate', onClick: () => duplicateRectangle(rectangle) },
			{ name: 'Add to library...', onClick: () => addRectangleToLibrary(rectangle) },
			{ name: '' },
			{
				name: 'Delete',
				onClick: async () => {
					const { confirmed } = await showModalConfirm('Are you sure to delete rectangle?');
					if (confirmed) deleteRectangle(rectangle);
				}
			}
		];
};
