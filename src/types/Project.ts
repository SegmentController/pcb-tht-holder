import { z } from 'zod';

import { CircleData } from './CircleData';
import { LegData } from './LegData';
import { PanelSettings } from './PanelSettings';
import { RectangleData } from './RectangleData';

export const Project = z.object({
	name: z.string(),
	image: z.string(),
	label: z.string().default(''),

	panelSettings: PanelSettings,
	zoom: z.number(),

	circles: z.array(CircleData),
	rectangles: z.array(RectangleData),
	legs: z.array(LegData)
});
export type Project = z.infer<typeof Project>;

export type RenderableProject = Omit<Project, 'name' | 'image'>;
