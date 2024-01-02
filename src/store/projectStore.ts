import { persisted } from 'svelte-persisted-store';

import type { PanelSettings } from '$components/ModalPanelSettings.svelte';
import type { CircleData } from '$types/circle';
import type { RectangleData } from '$types/rectangle';

export type Project = {
	image: string;
	filename: string;

	panelSettings: PanelSettings;

	circles: CircleData[];
	rectangles: RectangleData[];
};

export const preferencesStore = persisted<Project>('project', {
	image: '',
	filename: '',

	panelSettings: {
		width: 0,
		height: 0,
		pcbThickness: 0,
		smdHeight: 0
	},

	circles: [],
	rectangles: []
});
