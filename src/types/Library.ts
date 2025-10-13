import { z } from 'zod';

/**
 * Component library types for saving and reusing common THT component configurations
 *
 * The library feature allows users to save frequently used component specifications
 * (dimensions, depth) with custom names for quick reuse across multiple projects.
 * This is particularly useful for standard components like:
 * - Common relay sizes (e.g., "Relay 5V 10A")
 * - Standard capacitor footprints (e.g., "Cap 10mm")
 * - Typical resistor sizes (e.g., "Resistor 1/4W")
 *
 * @remarks
 * Library items are stored in browser localStorage and persist across sessions.
 * They exclude position and visual properties (x, y, fill, opacity) which are
 * project-specific.
 */

/**
 * Discriminated union representing a saved component in the library
 *
 * Uses a type discriminator field to enable type-safe access to component-specific
 * properties. Each component type stores only its essential geometric properties:
 *
 * - **Circle**: radius and depth (for round THT components like capacitors)
 * - **Rectangle**: width, height, depth, and rotation (for rectangular components)
 *
 * @remarks
 * The discriminated union pattern enables TypeScript to narrow the type based on
 * the `type` field, providing excellent IDE autocomplete and compile-time safety.
 */
export const LibraryItem = z.union([
	z.object({
		/** Discriminator for circle components */
		type: z.literal('circle'),
		/** User-defined name for the component */
		name: z.string(),
		/** Circle radius in millimeters */
		radius: z.number(),
		/** Component depth/height in millimeters */
		depth: z.number()
	}),
	z.object({
		/** Discriminator for rectangle components */
		type: z.literal('rectangle'),
		/** User-defined name for the component */
		name: z.string(),
		/** Rectangle width in millimeters */
		width: z.number(),
		/** Rectangle height in millimeters */
		height: z.number(),
		/** Component depth/height in millimeters */
		depth: z.number(),
		/** Rotation angle in degrees (0-359), defaults to 0 */
		rotation: z.number().default(0)
	})
]);
export type LibraryItem = z.infer<typeof LibraryItem>;

/**
 * Array of saved library items
 *
 * Persisted to localStorage and synchronized across browser tabs using
 * svelte-persisted-store.
 */
export const Library = z.array(LibraryItem);
export type Library = z.infer<typeof Library>;
