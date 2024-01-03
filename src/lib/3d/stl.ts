import type { Polygon } from 'three-csg-ts/lib/esm/Polygon';

const SOLID_NAME = 'THT-holder';

export const generateStl = (polygons: Polygon[]): string[] => {
	const lines: string[] = [];

	lines.push(`solid ${SOLID_NAME}`);
	for (const polygon of polygons) {
		lines.push('facet normal 0 0 0', '    outer loop');
		for (let index = 0; index < 3; index++)
			lines.push(
				`        vertex ${polygon.vertices[index].pos.x} ${polygon.vertices[index].pos.y} ${polygon.vertices[index].pos.z}`
			);
		lines.push('    endloop', 'endfacet');
	}
	lines.push(`endsolid ${SOLID_NAME}`);

	return lines;
};
