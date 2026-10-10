/**
 * Mesh placement constants and helpers. Dependency-free on purpose: the 3D view imports this
 * without pulling in the CSG stack of `mesh.ts`.
 */

export const BOTTOM_THICKNESS = 2;
export const POSITIVE_BASE_THICKNESS = 2;

interface PositivePlacement {
	/** Depth of the main holder (also for the hollow one: it is sliced from the main solid) */
	holderDepth: number;
	pcbThickness: number;
	/** Extra gap above the installed position, mm */
	distance: number;
}

/**
 * Scene Y offset of the flipped positive (PCB) mesh. At `distance` 0 the PCB is in its installed
 * position: top flush with the holder rim, pillar tips on the floor of the component holes.
 *
 * CSG results live in the frame of their first operand, so the holder is centered on Z
 * ([-D/2, D/2], rim at D/2) while the positive mesh is not: its base plate spans
 * [-BASE/2, BASE/2] and the pillars extend beyond it. Flipped, the plate underside is at
 * `offset - BASE/2`.
 */
export const positivePlacementOffset = ({
	holderDepth,
	pcbThickness,
	distance
}: PositivePlacement) => holderDepth / 2 - pcbThickness + POSITIVE_BASE_THICKNESS / 2 + distance;
