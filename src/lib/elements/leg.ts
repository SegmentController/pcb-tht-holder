import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/base/ContextMenu.svelte';
import { ELEMENT_DRAGGABLE, ELEMENT_OPACITY, LEG_COLOR } from '$lib/constants';
import { createElementCollection } from '$lib/elements/collection';
import { showModalConfirm } from '$stores/modalStore';
import { getProjectStoreValue } from '$stores/projectStore';
import { addUndo } from '$stores/undoStore';
import { LEG_SIZE, type LegData } from '$types/LegData';

const legs = createElementCollection('legs');

export const addNewLeg = () => {
	const project = getProjectStoreValue();
	const leg: LegData = {
		id: nanoid(),
		x: project.panelSettings.width / 2,
		y: project.panelSettings.height / 2,
		width: LEG_SIZE,
		height: LEG_SIZE,

		fill: LEG_COLOR,
		draggable: ELEMENT_DRAGGABLE,
		opacity: ELEMENT_OPACITY
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

				fill: LEG_COLOR,
				draggable: ELEMENT_DRAGGABLE,
				opacity: ELEMENT_OPACITY
			};
			project.legs.push(leg);
		}
	updateLegChanges(project.legs);
};
export const deleteLegWithConfirm = async (leg: LegData) => {
	const { confirmed } = await showModalConfirm('Are you sure to delete leg?');
	if (!confirmed) return;

	legs.removeWithUndo(leg, 'Delete leg');
};
export const deleteAllLegsWithConfirm = async () => {
	const { confirmed } = await showModalConfirm('Are you sure to delete all legs?');
	if (!confirmed) return;

	const project = getProjectStoreValue();
	const legsBackup = [...project.legs];
	project.legs = [];
	updateLegChanges(project.legs);

	addUndo(
		'Delete all legs',
		() => {
			const currentProject = getProjectStoreValue();
			currentProject.legs.push(...legsBackup);
			updateLegChanges(currentProject.legs);
		},
		() => updateLegChanges(getProjectStoreValue().legs.filter((leg) => !legsBackup.includes(leg)))
	);
};
export const moveLeg = (leg: LegData, x: number, y: number, coalesceKey?: string) =>
	legs.moveWithUndo(leg, x, y, 'Move leg', coalesceKey);
export const updateLegChanges = legs.update;

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
