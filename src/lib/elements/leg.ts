import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/base/ContextMenu.svelte';
import { showModalConfirm } from '$stores/modalStore';
import { getProjectStoreValue, projectStore } from '$stores/projectStore';
import { addUndo } from '$stores/undoStore';
import { LEG_SIZE, type LegData } from '$types/LegData';

export const addNewLeg = () => {
	const project = getProjectStoreValue();
	const leg: LegData = {
		id: nanoid(),
		x: project.panelSettings.width / 2,
		y: project.panelSettings.height / 2,
		width: LEG_SIZE,
		height: LEG_SIZE,

		fill: 'gray',
		draggable: true,
		opacity: 0.75
	};
	project.legs.push(leg);
	updateLegChanges(project.legs);
};
export const addCornerLegs = () => {
	const project = getProjectStoreValue();
	for (const x of [LEG_SIZE, project.panelSettings.width - LEG_SIZE * 2])
		for (const y of [LEG_SIZE, project.panelSettings.height - LEG_SIZE * 2]) {
			const leg: LegData = {
				id: nanoid(),
				x,
				y,
				width: LEG_SIZE,
				height: LEG_SIZE,

				fill: 'gray',
				draggable: true,
				opacity: 0.75
			};
			project.legs.push(leg);
		}
	updateLegChanges(project.legs);
};
export const deleteLegWithConfirm = async (leg: LegData) => {
	const { confirmed } = await showModalConfirm('Are you sure to delete leg?');
	if (!confirmed) return;

	const project = getProjectStoreValue();
	project.legs = project.legs.filter((l) => l !== leg);
	updateLegChanges(project.legs);

	const projectForUndo = getProjectStoreValue();
	addUndo('Delete leg', () => {
		projectForUndo.legs.push(leg);
		updateLegChanges(projectForUndo.legs);
	});
};
export const deleteAllLegsWithConfirm = async () => {
	const { confirmed } = await showModalConfirm('Are you sure to delete all legs?');
	if (!confirmed) return;

	const project = getProjectStoreValue();
	const legs = project.legs;
	project.legs = [];
	updateLegChanges(project.legs);

	addUndo('Delete all legs', () => {
		project.legs.push(...legs);
		updateLegChanges(project.legs);
	});
};
export const updateLegChanges = (legs?: LegData[]) =>
	projectStore.update((value) => {
		if (legs) value.legs = legs;
		return value;
	});

export const getContextMenuItemForLeg = (id: string): ContextMenuItem[] | undefined => {
	const project = getProjectStoreValue();

	const leg = project.legs.find((c) => c.id === id);
	if (leg)
		return [
			{ name: 'Leg' },
			{
				name: 'Delete',
				onClick: async () => await deleteLegWithConfirm(leg)
			}
		];
};
