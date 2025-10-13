import { z } from 'zod';

import { CircleData } from './CircleData';
import { LegData } from './LegData';
import { PanelSettings } from './PanelSettings';
import { RectangleData } from './RectangleData';

/**
 * Root project data structure representing a complete PCB THT holder design
 *
 * This is the central data model for the entire application, persisted to browser
 * localStorage using svelte-persisted-store. It contains everything needed to:
 * - Display the PCB image with placed components in the designer interface
 * - Generate the 3D mesh for STL export
 * - Save and restore project state across sessions
 *
 * @remarks
 * **Data persistence:**
 * - Automatically saved to localStorage on every change
 * - Validated with Zod schemas at runtime for data integrity
 * - Synchronized across browser tabs in real-time
 *
 * **State management:**
 * - Accessed via `projectStore` from `src/stores/projectStore.ts`
 * - Modified using immutable update patterns with Svelte stores
 * - Excludes Konva-specific rendering properties during JSON serialization
 */
export const Project = z.object({
	/** Project name displayed in UI and used for default STL filename */
	name: z.string(),

	/** PCB image as base64-encoded data URL (automatically flipped and made transparent) */
	image: z.string(),

	/** Optional text label engraved on the side of the 3D holder */
	label: z.string().default(''),

	/** Physical properties of the PCB panel and holder */
	panelSettings: PanelSettings,

	/** Canvas zoom level in percentage (100 = actual size) */
	zoom: z.number(),

	/** Array of circular THT components (capacitors, relays, etc.) */
	circles: z.array(CircleData),

	/** Array of rectangular THT components (terminals, pin headers, etc.) */
	rectangles: z.array(RectangleData),

	/** Array of support legs that hold the PCB at correct height during soldering */
	legs: z.array(LegData)
});
export type Project = z.infer<typeof Project>;

/**
 * Subset of Project used for 3D mesh generation
 *
 * Omits UI-specific metadata (name, image) that isn't needed for mesh generation.
 * This type is passed to `generateMeshLazy()` in `src/lib/3d/mesh.ts` to create
 * the Three.js meshes for STL export.
 *
 * @remarks
 * By excluding the image data URL, we significantly reduce the amount of data
 * passed to mesh generation functions, improving performance and reducing memory usage.
 */
export type RenderableProject = Omit<Project, 'name' | 'image'>;
