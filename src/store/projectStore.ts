import { persisted } from 'svelte-persisted-store';

import type { Project } from '$types/Project';

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
	rectangles: [],
	legs: []
});
