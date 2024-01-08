import { get } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';

import { CircleSkipJsonProperties } from '$types/CircleData';
import { LegSkipJsonProperties } from '$types/LegData';
import { Project } from '$types/Project';
import { RectangleSkipJsonProperties } from '$types/RectangleData';

const emptyProject: Project = {
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
};

export const projectStore = persisted<Project>('project', emptyProject, {
	syncTabs: true,
	storage: 'local',
	serializer: {
		parse: (text: string) => {
			try {
				return Project.parse(JSON.parse(text));
			} catch {
				return emptyProject;
			}
		},
		stringify: (object: Project) =>
			JSON.stringify(object, (key, value) => {
				if (
					![
						...CircleSkipJsonProperties,
						...RectangleSkipJsonProperties,
						...LegSkipJsonProperties
					].includes(key)
				)
					return value;
			})
	}
});

export const getProjectStoreValue = (): Project => get(projectStore);
export const updateProjectStoreValue = (project: Project) => projectStore.set(project);
