import { virtualDownload } from '$lib/download';
import { showModalProjectSettings } from '$stores/modalStore';
import {
	getProjectStoreValue,
	projectJsonSerializer,
	updateProjectStoreValue
} from '$stores/projectStore';
import type { Project } from '$types/Project';

export const openProjectSettings = async () => {
	const projectStore = getProjectStoreValue();
	const { confirmed, panelSettings, name, label } = await showModalProjectSettings(
		projectStore.panelSettings,
		projectStore.name,
		projectStore.label
	);
	if (confirmed) {
		updateProjectStoreValue((value) => {
			value.panelSettings = panelSettings;
			value.name = name;
			value.label = label;
			return value;
		});
	}
};

export const downloadProjectFile = () => {
	const projectStore = getProjectStoreValue();
	const projectData: Project = {
		image: projectStore.image,
		name: projectStore.name,
		label: projectStore.label,
		panelSettings: projectStore.panelSettings,
		circles: projectStore.circles,
		rectangles: projectStore.rectangles,
		legs: projectStore.legs
	};
	const projectDataJsonString = projectJsonSerializer.stringify(projectData);

	virtualDownload(projectStore.name + '.tht3d', projectDataJsonString);
};
