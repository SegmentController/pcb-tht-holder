import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/base/ContextMenu.svelte';
import type { RectangleSettings } from '$components/modal/ModalRectangleSettings.svelte';
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

		fill: 'green',
		draggable: true,
		opacity: 0.75
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
	const oldWidth = rectangle.width;
	rectangle.width = rectangle.height;
	rectangle.height = oldWidth;
	updateRectangleChanges();
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
	const { confirmed, settings } = await showModalRectangleSettings(rectangle);
	if (confirmed) {
		rectangle.width = settings.width;
		rectangle.height = settings.height;
		rectangle.depth = settings.depth;
		rectangle.rotation = settings.rotation;
		updateRectangleChanges();
	}
};
export const rotateRectangleDegrees = (rectangle: RectangleData, delta: number) => {
	rectangle.rotation = (rectangle.rotation + delta + 360) % 360;
	updateRectangleChanges();
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
