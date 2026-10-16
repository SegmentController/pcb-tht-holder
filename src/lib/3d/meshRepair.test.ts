import { describe, expect, it } from 'vitest';

import { countOpenEdges, repairMesh } from './meshRepair';
import { analyzeVertices } from './meshTestUtilities';

type Point = [number, number, number];

// Outward facing (counter-clockwise seen from outside) quads of the unit cube
const faces: Record<string, [Point, Point, Point, Point]> = {
	bottom: [
		[0, 0, 0],
		[0, 1, 0],
		[1, 1, 0],
		[1, 0, 0]
	],
	top: [
		[0, 0, 1],
		[1, 0, 1],
		[1, 1, 1],
		[0, 1, 1]
	],
	front: [
		[0, 0, 0],
		[1, 0, 0],
		[1, 0, 1],
		[0, 0, 1]
	],
	back: [
		[0, 1, 0],
		[0, 1, 1],
		[1, 1, 1],
		[1, 1, 0]
	],
	left: [
		[0, 0, 0],
		[0, 0, 1],
		[0, 1, 1],
		[0, 1, 0]
	],
	right: [
		[1, 0, 0],
		[1, 1, 0],
		[1, 1, 1],
		[1, 0, 1]
	]
};

const quad = ([a, b, c, d]: [Point, Point, Point, Point]): Point[] => [a, b, c, a, c, d];

const toArray = (points: Point[]) => new Float32Array(points.flat());

const cube = () => Object.values(faces).flatMap((face) => quad(face));

const translate = (points: Point[], [dx, dy, dz]: Point): Point[] =>
	points.map(([x, y, z]): Point => [x + dx, y + dy, z + dz]);

/** Winding of a quad reversed (facing inwards) */
const wrongQuad = ([a, b, c, d]: [Point, Point, Point, Point]): Point[] => [a, c, b, a, d, c];

const volumeOf = (vertices: Float32Array) => analyzeVertices(vertices).volume;

/** Closed unit-cube faces minus the named ones */
const cubeWithout = (...names: string[]) =>
	Object.entries(faces)
		.filter(([name]) => !names.includes(name))
		.flatMap(([, face]) => quad(face));

/**
 * Prism over a counter-clockwise polygon (z from 0 to `height`), outward facing. Both caps are
 * fans from the first vertex, so the polygon must be fannable (convex, or the L shape below).
 */
const prism = (polygon: Array<[number, number]>, height: number, withTop = true): Point[] => {
	const points: Point[] = [];
	for (const [index, [x0, y0]] of polygon.entries()) {
		const [x1, y1] = polygon[(index + 1) % polygon.length]!;
		points.push(
			...quad([
				[x0, y0, 0],
				[x1, y1, 0],
				[x1, y1, height],
				[x0, y0, height]
			])
		);
	}
	for (let index = 1; index + 1 < polygon.length; index++) {
		const [x0, y0] = polygon[0]!;
		const [x1, y1] = polygon[index]!;
		const [x2, y2] = polygon[index + 1]!;
		points.push([x0, y0, 0], [x2, y2, 0], [x1, y1, 0]);
		if (withTop) points.push([x0, y0, height], [x1, y1, height], [x2, y2, height]);
	}
	return points;
};

/** Moves every copy of `corner` along `axis` by a different float-noise amount */
const jitter = (points: Point[], corner: Point, axis: 0 | 1 | 2, amount = 5e-5): Point[] => {
	let seen = 0;
	return points.map((point): Point => {
		if (point.some((value, index) => value !== corner[index])) return point;
		const moved: Point = [...point];
		moved[axis] += ((seen++ % 3) - 1) * amount;
		return moved;
	});
};

const uniqueVertexCount = (vertices: Float32Array) => {
	const seen = new Set<string>();
	for (let corner = 0; corner < vertices.length; corner += 3)
		seen.add(`${vertices[corner]},${vertices[corner + 1]},${vertices[corner + 2]}`);
	return seen.size;
};

/** Directed edges used by more than one triangle: 0 when neighbours agree on which way is out */
const orientationConflicts = (vertices: Float32Array) => {
	const key = (corner: number) =>
		`${vertices[corner * 3]},${vertices[corner * 3 + 1]},${vertices[corner * 3 + 2]}`;
	const seen = new Set<string>();
	let conflicts = 0;
	for (let triangle = 0; triangle < vertices.length / 9; triangle++)
		for (let corner = 0; corner < 3; corner++) {
			const edge = `${key(triangle * 3 + corner)}>${key(triangle * 3 + ((corner + 1) % 3))}`;
			if (seen.has(edge)) conflicts++;
			else seen.add(edge);
		}
	return conflicts;
};

describe('repairMesh', () => {
	it('leaves a watertight mesh alone', () => {
		const input = toArray(cube());
		expect(countOpenEdges(input)).toBe(0);

		const output = repairMesh(input);
		expect(output.length).toBe(input.length);
		expect(countOpenEdges(output)).toBe(0);
		expect(analyzeVertices(output).volume).toBeCloseTo(1, 6);
	});

	it('splits the neighbour edge of a T-junction', () => {
		// The top face gets an extra vertex in the middle of the edge it shares with the right face,
		// whose own (unsplit) edge is left open
		const middle: Point = [1, 0.5, 1];
		const topSplit: Point[] = [
			[0, 0, 1],
			[1, 0, 1],
			middle,
			[0, 0, 1],
			middle,
			[1, 1, 1],
			[0, 0, 1],
			[1, 1, 1],
			[0, 1, 1]
		];
		const input = toArray([
			...topSplit,
			...Object.entries(faces)
				.filter(([name]) => name !== 'top')
				.flatMap(([, face]) => quad(face))
		]);
		expect(countOpenEdges(input)).toBe(3);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(output.length / 9).toBe(input.length / 9 + 1);
		expect(analyzeVertices(output).volume).toBeCloseTo(1, 6);
	});

	it('welds duplicates that differ by float noise, also across a quantization cell border', () => {
		const points = cube();
		// Every triangle sees the corner (1,1,1) at a slightly different place
		let seen = 0;
		const noisy = points.map((point): Point => {
			if (point[0] !== 1 || point[1] !== 1 || point[2] !== 1) return point;
			const offset = ((seen++ % 3) - 1) * 5e-5;
			return [point[0] + offset, point[1], point[2]];
		});
		const input = toArray(noisy);
		expect(countOpenEdges(input)).toBeGreaterThan(0);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(analyzeVertices(output).volume).toBeCloseTo(1, 3);
	});

	it('drops triangles that collapse to an edge or a point', () => {
		const input = toArray([...cube(), [5, 5, 5], [5, 5, 5], [6, 6, 6]]);
		const output = repairMesh(input);
		expect(output.length).toBe(toArray(cube()).length);
		expect(countOpenEdges(output)).toBe(0);
	});

	it('replaces a collinear sliver by splitting the edge it glued together', () => {
		// The top face is cut at the edge midpoint like above, but the seam is closed by a zero-area
		// triangle (left, middle, right) instead of being left open
		const middle: Point = [1, 0.5, 1];
		const topSplit: Point[] = [
			[0, 0, 1],
			[1, 0, 1],
			middle,
			[0, 0, 1],
			middle,
			[1, 1, 1],
			[0, 0, 1],
			[1, 1, 1],
			[0, 1, 1]
		];
		const sliver: Point[] = [[1, 0, 1], [1, 1, 1], middle];
		const input = toArray([
			...topSplit,
			...sliver,
			...Object.entries(faces)
				.filter(([name]) => name !== 'top')
				.flatMap(([, face]) => quad(face))
		]);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(analyzeVertices(output).volume).toBeCloseTo(1, 6);
	});

	it('flips a patch that is wound against its neighbours', () => {
		const points = Object.entries(faces).flatMap(([name, face]): Point[] => {
			const [a, b, c, d] = face;
			// The top face is wound the wrong way round
			return name === 'top' ? [a, c, b, a, d, c] : quad(face);
		});
		const input = toArray(points);
		expect(countOpenEdges(input)).toBe(0);
		expect(analyzeVertices(input).volume).not.toBeCloseTo(1, 3);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(analyzeVertices(output).volume).toBeCloseTo(1, 6);
	});

	it('fills a small planar hole', () => {
		const input = toArray(
			Object.entries(faces)
				.filter(([name]) => name !== 'top')
				.flatMap(([, face]) => quad(face))
		);
		expect(countOpenEdges(input)).toBe(4);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(output.length / 9).toBe(12);
		expect(analyzeVertices(output).volume).toBeCloseTo(1, 6);
	});

	it('leaves a non-planar opening alone', () => {
		// Open box whose rim is bent: a flat patch would not follow the surface
		const lifted = Object.entries(faces)
			.filter(([name]) => name !== 'top')
			.flatMap(([, face]) => quad(face))
			.map(([x, y, z]): Point => (x === 1 && y === 1 && z === 1 ? [x, y, 3] : [x, y, z]));
		const input = toArray(lifted);
		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(4);
	});

	it('returns empty and malformed input as is', () => {
		const empty = new Float32Array(0);
		expect(repairMesh(empty)).toBe(empty);
		const malformed = new Float32Array(10);
		expect(repairMesh(malformed)).toBe(malformed);
	});

	it('does not touch its input and is idempotent', () => {
		const middle: Point = [1, 0.5, 1];
		const input = toArray([
			[0, 0, 1],
			[1, 0, 1],
			middle,
			[0, 0, 1],
			middle,
			[1, 1, 1],
			[0, 0, 1],
			[1, 1, 1],
			[0, 1, 1],
			...cubeWithout('top')
		]);
		const snapshot = [...input];

		const once = repairMesh(input);
		expect([...input]).toEqual(snapshot);
		expect(countOpenEdges(once)).toBe(0);

		const twice = repairMesh(once);
		expect(twice.length).toBe(once.length);
		expect(countOpenEdges(twice)).toBe(0);
		expect(volumeOf(twice)).toBeCloseTo(volumeOf(once), 9);
	});
});

describe('repairMesh: welding', () => {
	it('does not weld vertices that are further apart than the weld radius', () => {
		const corner: Point = [1, 1, 1];
		const welded = repairMesh(toArray(jitter(cube(), corner, 0, 5e-5)));
		const apart = repairMesh(toArray(jitter(cube(), corner, 0, 1e-3)));

		// Noise inside the radius is merged into the 8 corners of the cube and closes the seams;
		// copies of the corner 1e-3 apart are different vertices, so the seams around it stay open
		expect(uniqueVertexCount(welded)).toBe(8);
		expect(countOpenEdges(welded)).toBe(0);
		expect(countOpenEdges(apart)).toBeGreaterThan(0);
	});

	it('welds noise around a cube centred on the origin, along y and z cell borders', () => {
		const centred = translate(cube(), [-0.5, -0.5, -0.5]);
		const noisy = jitter(jitter(centred, [0.5, 0.5, 0.5], 1), [-0.5, -0.5, -0.5], 2);
		const input = toArray(noisy);
		expect(countOpenEdges(input)).toBeGreaterThan(0);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(1, 3);
	});

	it('keeps a plate thinner than any print detail but thicker than the weld radius', () => {
		const plate = cube().map(([x, y, z]): Point => [x, y, z * 1e-3]);
		const input = toArray(plate);

		const output = repairMesh(input);
		expect(output.length).toBe(input.length);
		expect(countOpenEdges(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(1e-3, 6);
	});
});

describe('countOpenEdges', () => {
	it('counts the three edges of a lone triangle', () => {
		expect(
			countOpenEdges(
				toArray([
					[0, 0, 0],
					[1, 0, 0],
					[0, 1, 0]
				])
			)
		).toBe(3);
	});

	it('matches vertices by exact coordinates, like a slicer', () => {
		const shared = toArray([
			[0, 0, 0],
			[1, 0, 0],
			[0, 1, 0],
			[1, 0, 0],
			[1, 1, 0],
			[0, 1, 0]
		]);
		expect(countOpenEdges(shared)).toBe(4);

		const nearlyShared = toArray([
			[0, 0, 0],
			[1, 0, 0],
			[0, 1, 0],
			[1, 0, 0.000_001],
			[1, 1, 0],
			[0, 1, 0.000_001]
		]);
		expect(countOpenEdges(nearlyShared)).toBe(6);
	});

	it('does not count edges shared by four triangles as open', () => {
		const touching = toArray([...cube(), ...translate(cube(), [1, 1, 0])]);
		expect(countOpenEdges(touching)).toBe(0);
	});
});

describe('repairMesh: T-junction chains', () => {
	it('splits the neighbour edge at several vertices in order along the edge', () => {
		// Top face cut at two points of the edge it shares with the right face (still one edge there)
		const first: Point = [1, 1 / 3, 1];
		const second: Point = [1, 2 / 3, 1];
		const topSplit: Point[] = [
			[0, 0, 1],
			[1, 0, 1],
			first,
			[0, 0, 1],
			first,
			second,
			[0, 0, 1],
			second,
			[1, 1, 1],
			[0, 0, 1],
			[1, 1, 1],
			[0, 1, 1]
		];
		const input = toArray([...topSplit, ...cubeWithout('top')]);
		expect(countOpenEdges(input)).toBe(4);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(output.length / 9).toBe(input.length / 9 + 2);
		expect(volumeOf(output)).toBeCloseTo(1, 6);
	});

	it('repairs a seam that is subdivided differently on both sides', () => {
		const onTop: Point = [1, 0.25, 1];
		const onRight: Point = [1, 0.75, 1];
		// top: (a, b, c) with edge b-c split at `onTop`; right: (a, c, d) with edge c-d split at `onRight`
		const top: Point[] = [
			[0, 0, 1],
			[1, 0, 1],
			onTop,
			[0, 0, 1],
			onTop,
			[1, 1, 1],
			[0, 0, 1],
			[1, 1, 1],
			[0, 1, 1]
		];
		const right: Point[] = [
			[1, 0, 0],
			[1, 1, 0],
			[1, 1, 1],
			[1, 0, 0],
			[1, 1, 1],
			onRight,
			[1, 0, 0],
			onRight,
			[1, 0, 1]
		];
		const rest = Object.entries(faces)
			.filter(([name]) => name !== 'top' && name !== 'right')
			.flatMap(([, face]) => quad(face));
		const input = toArray([...top, ...right, ...rest]);
		expect(countOpenEdges(input)).toBeGreaterThan(0);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(1, 6);
	});
});

describe('repairMesh: orientation', () => {
	it('settles on the winding of the majority when most of a piece is flipped', () => {
		const wrongFaces = new Set(['top', 'front', 'back', 'left']);
		const input = toArray(
			Object.entries(faces).flatMap(([name, face]) =>
				wrongFaces.has(name) ? wrongQuad(face) : quad(face)
			)
		);
		expect(orientationConflicts(input)).toBeGreaterThan(0);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(output.length).toBe(input.length);
		expect(orientationConflicts(output)).toBe(0);
		expect(Math.abs(volumeOf(output))).toBeCloseTo(1, 6);
	});

	it('orients separate pieces independently', () => {
		const flippedTop = Object.entries(faces).flatMap(([name, face]) =>
			name === 'top' ? wrongQuad(face) : quad(face)
		);
		const input = toArray([...cube(), ...translate(flippedTop, [5, 0, 0])]);
		expect(orientationConflicts(input)).toBeGreaterThan(0);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(orientationConflicts(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(2, 6);
	});

	it('leaves two parts touching along a line as they are', () => {
		const input = toArray([...cube(), ...translate(cube(), [1, 1, 0])]);

		const output = repairMesh(input);
		expect(output.length).toBe(input.length);
		expect(countOpenEdges(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(2, 6);
	});
});

describe('repairMesh: spurious triangles', () => {
	it('removes a fin hanging off an edge of a closed solid', () => {
		// Third user of the front/top edge, with two edges of its own that nothing else touches
		const fin: Point[] = [
			[0, 0, 1],
			[1, 0, 1],
			[0.5, -1, 2]
		];
		const input = toArray([...cube(), ...fin]);
		expect(countOpenEdges(input)).toBe(2);

		const output = repairMesh(input);
		expect(output.length).toBe(toArray(cube()).length);
		expect(countOpenEdges(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(1, 6);
	});

	it('removes a floating triangle that is not attached to the surface', () => {
		const input = toArray([...cube(), [5, 5, 5], [6, 5, 5], [5, 6, 5]]);
		expect(countOpenEdges(input)).toBe(3);

		const output = repairMesh(input);
		expect(output.length).toBe(toArray(cube()).length);
		expect(countOpenEdges(output)).toBe(0);
	});
});

describe('repairMesh: hole filling', () => {
	const square: Array<[number, number]> = [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, 1]
	];

	it('fills a triangular hole', () => {
		const input = toArray(prism(square.slice(0, 3), 1, false));
		expect(countOpenEdges(input)).toBe(3);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(0.5, 6);
	});

	it('fills a concave (L-shaped) hole without covering the notch', () => {
		const lShape: Array<[number, number]> = [
			[0, 0],
			[2, 0],
			[2, 1],
			[1, 1],
			[1, 2],
			[0, 2]
		];
		const input = toArray(prism(lShape, 1, false));
		expect(countOpenEdges(input)).toBe(6);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		// L area is 3; a patch that bridged the notch would add volume
		expect(volumeOf(output)).toBeCloseTo(3, 6);
	});

	it('fills several holes of one mesh', () => {
		const input = toArray([...cubeWithout('top'), ...translate(cubeWithout('top'), [3, 0, 0])]);
		expect(countOpenEdges(input)).toBe(8);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(volumeOf(output)).toBeCloseTo(2, 6);
	});

	it('fills two holes that meet in a single vertex', () => {
		// The lid is two triangles touching in the centre; the left and right triangles are missing
		const centre: Point = [0.5, 0.5, 1];
		const input = toArray([
			...cubeWithout('top'),
			[0, 0, 1],
			[1, 0, 1],
			centre,
			[1, 1, 1],
			[0, 1, 1],
			centre
		]);
		expect(countOpenEdges(input)).toBe(6);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(0);
		expect(output.length / 9).toBe(input.length / 9 + 2);
		expect(volumeOf(output)).toBeCloseTo(1, 6);
	});

	it('leaves a hole with too many edges open', () => {
		const count = 20;
		const circle = Array.from({ length: count }, (_, index): [number, number] => [
			Math.cos((2 * Math.PI * index) / count),
			Math.sin((2 * Math.PI * index) / count)
		]);
		const input = toArray(prism(circle, 1, false));
		expect(countOpenEdges(input)).toBe(count);

		const output = repairMesh(input);
		expect(countOpenEdges(output)).toBe(count);
		expect(output.length).toBe(input.length);
	});
});

describe('repairMesh: retry with every touching vertex allowed to split', () => {
	it('adopts the loose result when it ends up with fewer open edges', () => {
		// Found by random search over damaged cubes: the careful pass alone leaves 6 open edges
		const input = toArray([
			[0, 0, 0],
			[1, 1, 0],
			[1, 0, 0],
			[0, 0, 1],
			[1, 0, 1],
			[1, 1, 1],
			[0, 0, 1],
			[1, 1, 1],
			[0, 1, 1],
			[0, 0, 0],
			[1, 0, 0],
			[1, 0, 1],
			[0, 0, 0],
			[1, 0, 1],
			[0, 0, 1],
			[0, 0, 0],
			[0, 1, 1],
			[0, 1, 0],
			[0, 0, 0],
			[0, 0, 1],
			[0, 1, 1],
			[1, 0, 0],
			[1, 1, 1],
			[1, 0, 1]
		]);
		expect(countOpenEdges(input)).toBe(6);

		expect(countOpenEdges(repairMesh(input))).toBe(0);
	});

	it('keeps the careful result when the loose one is no better', () => {
		// Same bent opening as in the non-planar test: nothing may be eaten away trying to close it
		const lifted = cubeWithout('top').map(([x, y, z]): Point =>
			x === 1 && y === 1 && z === 1 ? [x, y, 3] : [x, y, z]
		);
		const input = toArray(lifted);

		const output = repairMesh(input);
		expect(output.length).toBe(input.length);
		expect(countOpenEdges(output)).toBe(4);
	});

	it('repairs an indexed mesh like its expanded soup', () => {
		// Unique corners with duplicated seam vertices (float noise) referenced through an index
		const soup = cube();
		const positions: number[] = [];
		const index: number[] = [];
		for (const [x, y, z] of soup) {
			index.push(positions.length / 3);
			positions.push(x, y, z + (index.length % 2 === 0 ? 1e-5 : 0));
		}

		const fromIndexed = repairMesh(new Float32Array(positions), new Uint32Array(index));
		const fromSoup = repairMesh(new Float32Array(positions));
		expect(fromIndexed).toEqual(fromSoup);
		expect(countOpenEdges(fromIndexed)).toBe(0);
		expect(volumeOf(fromIndexed)).toBeCloseTo(1, 3);
	});
});
