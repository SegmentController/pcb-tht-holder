// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer';
import type { Polygon } from 'three-csg-ts/lib/esm/Polygon';

const SOLID_NAME = 'THT-holder';

export const generateStlFromPolygons = (polygons: Polygon[]): string[] => {
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

export const generateStlFromVertices = (vertices: Float32Array): string[] => {
	const lines: string[] = [];

	lines.push(`solid ${SOLID_NAME}`);
	if (vertices.length % 9 === 0) {
		let index = 0;
		while (index < vertices.length) {
			lines.push('facet normal 0 0 0', '    outer loop');
			for (let pointIndex = 0; pointIndex < 3; pointIndex++)
				lines.push(
					`        vertex ${vertices.at(index++)} ${vertices.at(index++)} ${vertices.at(index++)}`
				);
			lines.push('    endloop', 'endfacet');
		}
	}
	lines.push(`endsolid ${SOLID_NAME}`);

	return lines;
};

export const generateBinaryStlFromVertices = (vertices: Float32Array): Buffer => {
	const buffer = Buffer.allocUnsafe(80 + 4 + 50 * (vertices.length / 9));

	let pos = buffer.writeInt32LE(vertices.length / 9, 80);
	if (vertices.length % 9 === 0) {
		let index = 0;
		while (index < vertices.length) {
			for (let pointIndex = 0; pointIndex < 3; pointIndex++) pos = buffer.writeFloatLE(0, pos);
			for (let pointIndex = 0; pointIndex < 9; pointIndex++)
				pos = buffer.writeFloatLE(vertices.at(index++)!, pos);
			pos = buffer.writeInt16LE(0, pos);
		}
	}

	return buffer;
};
