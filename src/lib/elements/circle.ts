import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/base/ContextMenu.svelte';
import type { CircleSettings } from '$components/modal/ModalCircleSettings.svelte';
import { CIRCLE_COLOR, ELEMENT_DRAGGABLE, ELEMENT_OPACITY } from '$lib/constants';
import { getLibraryStoreValue, setLibraryStoreValue } from '$stores/libraryStore';
import { showModalCircleSettings, showModalConfirm, showModalNameEdit } from '$stores/modalStore';
import { getProjectStoreValue, projectStore } from '$stores/projectStore';
import { addUndo } from '$stores/undoStore';
import type { CircleData } from '$types/CircleData';

export const addNewCircle = async (source?: CircleSettings) => {
	const project = getProjectStoreValue();
	const circle: CircleData = {
		depth: source?.depth || 5,

		id: nanoid(),
		x: project.panelSettings.width / 2,
		y: project.panelSettings.height / 2,
		radius: source?.radius || 10,

		fill: CIRCLE_COLOR,
		draggable: ELEMENT_DRAGGABLE,
		opacity: ELEMENT_OPACITY
	};
	project.circles.push(circle);
	updateCircleChanges(project.circles);

	if (!source) {
		const { confirmed, settings } = await showModalCircleSettings(circle);
		if (confirmed) {
			circle.radius = settings.radius;
			circle.depth = settings.depth;
			updateCircleChanges();
		} else deleteCircle(circle);
	}
};
export const duplicateCircle = (source: CircleData) => addNewCircle(source);
export const addCircleToLibrary = async (source: CircleData) => {
	const { confirmed, name } = await showModalNameEdit('circle');
	if (confirmed) {
		const library = getLibraryStoreValue();
		library.push({
			name,
			type: 'circle',
			radius: source.radius,
			depth: source.depth
		});
		setLibraryStoreValue(library);
	}
};
export const modifyCircle = async (circle: CircleData) => {
	const { confirmed, settings } = await showModalCircleSettings(circle);
	if (confirmed) {
		circle.radius = settings.radius;
		circle.depth = settings.depth;
		updateCircleChanges();
	}
};
export const deleteCircle = (circle: CircleData) => {
	const project = getProjectStoreValue();
	project.circles = project.circles.filter((c) => c !== circle);
	updateCircleChanges();
	addUndo('Delete circle', () => {
		const currentProject = getProjectStoreValue();
		currentProject.circles.push(circle);
		updateCircleChanges();
	});
};
export const updateCircleChanges = (circles?: CircleData[]) =>
	projectStore.update((value) => {
		if (circles) value.circles = circles;
		return value;
	});

export const getContextMenuItemForCircle = (id: string): ContextMenuItem[] | undefined => {
	const project = getProjectStoreValue();

	const circle = project.circles.find((c) => c.id === id);
	if (circle)
		return [
			{ name: `Circle ${circle.radius}x${circle.depth}mm` },
			{
				name: 'Properties...',
				onClick: () => modifyCircle(circle)
			},
			{ name: 'Duplicate', onClick: () => duplicateCircle(circle) },
			{ name: 'Add to library...', onClick: () => addCircleToLibrary(circle) },
			{ name: '' },
			{
				name: 'Delete',
				onClick: async () => {
					const { confirmed } = await showModalConfirm('Are you sure to delete circle?');
					if (confirmed) deleteCircle(circle);
				}
			}
		];
};
