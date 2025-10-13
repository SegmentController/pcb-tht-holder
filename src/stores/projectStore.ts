/**
 * Project Store - Central Application State Management
 *
 * The project store is the heart of the application, managing all design data for the
 * current PCB holder project. It persists to localStorage and provides automatic state
 * restoration on page load.
 *
 * **State Contents:**
 *
 * 1. **Image Data:**
 *    - PCB top-view image (base64 data URL)
 *    - Used as canvas overlay for component placement
 *
 * 2. **Project Metadata:**
 *    - Project name (used for file downloads)
 *    - Optional text label (engraved on 3D model)
 *    - Zoom level (10-300%, default 100%)
 *
 * 3. **Panel Settings:**
 *    - Physical dimensions (width, height in mm)
 *    - PCB thickness (default 1.6mm FR4)
 *    - SMD component clearance height
 *    - Print tolerance compensation (0-2mm with 0.1mm precision)
 *
 * 4. **Component Arrays:**
 *    - circles[]: Circular THT components (capacitors, connectors)
 *    - rectangles[]: Rectangular THT components (pin headers, ICs)
 *    - legs[]: Support structures for PCB stability
 *
 * **Persistence Strategy:**
 * - Storage: localStorage under key 'project'
 * - Tab sync: Changes synchronized across browser tabs
 * - Auto-save: Every state update triggers localStorage write
 * - Auto-restore: Application loads last project on mount
 * - Validation: Zod schema validates data on parse
 *
 * **Custom JSON Serializer:**
 * The projectJsonSerializer excludes Konva.js internal properties (fill, draggable,
 * opacity) from serialization. These are visual properties that should not be saved
 * to localStorage or .tht3d files - they're always reconstructed from constants.
 *
 * **Default Values (emptyProject):**
 * Used for new projects and as fallback when parsing fails:
 * - Panel: 100x100mm square
 * - PCB thickness: 1.6mm (standard FR4)
 * - SMD height: 3mm (typical clearance)
 * - Print tolerance: 0mm (no compensation)
 * - Zoom: 100%
 * - No components
 *
 * **State Mutation Patterns:**
 *
 * 1. **Direct assignment** (not recommended, doesn't trigger reactivity):
 *    ```typescript
 *    $projectStore.circles.push(newCircle); // BAD: No reactivity
 *    ```
 *
 * 2. **Using update()** (recommended pattern):
 *    ```typescript
 *    updateProjectStoreValue(store => ({
 *      ...store,
 *      circles: [...store.circles, newCircle]
 *    }));
 *    ```
 *
 * 3. **Direct store reference** (convenient for simple updates):
 *    ```typescript
 *    $projectStore.zoom = 150; // OK: Triggers reactivity
 *    ```
 *
 * **File Format (.tht3d):**
 * When downloading projects, the entire store is serialized with the custom
 * serializer and encoded as base64 JSON. This format:
 * - Includes embedded PCB image (base64)
 * - Preserves all component positions and dimensions
 * - Validates with Zod schema on load
 * - Can be restored by drag/drop into application
 *
 * **Performance Considerations:**
 * - localStorage has ~5-10MB size limit (varies by browser)
 * - Large images (>1MB) may cause performance issues
 * - Auto-resize prompt appears for images >1280x1024px
 * - Consider binary formats for production use
 */
import { get, type Updater } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';

import { ELEMENT_SKIP_JSON_PROPERTIES } from '$lib/constants';
import { Project } from '$types/Project';

/**
 * Empty project template with sensible defaults
 *
 * Used for:
 * - Initial application state when no saved project exists
 * - Fallback when localStorage parsing fails (corrupted data)
 * - Reference for resetting project to clean state
 *
 * **Default Panel Settings:**
 * - 100x100mm square (common prototyping size)
 * - 1.6mm PCB thickness (standard FR4)
 * - 3mm SMD clearance (typical for common components)
 * - 0mm print tolerance (no compensation by default)
 */
const emptyProject: Project = {
	image: '',
	name: '',
	label: '',
	zoom: 100,

	panelSettings: {
		width: 100,
		height: 100,
		pcbThickness: 1.6,
		smdHeight: 3,
		printTolerance: 0
	},

	circles: [],
	rectangles: [],
	legs: []
};

/**
 * Custom JSON serializer for project persistence
 *
 * **Parse:**
 * - Parses JSON string to object
 * - Validates structure with Zod Project schema
 * - Returns emptyProject if parsing or validation fails
 *
 * **Stringify:**
 * - Filters out Konva.js internal properties using replacer function
 * - Skips: fill, draggable, opacity (these are visual constants)
 * - Pretty-prints with 2-space indentation
 * - Used for both localStorage and .tht3d file export
 *
 * **Why Filter Properties?**
 * Konva properties (fill, draggable, opacity) are:
 * - Always reconstructed from constants on load
 * - Not part of the logical data model
 * - Would bloat file size unnecessarily
 * - Defined in ELEMENT_SKIP_JSON_PROPERTIES constant
 */
export const projectJsonSerializer = {
	parse: (text: string) => {
		try {
			return Project.parse(JSON.parse(text));
		} catch {
			return emptyProject;
		}
	},
	stringify: (object: Project) =>
		JSON.stringify(
			object,
			(key, value) => {
				if (!ELEMENT_SKIP_JSON_PROPERTIES.includes(key)) return value;
			},
			2
		)
};

/**
 * Persisted project store - central application state
 *
 * **Configuration:**
 * - Key: 'project' in localStorage
 * - Tab sync: true (changes propagate to other tabs)
 * - Storage: 'local' (localStorage, not sessionStorage)
 * - Serializer: projectJsonSerializer (custom JSON handling)
 *
 * **Automatic Behaviors:**
 * - Writes to localStorage on every update
 * - Syncs changes across browser tabs in real-time
 * - Validates data on load with Zod schema
 * - Falls back to emptyProject if data invalid
 */
export const projectStore = persisted<Project>('project', emptyProject, {
	syncTabs: true,
	storage: 'local',
	serializer: projectJsonSerializer
});

/**
 * Gets current project state snapshot
 * @returns Immutable snapshot of current project
 */
export const getProjectStoreValue = (): Project => get(projectStore);

/**
 * Replaces entire project state
 * @param project - New project data to set
 */
export const setProjectStoreValue = (project: Project) => projectStore.set(project);

/**
 * Updates project using updater function pattern
 *
 * Recommended for partial updates to maintain immutability.
 *
 * @param updater - Function receiving current state and returning updated state
 */
export const updateProjectStoreValue = (updater: Updater<Project>) => projectStore.update(updater);

/**
 * Gets count of support legs in current project
 *
 * Convenience function used in UI to conditionally show "Delete all legs" menu item.
 *
 * @returns Number of leg elements (0 if none)
 */
export const getProjectStoreLegCount = () => get(projectStore).legs.length;
