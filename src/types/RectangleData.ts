import { z } from 'zod';

import { ELEMENT_DRAGGABLE, ELEMENT_OPACITY, RECTANGLE_COLOR } from '$lib/constants';

/**
 * Rectangular THT (Through-Hole Technology) component data model
 *
 * Represents rectangular or oblong THT components such as:
 * - Terminal blocks
 * - Pin headers
 * - Rectangular relays
 * - DIP IC sockets
 * - Fuse holders
 *
 * @remarks
 * **Dual Nature - Geometry & Rendering:**
 *
 * This type serves two purposes:
 * 1. **Geometric data** for 3D mesh generation (width, height, depth, rotation, x, y)
 * 2. **Rendering properties** for Konva.js canvas display (fill, draggable, opacity)
 *
 * Konva-specific properties (fill, draggable, opacity) are excluded during JSON
 * serialization via `ELEMENT_SKIP_JSON_PROPERTIES` to keep persisted data clean.
 *
 * **Coordinate System:**
 * - Position (x, y) represents the **center** of the rectangle
 * - Coordinates are in millimeters on the PCB surface
 * - Origin (0, 0) is at the top-left corner of the panel
 * - Y-axis increases downward (canvas convention)
 * - Rotation is center-based, not corner-based
 *
 * **Rotation Feature (v1.10.0+):**
 * - Full 360° rotation support (0-359 degrees)
 * - Rotates around the rectangle's center point
 * - In 2D canvas: Konva applies rotation directly
 * - In 3D mesh: Rotation angle is **negated** to account for Y-axis flip
 *   ```typescript
 *   box.rotateZ((-rectangle.rotation * Math.PI) / 180);
 *   ```
 * - Boundary limiting uses AABB (Axis-Aligned Bounding Box) calculation
 *
 * **3D Mesh Generation:**
 * - Rectangle becomes a rectangular hole in the holder
 * - Width and height are enlarged by `printTolerance * 2` for better fit
 * - Depth determines how deep the component extends into the holder
 * - Rotation is applied after positioning for correct orientation
 */
export const RectangleData = z.object({
	/** Component depth/height in millimeters (how far it extends above PCB) */
	depth: z.number(),

	/** Unique identifier for this rectangle instance (UUID) */
	id: z.string(),

	/** X coordinate of rectangle center in millimeters (from left edge of panel) */
	x: z.number(),

	/** Y coordinate of rectangle center in millimeters (from top edge of panel) */
	y: z.number(),

	/** Rectangle width in millimeters (X-axis dimension before rotation) */
	width: z.number(),

	/** Rectangle height in millimeters (Y-axis dimension before rotation) */
	height: z.number(),

	/**
	 * Rotation angle in degrees (0-359), applied clockwise around center
	 * - 0° = aligned with panel axes
	 * - 90° = rotated quarter turn clockwise
	 * - Defaults to 0° (no rotation)
	 * - Constrained to [0, 359] range by Zod validator
	 */
	rotation: z.number().min(0).max(359).default(0),

	/** Konva.js fill color (excluded from JSON serialization) */
	fill: z.literal(RECTANGLE_COLOR).default(RECTANGLE_COLOR),

	/** Konva.js draggable flag (excluded from JSON serialization) */
	draggable: z.literal(ELEMENT_DRAGGABLE).default(ELEMENT_DRAGGABLE),

	/** Konva.js opacity value 0-1 (excluded from JSON serialization) */
	opacity: z.literal(ELEMENT_OPACITY).default(ELEMENT_OPACITY)
});
export type RectangleData = z.infer<typeof RectangleData>;
