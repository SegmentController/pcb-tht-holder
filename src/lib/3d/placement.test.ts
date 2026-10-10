import { describe, expect, it } from 'vitest';

import { BOTTOM_THICKNESS, POSITIVE_BASE_THICKNESS, positivePlacementOffset } from './placement';

describe('positivePlacementOffset', () => {
	// Holder: pcb 1.6 + component height 8 + bottom 2
	const holderDepth = 1.6 + 8 + BOTTOM_THICKNESS;
	const pcbThickness = 1.6;

	it('seats the flipped PCB on the holes floor at distance 0', () => {
		const offset = positivePlacementOffset({ holderDepth, pcbThickness, distance: 0 });
		const pillarTip = offset - (POSITIVE_BASE_THICKNESS / 2 + 8);
		expect(pillarTip).toBeCloseTo(-holderDepth / 2 + BOTTOM_THICKNESS, 6);
	});

	it('puts the PCB top flush with the holder rim at distance 0', () => {
		const offset = positivePlacementOffset({ holderDepth, pcbThickness, distance: 0 });
		const plateUnderside = offset - POSITIVE_BASE_THICKNESS / 2;
		expect(plateUnderside + pcbThickness).toBeCloseTo(holderDepth / 2, 6);
	});

	it('lifts the PCB by the distance', () => {
		const seated = positivePlacementOffset({ holderDepth, pcbThickness, distance: 0 });
		expect(positivePlacementOffset({ holderDepth, pcbThickness, distance: 12 })).toBeCloseTo(
			seated + 12,
			6
		);
	});
});
