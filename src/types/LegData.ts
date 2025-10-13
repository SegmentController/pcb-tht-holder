import { z } from 'zod';

import { ELEMENT_DRAGGABLE, ELEMENT_OPACITY, LEG_COLOR } from '$lib/constants';

/**
 * Default visual size for leg elements in millimeters
 *
 * Defines the default width and height when creating new leg elements.
 * Users can adjust dimensions after creation to fit their specific needs.
 */
export const LEG_SIZE = 2;

/**
 * Support leg data model for PCB holder stabilization
 *
 * Represents rectangular support structures that:
 * - Hold the PCB at the correct height during soldering
 * - Provide stability to prevent PCB movement
 * - Fill gaps between the holder and PCB surface
 * - Are placed in areas without components
 *
 * @remarks
 * **Key Differences from Rectangles:**
 *
 * Unlike CircleData and RectangleData (which represent THT components with variable
 * depth), legs are support structures with **fixed depth** determined by SMD height:
 *
 * - **No `depth` property**: Legs always extend from holder bottom to PCB surface
 * - **Fixed height**: Always equals `panelSettings.smdHeight`
 * - **Purpose**: Structural support, not component placement
 * - **3D generation**: Created as ADDITION operations (solid blocks) instead of holes
 *
 * **Type Discrimination:**
 * The absence of `depth` property is used by `isLeg()` type guard to distinguish
 * legs from rectangles (both have width and height).
 *
 * **Coordinate System:**
 * - Position (x, y) represents the **top-left corner** (unlike circles/rectangles)
 * - Coordinates are in millimeters on the PCB surface
 * - Origin (0, 0) is at the top-left corner of the panel
 * - Y-axis increases downward (canvas convention)
 * - No rotation support (legs are always axis-aligned)
 *
 * **3D Mesh Generation:**
 * - Legs are **added** to the mesh (ADDITION operation)
 * - Height is always `panelSettings.smdHeight`
 * - Positioned to fill the gap between holder bottom and PCB
 * - Not affected by `printTolerance` (support structures, not component holes)
 *
 * **Placement Strategy:**
 * Place legs in areas where:
 * - No THT components are present
 * - PCB needs support (large empty areas)
 * - Holder edges are far from PCB (weak points)
 *
 * Typically 2-4 legs are sufficient for most PCB designs.
 */
export const LegData = z.object({
	/** Unique identifier for this leg instance (UUID) */
	id: z.string(),

	/** X coordinate of top-left corner in millimeters (from left edge of panel) */
	x: z.number(),

	/** Y coordinate of top-left corner in millimeters (from top edge of panel) */
	y: z.number(),

	/** Leg width in millimeters (X-axis dimension) */
	width: z.number(),

	/** Leg height in millimeters (Y-axis dimension) */
	height: z.number(),

	/** Konva.js fill color (excluded from JSON serialization) */
	fill: z.literal(LEG_COLOR).default(LEG_COLOR),

	/** Konva.js draggable flag (excluded from JSON serialization) */
	draggable: z.literal(ELEMENT_DRAGGABLE).default(ELEMENT_DRAGGABLE),

	/** Konva.js opacity value 0-1 (excluded from JSON serialization) */
	opacity: z.literal(ELEMENT_OPACITY).default(ELEMENT_OPACITY)
});
export type LegData = z.infer<typeof LegData>;
