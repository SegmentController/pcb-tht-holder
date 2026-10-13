import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/base/ContextMenu.svelte';
import type { CircleSettings } from '$components/modal/ModalCircleSettings.svelte';
import { CIRCLE_COLOR, ELEMENT_DRAGGABLE, ELEMENT_OPACITY } from '$lib/constants';
import { createElementCollection } from '$lib/elements/collection';
import { getLibraryStoreValue, setLibraryStoreValue } from '$stores/libraryStore';
import { showModalCircleSettings, showModalConfirm, showModalNameEdit } from '$stores/modalStore';
import { getProjectStoreValue } from '$stores/projectStore';
import { addUndo } from '$stores/undoStore';
import type { CircleData } from '$types/CircleData';

const circles = createElementCollection('circles');

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
		} else circles.remove(circle); // cancelled add: nothing to undo
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
	// Capture current state BEFORE showing modal
	const previousRadius = circle.radius;
	const previousDepth = circle.depth;

	const { confirmed, settings } = await showModalCircleSettings(circle);

	if (confirmed) {
		// Check if anything actually changed
		const hasChanges = settings.radius !== previousRadius || settings.depth !== previousDepth;

		if (hasChanges) {
			// Apply changes
			circle.radius = settings.radius;
			circle.depth = settings.depth;
			updateCircleChanges();

			// Add undo entry with closures capturing previous and new values
			const { radius, depth } = settings;
			addUndo(
				'Modify circle',
				() => {
					circle.radius = previousRadius;
					circle.depth = previousDepth;
					updateCircleChanges();
				},
				() => {
					circle.radius = radius;
					circle.depth = depth;
					updateCircleChanges();
				}
			);
		}
	}
};
export const deleteCircle = (circle: CircleData) => circles.removeWithUndo(circle, 'Delete circle');
export const moveCircle = (circle: CircleData, x: number, y: number, coalesceKey?: string) =>
	circles.moveWithUndo(circle, x, y, 'Move circle', coalesceKey);
export const updateCircleChanges = circles.update;

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
