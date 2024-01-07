import { writeFloatLE, writeInt16LE, writeInt32LE } from '$lib/buffer';

const SOLID_NAME = 'THT-holder';

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

export const getBinaryStlSizeKbFromVertices = (verticesLength: number) =>
	Math.round((80 + 4 + 50 * (verticesLength / 9)) / 1024);
export const generateBinaryStlFromVertices = (vertices: Float32Array): Uint8Array => {
	const buffer = new Uint8Array(80 + 4 + 50 * (vertices.length / 9));

	let pos = writeInt32LE(buffer, vertices.length / 9, 80);
	if (vertices.length % 9 === 0) {
		let index = 0;
		while (index < vertices.length) {
			for (let pointIndex = 0; pointIndex < 3; pointIndex++) pos = writeFloatLE(buffer, 0, pos);
			for (let pointIndex = 0; pointIndex < 9; pointIndex++)
				pos = writeFloatLE(buffer, vertices.at(index++)!, pos);
			pos = writeInt16LE(buffer, 0, pos);
		}
	}

	return buffer;
};
