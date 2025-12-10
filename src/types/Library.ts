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

/**
 * Component shape discriminator for default components
 */
export type ComponentShape = 'rect' | 'circle';

/**
 * Default component specification for pre-defined library items
 *
 * This format is used to define common THT components with standardized dimensions.
 * The fields map to LibraryItem properties as follows:
 *
 * **For rectangles (shape = "rect"):**
 * - `width` → LibraryItem.width (X dimension in mm)
 * - `depth` → LibraryItem.height (Y dimension along board in mm)
 * - `height` → LibraryItem.depth (component height above PCB → hole depth in mm)
 *
 * **For circles (shape = "circle"):**
 * - `width` → LibraryItem.radius (diameter in mm, converted to radius by dividing by 2)
 * - `depth` → Not used (kept equal to width for consistency)
 * - `height` → LibraryItem.depth (component height above PCB → hole depth in mm)
 *
 * @see convertDefaultComponentToLibraryItem for conversion logic
 */
export interface DefaultComponent {
	/** User-friendly component name */
	name: string;
	/** Shape type: "rect" for rectangular, "circle" for round components */
	shape: ComponentShape;
	/** For rect: X dimension (width). For circle: diameter */
	width: number;
	/** For rect: Y dimension (along board). For circle: not used (set = width) */
	depth: number;
	/** Component height above PCB (maps to hole depth in LibraryItem) */
	height: number;
}

/**
 * Pre-defined common THT components for quick library initialization
 *
 * Includes standard footprints with dimensions sourced from datasheets:
 * - DIP IC sockets (narrow and wide)
 * - Radial electrolytic capacitors (various sizes)
 * - PCB-mount buzzers (small and large)
 * - Screw terminal blocks (5.08mm pitch)
 * - Generic relays (small and large)
 *
 * Users can load these defaults into their library via the "Load defaults"
 * button in the Library modal. Duplicates (by name) are automatically skipped.
 */
export const DEFAULT_COMPONENTS: DefaultComponent[] = [
	// DIP IC sockets
	{
		name: 'DIP-8 socket (narrow)',
		shape: 'rect',
		width: 7.6, // body width ~7.6 mm
		depth: 10, // body length ~10 mm
		height: 5 // profile height ~3.5–5 mm
	},
	{
		name: 'DIP-14/16 socket (narrow)',
		shape: 'rect',
		width: 7.6,
		depth: 20, // ~19–20 mm body length
		height: 5
	},
	{
		name: 'DIP-28 socket (wide)',
		shape: 'rect',
		width: 15.2, // wide row spacing ~15.24 mm
		depth: 37, // ~37 mm body length
		height: 5
	},
	{
		name: 'DIP-40 socket (wide)',
		shape: 'rect',
		width: 15.2,
		depth: 52, // ~52 mm body length
		height: 5
	},

	// Radial electrolytic capacitors (DxL families)
	{
		name: 'Electrolytic Ø5×11',
		shape: 'circle',
		width: 5, // diameter 5 mm
		depth: 5, // not used for circle, keep = diameter
		height: 11 // can-height ~11 mm
	},
	{
		name: 'Electrolytic Ø8×12',
		shape: 'circle',
		width: 8, // diameter 8 mm
		depth: 8,
		height: 12 // height 12 mm
	},
	{
		name: 'Electrolytic Ø10×16',
		shape: 'circle',
		width: 10, // diameter 10 mm
		depth: 10,
		height: 16 // height 16 mm
	},

	// Buzzers
	{
		name: 'Buzzer small Ø14×8',
		shape: 'circle',
		width: 14, // small PCB buzzer ~13–14 mm Ø
		depth: 14,
		height: 8 // ~7–8 mm height above PCB
	},
	{
		name: 'Buzzer large Ø31×14',
		shape: 'circle',
		width: 31, // typical large buzzer ~30–32 mm Ø
		depth: 31,
		height: 14 // ~14–15 mm height
	},

	// Terminal blocks (5.08 mm pitch family)
	{
		name: 'Terminal block 2×5.08',
		shape: 'rect',
		width: 10.5, // ≈2×5.08 + housing margins
		depth: 8, // body depth ~7–9 mm
		height: 11 // ~10–12 mm above PCB
	},
	{
		name: 'Terminal block 3×5.08',
		shape: 'rect',
		width: 15.5, // ≈3×5.08 + housing margins
		depth: 8,
		height: 11
	},

	// Generic board parts
	{
		name: 'Small relay',
		shape: 'rect',
		width: 10,
		depth: 19,
		height: 15
	},
	{
		name: 'Large relay',
		shape: 'rect',
		width: 15,
		depth: 28,
		height: 20
	}
];

/**
 * Converts a DefaultComponent to a LibraryItem for storage
 *
 * Applies dimension mappings according to shape type:
 *
 * **Rectangle conversion:**
 * - width → width (X dimension preserved)
 * - depth → height (Y dimension - confusingly named in LibraryItem)
 * - height → depth (component height above PCB becomes hole depth)
 * - rotation defaults to 0
 *
 * **Circle conversion:**
 * - width (diameter) → radius (divided by 2)
 * - height → depth (component height above PCB becomes hole depth)
 * - depth field in DefaultComponent is unused for circles
 *
 * @param component - Default component specification
 * @returns LibraryItem ready for storage in library
 */
export const convertDefaultComponentToLibraryItem = (component: DefaultComponent): LibraryItem =>
	component.shape === 'circle'
		? {
				type: 'circle',
				name: component.name,
				radius: component.width / 2, // Convert diameter to radius
				depth: component.height // Component height → hole depth
			}
		: {
				type: 'rectangle',
				name: component.name,
				width: component.width, // X dimension
				height: component.depth, // Y dimension (confusingly named in LibraryItem)
				depth: component.height, // Component height → hole depth
				rotation: 0 // Default rotation
			};
