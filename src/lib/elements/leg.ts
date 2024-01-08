import { nanoid } from 'nanoid';

import type { ContextMenuItem } from '$components/ContextMenu.svelte';
import { getProjectStoreValue, projectStore } from '$stores/projectStore';
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
export const deleteLeg = (leg: LegData) => {
	const project = getProjectStoreValue();
	project.legs = project.legs.filter((l) => l != leg);
	updateLegChanges(project.legs);
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
				onClick: () => {
					project.legs = project.legs.filter((l) => l != leg);
					updateLegChanges();
				}
			}
		];
};
