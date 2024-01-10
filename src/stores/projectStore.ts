import { get } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';

import { CircleSkipJsonProperties } from '$types/CircleData';
import { LegSkipJsonProperties } from '$types/LegData';
import { Project } from '$types/Project';
import { RectangleSkipJsonProperties } from '$types/RectangleData';

const emptyProject: Project = {
	image: '',
	name: '',

	panelSettings: {
		width: 100,
		height: 100,
		pcbThickness: 1.6,
		smdHeight: 3
	},

	circles: [],
	rectangles: [],
	legs: []
};

export const projectJsonSerializer = {
	parse: (text: string) => {
		try {
			return Project.parse(JSON.parse(text));
		} catch {
			return emptyProject;
		}
	},
	stringify: (object: Project) =>
		JSON.stringify(
			object,
			(key, value) => {
				if (
					![
						...CircleSkipJsonProperties,
						...RectangleSkipJsonProperties,
						...LegSkipJsonProperties
					].includes(key)
				)
					return value;
			},
			2
		)
};

export const projectStore = persisted<Project>('project', emptyProject, {
	syncTabs: true,
	storage: 'local',
	serializer: projectJsonSerializer
});

export const getProjectStoreValue = (): Project => get(projectStore);
export const updateProjectStoreValue = (project: Project) => projectStore.set(project);
