import { z } from 'zod';

import { CIRCLE_COLOR, ELEMENT_DRAGGABLE, ELEMENT_OPACITY } from '$lib/constants';

/**
 * Circular THT (Through-Hole Technology) component data model
 *
 * Represents round THT components such as:
 * - Electrolytic capacitors
 * - Cylindrical relays
 * - Round terminal blocks
 * - LED holders
 *
 * @remarks
 * **Dual Nature - Geometry & Rendering:**
 *
 * This type serves two purposes:
 * 1. **Geometric data** for 3D mesh generation (radius, depth, x, y)
 * 2. **Rendering properties** for Konva.js canvas display (fill, draggable, opacity)
 *
 * Konva-specific properties (fill, draggable, opacity) are excluded during JSON
 * serialization via `ELEMENT_SKIP_JSON_PROPERTIES` to keep persisted data clean.
 *
 * **Coordinate System:**
 * - Position (x, y) represents the **center** of the circle
 * - Coordinates are in millimeters on the PCB surface
 * - Origin (0, 0) is at the top-left corner of the panel
 * - Y-axis increases downward (canvas convention)
 *
 * **3D Mesh Generation:**
 * - Circle becomes a cylindrical hole in the holder
 * - Radius is enlarged by `printTolerance` for better fit
 * - Depth determines how deep the component extends into the holder
 */
export const CircleData = z.object({
	/** Component depth/height in millimeters (how far it extends above PCB) */
	depth: z.number(),

	/** Unique identifier for this circle instance (UUID) */
	id: z.string(),

	/** X coordinate of circle center in millimeters (from left edge of panel) */
	x: z.number(),

	/** Y coordinate of circle center in millimeters (from top edge of panel) */
	y: z.number(),

	/** Circle radius in millimeters (half of component diameter) */
	radius: z.number(),

	/** Konva.js fill color (excluded from JSON serialization) */
	fill: z.literal(CIRCLE_COLOR).default(CIRCLE_COLOR),

	/** Konva.js draggable flag (excluded from JSON serialization) */
	draggable: z.literal(ELEMENT_DRAGGABLE).default(ELEMENT_DRAGGABLE),

	/** Konva.js opacity value 0-1 (excluded from JSON serialization) */
	opacity: z.literal(ELEMENT_OPACITY).default(ELEMENT_OPACITY)
});
export type CircleData = z.infer<typeof CircleData>;
