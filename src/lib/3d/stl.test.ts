import { describe, expect, it } from 'vitest';

import { generateBinaryStlFromVertices, getBinaryStlSizeKbFromVertices } from './stl';

const HEADER = 80;
const triangle = [0, 0, 0, 1, 0, 0, 0, 1, 0];

describe('generateBinaryStlFromVertices', () => {
	it('writes only header and zero count for empty input', () => {
		const stl = generateBinaryStlFromVertices(new Float32Array());
		expect(stl).toHaveLength(84);
		expect(new DataView(stl.buffer).getUint32(HEADER, true)).toBe(0);
	});

	it('sizes the buffer as 84 + 50 bytes per facet', () => {
		const stl = generateBinaryStlFromVertices(new Float32Array([...triangle, ...triangle]));
		expect(stl).toHaveLength(84 + 50 * 2);
		expect(new DataView(stl.buffer).getUint32(HEADER, true)).toBe(2);
	});

	it('writes the unit normal, the vertices and a zero attribute word', () => {
		const stl = generateBinaryStlFromVertices(new Float32Array(triangle));
		const view = new DataView(stl.buffer);

		expect([0, 4, 8].map((offset) => view.getFloat32(84 + offset, true))).toEqual([0, 0, 1]);
		expect(
			Array.from({ length: 9 }, (_, index) => view.getFloat32(84 + 12 + index * 4, true))
		).toEqual(triangle);
		expect(view.getUint16(84 + 48, true)).toBe(0);
	});

	it('normalizes the normal of a large triangle', () => {
		const stl = generateBinaryStlFromVertices(new Float32Array([0, 0, 0, 0, 10, 0, 0, 0, 10]));
		const view = new DataView(stl.buffer);
		expect([0, 4, 8].map((offset) => view.getFloat32(84 + offset, true))).toEqual([1, 0, 0]);
	});

	it('writes a zero normal for degenerate triangles', () => {
		const stl = generateBinaryStlFromVertices(new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]));
		const view = new DataView(stl.buffer);
		expect([0, 4, 8].map((offset) => view.getFloat32(84 + offset, true))).toEqual([0, 0, 0]);
	});

	it('does not write facets when the vertex count is not a multiple of 9', () => {
		const stl = generateBinaryStlFromVertices(new Float32Array(10));
		expect(new Uint8Array(stl.buffer, 84).every((byte) => byte === 0)).toBe(true);
	});
});

describe('getBinaryStlSizeKbFromVertices', () => {
	it('matches the generated buffer size in KB', () => {
		const vertices = new Float32Array(9 * 100);
		expect(getBinaryStlSizeKbFromVertices(vertices.length)).toBe(
			Math.round(generateBinaryStlFromVertices(vertices).length / 1024)
		);
	});

	it('is about 0 KB for no vertices', () => {
		expect(getBinaryStlSizeKbFromVertices(0)).toBe(0);
	});
});
