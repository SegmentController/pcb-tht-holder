/**
 * Runtime type guard functions for discriminating element types
 *
 * Provides type-safe discrimination between CircleData, RectangleData, and LegData
 * at runtime. These guards enable TypeScript to narrow union types based on structural
 * properties, providing compile-time safety for operations on polymorphic elements.
 *
 * @remarks
 * **Why use type guards instead of property checks?**
 *
 * ❌ **Bad** (no type narrowing):
 * ```typescript
 * if ('radius' in element) {
 *   element.radius; // TypeScript doesn't narrow the type
 * }
 * ```
 *
 * ✅ **Good** (type narrowing):
 * ```typescript
 * if (isCircle(element)) {
 *   element.radius; // TypeScript knows element is CircleData
 * }
 * ```
 *
 * **Design principle:**
 * Type guards use structural discrimination based on unique properties:
 * - Circles have unique `radius` property
 * - Rectangles have `width`, `height`, AND `depth` properties
 * - Legs have `width` and `height` but NO `depth` property
 *
 * This avoids the need for explicit type discriminator fields (like `type: 'circle'`)
 * and leverages the natural structural differences between component types.
 */

import type { CircleData } from './CircleData';
import type { LegData } from './LegData';
import type { RectangleData } from './RectangleData';

/**
 * Union type representing any placeable element on the PCB canvas
 *
 * Used throughout the application for operations that work with any element type,
 * such as selection, movement, deletion, and context menu generation.
 */
export type GenericElement = CircleData | RectangleData | LegData;

/**
 * Type guard to check if an element is a Circle
 *
 * Discriminates based on the unique `radius` property that only circles possess.
 *
 * @param element - The element to check
 * @returns True if element is CircleData, with type narrowing
 */
export const isCircle = (element: GenericElement): element is CircleData => {
	return 'radius' in element;
};

/**
 * Type guard to check if an element is a Rectangle
 *
 * Discriminates based on the combination of `width`, `height`, AND `depth` properties.
 * The presence of all three distinguishes rectangles from legs (which lack depth).
 *
 * @param element - The element to check
 * @returns True if element is RectangleData, with type narrowing
 */
export const isRectangle = (element: GenericElement): element is RectangleData => {
	return 'width' in element && 'height' in element && 'depth' in element;
};

/**
 * Type guard to check if an element is a Leg
 *
 * Discriminates based on having `width` and `height` but LACKING `depth`.
 * Legs are support structures that don't need depth specification - they always
 * extend from the bottom of the holder to the PCB surface (SMD height).
 *
 * @param element - The element to check
 * @returns True if element is LegData, with type narrowing
 */
export const isLeg = (element: GenericElement): element is LegData => {
	return 'width' in element && 'height' in element && !('depth' in element);
};
