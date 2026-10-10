import { Box3, Vector3 } from 'three';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { describe, expect, it } from 'vitest';

import type { RenderableProject } from '$types/Project';

import fontData from '../../../public/roboto_regular.json';
import { createMeshSession, generateMesh, MeshCancelledError, partitionDisjoint } from './mesh';
import { analyzeVertices, makeProject } from './meshTestUtilities';
import { POSITIVE_BASE_THICKNESS } from './placement';

/**
 * Golden regression tests for the CSG pipeline.
 *
 * Triangle counts legitimately vary with CSG strategy (batching, welding), so the invariants are
 * the solid's signed volume and bounding box. The expected values were captured from the original
 * (unbatched, per-component) pipeline. The hollow volumes with print tolerance differ by a few mm³
 * from it on purpose: the hollow holder is now sliced from the main solid, so component holes that
 * poke into the rim (hole enlarged by the tolerance) are cut there exactly like in the main holder.
 * Pillars of the (display-only) positive mesh sink 1 mm into its base plate, so pillars overhanging
 * the plate edge gain a sliver of volume.
 */

const font = new Font(fontData as unknown as ConstructorParameters<typeof Font>[0]);

type Expected = { volume: number; size: [number, number, number] };
const expectMesh = (vertices: Float32Array, expected: Expected) => {
	const actual = analyzeVertices(vertices);
	expect(vertices.length % 9).toBe(0);
	expect(actual.volume).toBeCloseTo(expected.volume, 0);
	for (const [index, value] of expected.size.entries())
		expect(actual.size[index]).toBeCloseTo(value, 1);
};

const cases: Array<{
	name: string;
	project: RenderableProject;
	hidden: number;
	main: Expected;
	hollow: Expected;
	positive: Expected;
}> = [
	{
		name: 'simple project with label',
		project: {
			panelSettings: { width: 100, height: 75, pcbThickness: 1.6, smdHeight: 3, printTolerance: 0 },
			zoom: 100,
			label: 'Teszt',
			circles: [{ id: 'c1', x: 30, y: 30, radius: 5, depth: 8 }] as RenderableProject['circles'],
			rectangles: [
				{ id: 'r1', x: 60, y: 40, width: 20, height: 10, depth: 6, rotation: 0 }
			] as RenderableProject['rectangles'],
			legs: [{ id: 'l1', x: 10, y: 60, width: 6, height: 6 }] as RenderableProject['legs']
		},
		hidden: 0,
		main: { volume: 58_861.48, size: [104, 79.5, 11.6] },
		hollow: { volume: 18_203.83, size: [104, 79, 6.6] },
		positive: { volume: 16_825.74, size: [100, 75, 10] }
	},
	{
		name: 'rotated rectangles, legs and label',
		project: makeProject(7, 4, 6, 4, 'Rot 45', 0.2),
		hidden: 2,
		main: { volume: 115_224.52, size: [123.6, 94.1, 14.6] },
		hollow: { volume: 24_174.37, size: [123.6, 93.6, 6.6] },
		positive: { volume: 26_926.11, size: [120, 90, 13] }
	},
	{
		name: 'busy panel (many components, some overlapping)',
		project: makeProject(11, 14, 16, 10, 'Busy panel', 0.2),
		hidden: 2,
		main: { volume: 110_573.78, size: [123.6, 94.1, 14.6] },
		hollow: { volume: 22_344.79, size: [123.6, 93.6, 6.6] },
		positive: { volume: 34_712.18, size: [120, 90, 13] }
	},
	{
		name: 'print tolerance without label',
		project: makeProject(3, 6, 8, 5, '', 0.2),
		hidden: 2,
		main: { volume: 114_044.28, size: [123.6, 93.6, 14.6] },
		hollow: { volume: 24_439.42, size: [123.6, 93.6, 6.6] },
		positive: { volume: 27_741.83, size: [120, 90, 13] }
	}
];

describe('generateMesh', () => {
	for (const testCase of cases)
		it(`keeps volume and bounds: ${testCase.name}`, async () => {
			const result = await generateMesh(testCase.project, font);

			expectMesh(result.main.vertexArray, testCase.main);
			expectMesh(result.hollow.vertexArray, testCase.hollow);
			expectMesh(result.positive!.vertexArray, testCase.positive);
		}, 60_000);

	it('reports progress up to the announced total', async () => {
		const calls: Array<[number, number]> = [];
		await generateMesh(cases[0]!.project, font, (current, total) => calls.push([current, total]));

		expect(calls.length).toBeGreaterThan(0);
		const [lastCurrent, lastTotal] = calls.at(-1)!;
		expect(lastCurrent).toBe(lastTotal);
		expect(new Set(calls.map(([, total]) => total)).size).toBe(1);
	}, 60_000);
});

describe('mesh frames (placement of the PCB relative to the holder)', () => {
	it('keeps the holder centered on Z and the positive mesh in its base plate frame', async () => {
		// componentHeight 8 (tallest circle), pcbThickness 1.6
		const result = await generateMesh(cases[0]!.project, font);
		const main = analyzeVertices(result.main.vertexArray);
		const hollow = analyzeVertices(result.hollow.vertexArray);
		const positive = analyzeVertices(result.positive!.vertexArray);

		// Holder centered: rim at +depth/2, also for the hollow variant (sliced from the main solid)
		expect(main.min[2]).toBeCloseTo(-result.main.dimensions.depth / 2, 3);
		expect(main.max[2]).toBeCloseTo(result.main.dimensions.depth / 2, 3);
		expect(hollow.max[2]).toBeCloseTo(main.max[2]!, 3);

		// Positive: base plate [-BASE/2, BASE/2], pillars extend up by the component height
		expect(positive.min[2]).toBeCloseTo(-POSITIVE_BASE_THICKNESS / 2, 3);
		expect(positive.max[2]).toBeCloseTo(POSITIVE_BASE_THICKNESS / 2 + 8, 3);
	}, 60_000);
});

describe('createMeshSession', () => {
	const project = cases[1]!.project;

	it('knows hidden legs and total operations before generating anything', () => {
		const session = createMeshSession(project, font);
		expect(session.hiddenLegsCount).toBe(2);
		expect(session.totalOperations).toBeGreaterThan(0);
	});

	it('memoizes variants and can start with the derived hollow variant', async () => {
		const session = createMeshSession(project, font);
		const hollow = await session.generate('hollow');
		expect(await session.generate('hollow')).toBe(hollow);

		const main = await session.generate('main');
		expectMesh(main.vertexArray, cases[1]!.main);
		expectMesh(hollow.vertexArray, cases[1]!.hollow);
	}, 60_000);

	it('only reports the steps that are still pending for later variants', async () => {
		const session = createMeshSession(project, font);
		const mainTotals: number[] = [];
		const hollowTotals: number[] = [];

		await session.generate('main', (_, total) => mainTotals.push(total));
		await session.generate('hollow', (_, total) => hollowTotals.push(total));

		// Hollow reuses the shared solid built for main: strictly fewer steps than main
		expect(hollowTotals[0]).toBeLessThan(mainTotals[0]!);
		expect(mainTotals[0]! + hollowTotals[0]!).toBeLessThan(session.totalOperations + 1);
	}, 60_000);

	it('cancels between operations and can be retried', async () => {
		const session = createMeshSession(project, font);
		await expect(session.generate('main', undefined, () => true)).rejects.toBeInstanceOf(
			MeshCancelledError
		);

		const main = await session.generate('main');
		expectMesh(main.vertexArray, cases[1]!.main);
	}, 60_000);
});

describe('partitionDisjoint', () => {
	const box = (x: number, y = 0, size = 2) =>
		new Box3(new Vector3(x, y, 0), new Vector3(x + size, y + size, 1));

	it('keeps pairwise disjoint boxes in one group', () => {
		expect(partitionDisjoint([box(0), box(10), box(20)])).toEqual([[0, 1, 2]]);
	});

	it('separates overlapping and touching boxes', () => {
		// 0 and 1 overlap, 2 touches 0 and overlaps 1
		expect(partitionDisjoint([box(0), box(1), box(2)])).toEqual([[0], [1], [2]]);
	});

	it('places a box into the first group it does not collide with', () => {
		// 0 and 1 overlap each other, the third is clear of both
		expect(partitionDisjoint([box(0), box(1), box(1.5, 5)])).toEqual([[0, 2], [1]]);
	});

	it('returns no groups for no boxes', () => {
		expect(partitionDisjoint([])).toEqual([]);
	});
});
