import type { RenderableProject } from '$types/Project';

import { generateStl } from './stl';

type StlFile = string[];

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;

type Size = { w: number; h: number };

export const renderProjectToStl = (project: RenderableProject): StlFile => {
	const size: Size = {
		w: project.panelSettings.width + 2 * EDGE_THICKNESS,
		h: project.panelSettings.height + 2 * EDGE_THICKNESS
	};
	const heightNeed =
		project.panelSettings.pcbThickness +
		Math.max(
			project.panelSettings.smdHeight,
			...project.rectangles.map((r) => r.depth),
			...project.circles.map((c) => c.depth)
		);
	const height = BOTTOM_THICKNESS + heightNeed;
	const deep = project.panelSettings.pcbThickness + project.panelSettings.smdHeight;

	return generateStl([]);
};
