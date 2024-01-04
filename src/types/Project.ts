import { z } from 'zod';

import { CircleData } from './CircleData';
import { ImageSize } from './ImageSize';
import { LegData } from './LegData';
import { PanelSettings } from './PanelSettings';
import { RectangleData } from './RectangleData';

export const Project = z.object({
	image: z.string(),
	filename: z.string(),

	panelSettings: PanelSettings,

	circles: z.array(CircleData),
	rectangles: z.array(RectangleData),
	legs: z.array(LegData)
});
export type Project = z.infer<typeof Project>;

export type RenderableProject = Omit<Omit<Project, 'image'>, 'filename'> & { imageSize: ImageSize };
