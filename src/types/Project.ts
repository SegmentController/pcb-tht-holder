import type { PanelSettings } from '$components/ModalPanelSettings.svelte';

import type { CircleData } from './CircleData';
import type { RectangleData } from './RectangleData';

export type Project = {
	image: string;
	filename: string;

	panelSettings: PanelSettings;

	circles: CircleData[];
	rectangles: RectangleData[];
};

export type RenderableProject = Omit<Omit<Project, 'image'>, 'filename'>;
