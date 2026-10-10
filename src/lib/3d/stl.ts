const HEADER_BYTES = 80;
const FACET_BYTES = 50;

export const getBinaryStlSizeKbFromVertices = (verticesLength: number) =>
	Math.round((HEADER_BYTES + 4 + FACET_BYTES * (verticesLength / 9)) / 1024);

export const generateBinaryStlFromVertices = (vertices: Float32Array): Uint8Array => {
	const facetCount = vertices.length / 9;
	const buffer = new Uint8Array(HEADER_BYTES + 4 + FACET_BYTES * facetCount);
	const view = new DataView(buffer.buffer);

	view.setInt32(HEADER_BYTES, facetCount, true);
	if (vertices.length % 9 !== 0) return buffer;

	let pos = HEADER_BYTES + 4;
	for (let index = 0; index < vertices.length; index += 9) {
		const ex = vertices[index + 3]! - vertices[index]!;
		const ey = vertices[index + 4]! - vertices[index + 1]!;
		const ez = vertices[index + 5]! - vertices[index + 2]!;
		const fx = vertices[index + 6]! - vertices[index]!;
		const fy = vertices[index + 7]! - vertices[index + 1]!;
		const fz = vertices[index + 8]! - vertices[index + 2]!;
		const nx = ey * fz - ez * fy;
		const ny = ez * fx - ex * fz;
		const nz = ex * fy - ey * fx;
		const length_ = Math.hypot(nx, ny, nz);
		const hasNormal = length_ > 0;

		view.setFloat32(pos, hasNormal ? nx / length_ : 0, true);
		view.setFloat32(pos + 4, hasNormal ? ny / length_ : 0, true);
		view.setFloat32(pos + 8, hasNormal ? nz / length_ : 0, true);
		pos += 12;
		for (let offset = 0; offset < 9; offset++, pos += 4)
			view.setFloat32(pos, vertices[index + offset]!, true);
		pos += 2; // attribute byte count (already zero)
	}

	return buffer;
};
