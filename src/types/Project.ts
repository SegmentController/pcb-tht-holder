import type { PanelSettings } from '$components/ModalPanelSettings.svelte';

import type { CircleData } from './CircleData';
import type { ImageSize } from './ImageSize';
import type { LegData } from './LegData';
import type { RectangleData } from './RectangleData';

export type Project = {
	image: string;
	filename: string;

	panelSettings: PanelSettings;

	circles: CircleData[];
	rectangles: RectangleData[];
	legs: LegData[];
};

export type RenderableProject = Omit<Omit<Project, 'image'>, 'filename'> & { imageSize: ImageSize };
