import { writeFloatLE, writeInt16LE, writeInt32LE } from '$lib/buffer';

const SOLID_NAME = 'THT-holder';

const computeFaceNormal = (v: Float32Array, i: number): [number, number, number] => {
	const [x0, y0, z0, x1, y1, z1, x2, y2, z2] = [
		v[i]!, v[i + 1]!, v[i + 2]!,
		v[i + 3]!, v[i + 4]!, v[i + 5]!,
		v[i + 6]!, v[i + 7]!, v[i + 8]!,
	];
	const ex = x1 - x0, ey = y1 - y0, ez = z1 - z0;
	const fx = x2 - x0, fy = y2 - y0, fz = z2 - z0;
	const nx = ey * fz - ez * fy;
	const ny = ez * fx - ex * fz;
	const nz = ex * fy - ey * fx;
	const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
	return len > 0 ? [nx / len, ny / len, nz / len] : [0, 0, 0];
};

export const generateStlFromVertices = (vertices: Float32Array): string[] => {
	const lines: string[] = [`solid ${SOLID_NAME}`];

	if (vertices.length % 9 === 0) {
		let index = 0;
		while (index < vertices.length) {
			const [nx, ny, nz] = computeFaceNormal(vertices, index);
			lines.push(`facet normal ${nx} ${ny} ${nz}`, '    outer loop');
			for (let pointIndex = 0; pointIndex < 3; pointIndex++)
				lines.push(`        vertex ${vertices[index++]} ${vertices[index++]} ${vertices[index++]}`);
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
			const [nx, ny, nz] = computeFaceNormal(vertices, index);
			pos = writeFloatLE(buffer, nx, pos);
			pos = writeFloatLE(buffer, ny, pos);
			pos = writeFloatLE(buffer, nz, pos);
			for (let pointIndex = 0; pointIndex < 9; pointIndex++)
				pos = writeFloatLE(buffer, vertices[index++]!, pos);
			pos = writeInt16LE(buffer, 0, pos);
		}
	}

	return buffer;
};
