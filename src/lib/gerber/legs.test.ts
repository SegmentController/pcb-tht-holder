import { describe, expect, it } from 'vitest';

import { LEG_SIZE } from '$types/LegData';

import { copperTop, drillNpth, drillPth, edgeCuts, silkTop } from './fixtures';
import { type Keepout, keepoutsFromRecords, placeLegs, suggestLegs } from './legs';
import { readFabPackage } from './package';
import { defaultToolKeys, planElements } from './plan';

const clearanceOf = (leg: { x: number; y: number }, keepouts: readonly Keepout[]) =>
	Math.min(
		...keepouts.map((box) => {
			const dx = Math.max(box.minX - (leg.x + LEG_SIZE), 0, leg.x - box.maxX);
			const dy = Math.max(box.minY - (leg.y + LEG_SIZE), 0, leg.y - box.maxY);
			return Math.hypot(dx, dy);
		})
	);

describe('placeLegs', () => {
	const panel = { width: 40, height: 30 };

	it('puts four legs in an empty panel at its corners, half a millimetre from the edge', () => {
		const legs = placeLegs(panel, []);
		expect(legs).toHaveLength(4);
		for (const leg of legs) {
			expect(leg.x).toBeGreaterThanOrEqual(0.5);
			expect(leg.y).toBeGreaterThanOrEqual(0.5);
			expect(leg.x + LEG_SIZE).toBeLessThanOrEqual(39.5);
			expect(leg.y + LEG_SIZE).toBeLessThanOrEqual(29.5);
		}
		expect(new Set(legs.map((leg) => Math.round(leg.x / 10))).size).toBeGreaterThan(1);
	});

	it('keeps away from parts and holes and spreads the legs', () => {
		// a block of parts in the middle and a row of holes along the top
		const keepouts: Keepout[] = [
			{ minX: 12, maxX: 28, minY: 8, maxY: 22 },
			{ minX: 2, maxX: 38, minY: 2, maxY: 4 }
		];
		const legs = placeLegs(panel, keepouts);
		expect(legs.length).toBeGreaterThanOrEqual(3);
		for (const leg of legs) expect(clearanceOf(leg, keepouts)).toBeGreaterThan(1.5);
		const xs = legs.map((leg) => leg.x);
		expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
	});

	it('returns fewer legs, or none, when there is no room', () => {
		const crowded: Keepout[] = [{ minX: 0, maxX: 40, minY: 0, maxY: 30 }];
		expect(placeLegs(panel, crowded)).toEqual([]);
		const slit: Keepout[] = [{ minX: 0, maxX: 40, minY: 6, maxY: 30 }];
		const legs = placeLegs(panel, slit);
		expect(legs.length).toBeGreaterThan(0);
		for (const leg of legs) expect(leg.y + LEG_SIZE).toBeLessThanOrEqual(6);
	});

	it('does not pack legs closer than two leg sizes', () => {
		const legs = placeLegs({ width: 10, height: 10 }, [], { count: 4 });
		for (const [index, leg] of legs.entries())
			for (const other of legs.slice(index + 1))
				expect(Math.hypot(leg.x - other.x, leg.y - other.y)).toBeGreaterThanOrEqual(LEG_SIZE * 2);
	});
});

describe('keepoutsFromRecords', () => {
	it('turns flashes into boxes and samples strokes along their length', () => {
		const boxes = keepoutsFromRecords([
			{ type: 'flash', x: 5, y: 5, width: 2, height: 1, shape: 'R' },
			{
				type: 'draw',
				points: [
					{ x: 0, y: 0 },
					{ x: 10, y: 0 }
				],
				width: 0.2
			}
		]);
		expect(boxes[0]).toEqual({ minX: 4, maxX: 6, minY: 4.5, maxY: 5.5 });
		expect(boxes.length).toBeGreaterThan(15);
		expect(boxes[5].maxX - boxes[5].minX).toBeCloseTo(0.2, 6);
	});

	it('can skip records', () => {
		const boxes = keepoutsFromRecords(
			[{ type: 'flash', x: 5, y: 5, width: 2, height: 1, shape: 'R', function: 'ComponentPad' }],
			(record) => record.type === 'flash' && record.function === 'ComponentPad'
		);
		expect(boxes).toEqual([]);
	});
});

describe('suggestLegs on the sample board', () => {
	const pkg = readFabPackage([
		{ name: 'F_Cu.gbr', text: copperTop },
		{ name: 'F_SilkScreen.gbr', text: silkTop },
		{ name: 'Edge_Cuts.gbr', text: edgeCuts },
		{ name: 'drill-L1-L2.drl', text: drillPth },
		{ name: 'drill_npth.drl', text: drillNpth }
	]);
	const plan = planElements(pkg.holes, pkg.outline, {
		toolKeys: defaultToolKeys(pkg.tools),
		groupDistance: 2.6,
		minMargin: 0.3,
		circleDepth: 5,
		rectangleDepth: 5
	});

	it('collects the SMD pads and silkscreen of the package', () => {
		expect(pkg.partKeepouts?.length).toBeGreaterThan(50);
	});

	it('stays away from SMD parts, every hole and the planned elements', () => {
		const legs = suggestLegs(plan, pkg.holes, pkg.partKeepouts ?? []);
		expect(legs.length).toBeGreaterThanOrEqual(2);
		const shift = (box: Keepout) => ({
			minX: box.minX - plan.origin.x,
			maxX: box.maxX - plan.origin.x,
			minY: box.minY - plan.origin.y,
			maxY: box.maxY - plan.origin.y
		});
		const pads = (pkg.partKeepouts ?? []).map((box) => shift(box));
		const holes = pkg.holes.map((hole) =>
			shift({
				minX: hole.x - hole.diameter / 2,
				maxX: hole.x + hole.diameter / 2,
				minY: hole.y - hole.diameter / 2,
				maxY: hole.y + hole.diameter / 2
			})
		);
		for (const leg of legs) {
			expect(clearanceOf(leg, pads)).toBeGreaterThan(0.3);
			expect(clearanceOf(leg, holes)).toBeGreaterThan(0.3);
		}
	});
});
