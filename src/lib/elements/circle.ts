import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/ContextMenu.svelte';
import type { CircleSettings } from '$components/modal/ModalCircleSettings.svelte';
import { getLibraryStoreValue, updateLibraryStoreValue } from '$stores/libraryStore';
import { showModalCircleSettings, showModalNameEdit } from '$stores/modalStore';
import { getProjectStoreValue, projectStore } from '$stores/projectStore';
import type { CircleData } from '$types/CircleData';

export const addNewCircle = async (source?: CircleSettings) => {
	const project = getProjectStoreValue();
	const circle: CircleData = {
		depth: source?.depth || 5,

		id: nanoid(),
		x: project.panelSettings.width / 2,
		y: project.panelSettings.height / 2,
		radius: source?.radius || 10,

		fill: 'orange',
		draggable: true,
		opacity: 0.75
	};
	project.circles.push(circle);
	updateCircleChanges(project.circles);

	if (!source) {
		const { confirmed, settings } = await showModalCircleSettings(circle);
		if (confirmed) {
			circle.radius = settings.radius;
			circle.depth = settings.depth;
			updateCircleChanges();
		}
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
		updateLibraryStoreValue(library);
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
				onClick: () => {
					project.circles = project.circles.filter((c) => c != circle);
					updateCircleChanges();
				}
			}
		];
};
