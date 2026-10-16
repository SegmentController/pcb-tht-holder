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
 * - Storage: localStorage, project data under key 'project', PCB image (multi-MB base64)
 *   under its own key 'project-image' so it is only rewritten when it actually changes
 * - Tab sync: Changes synchronized across browser tabs
 * - Auto-save: State updates are debounced and flushed on tab hide/close; a failed write
 *   (e.g. storage quota) shows a toast
 * - Migration: legacy single-key projects (image inside 'project') are read transparently
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
import { get, type Updater, writable } from 'svelte/store';

import { ELEMENT_SKIP_JSON_PROPERTIES } from '$lib/constants';
import { toastStore } from '$stores/toastStore';
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
const skipKonvaProperties = (key: string, value: unknown) =>
	ELEMENT_SKIP_JSON_PROPERTIES.includes(key) ? undefined : value;

export const projectJsonSerializer = {
	parse: (text: string) => {
		try {
			return Project.parse(JSON.parse(text));
		} catch {
			return structuredClone(emptyProject);
		}
	},
	stringify: (object: Project) => JSON.stringify(object, skipKonvaProperties, 2)
};

const PROJECT_STORAGE_KEY = 'project';
const IMAGE_STORAGE_KEY = 'project-image';
const AUTOSAVE_DEBOUNCE_MS = 250;

/**
 * Reads a stored project; the image comes from its own key unless a legacy blob embeds it.
 * `savedImage` is that stored image (what the next autosave need not write again), or undefined
 * when there is none to trust: legacy blobs get migrated by the first write.
 */
const parseStoredProject = (text: string): { project: Project; savedImage?: string } => {
	try {
		const raw = JSON.parse(text);
		let savedImage: string | undefined;
		if (!raw.image) {
			raw.image = localStorage.getItem(IMAGE_STORAGE_KEY) ?? '';
			savedImage = raw.image;
		}
		return { project: Project.parse(raw), savedImage };
	} catch {
		return { project: structuredClone(emptyProject) };
	}
};

/** Compact project JSON without the image (that lives under IMAGE_STORAGE_KEY) */
const stringifyProjectForStorage = (project: Project) =>
	JSON.stringify(project, (key, value) =>
		key === 'image' ? undefined : skipKonvaProperties(key, value)
	);

const loadInitialProject = (): { project: Project; savedImage?: string } => {
	try {
		const json = localStorage.getItem(PROJECT_STORAGE_KEY);
		if (json) return parseStoredProject(json);
	} catch {
		/* storage unavailable */
	}
	return { project: structuredClone(emptyProject) };
};

/**
 * Writable store persisted to localStorage.
 *
 * Replaces a naive "serialize everything on every set" approach: the image is stored under a
 * separate key and only rewritten when it changed, writes are debounced (drag end, arrow-key
 * repeat and zoom slider no longer serialize megabytes each time) and flushed when the page is
 * hidden or closed.
 */
const createProjectStore = () => {
	const initial = loadInitialProject();
	let current = initial.project;
	const { subscribe, set: setInternal } = writable<Project>(current);

	let savedImage = initial.savedImage; // undefined: legacy blobs get migrated by the first write
	let timer: ReturnType<typeof setTimeout> | undefined;
	let hasWriteFailed = false;

	const flush = () => {
		if (timer === undefined) return;
		clearTimeout(timer);
		timer = undefined;

		try {
			// Image first: if it cannot be stored the previous (consistent) project stays in place
			if (current.image !== savedImage) {
				localStorage.setItem(IMAGE_STORAGE_KEY, current.image);
				savedImage = current.image;
			}
			localStorage.setItem(PROJECT_STORAGE_KEY, stringifyProjectForStorage(current));
			hasWriteFailed = false;
		} catch {
			if (!hasWriteFailed)
				toastStore.error(
					'Autosave failed (browser storage is full). Download the project file to keep your work.',
					10_000
				);
			hasWriteFailed = true;
		}
	};

	const set = (value: Project) => {
		current = value;
		setInternal(value);
		if (timer !== undefined) clearTimeout(timer);
		timer = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
	};

	if (typeof window !== 'undefined') {
		window.addEventListener('pagehide', flush);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') flush();
		});

		// Tab sync: adopt what another tab saved (it writes the image before the project)
		window.addEventListener('storage', (event) => {
			if (event.key !== PROJECT_STORAGE_KEY || !event.newValue) return;
			if (timer !== undefined) {
				clearTimeout(timer);
				timer = undefined;
			}
			({ project: current, savedImage } = parseStoredProject(event.newValue));
			setInternal(current);
		});
	}

	return {
		subscribe,
		set,
		update: (updater: Updater<Project>) => set(updater(current))
	};
};

/**
 * Persisted project store - central application state
 *
 * **Configuration:**
 * - Keys: 'project' (data) and 'project-image' (image) in localStorage
 * - Tab sync: changes propagate to other tabs via the storage event
 *
 * **Automatic Behaviors:**
 * - Debounced write to localStorage after updates (flushed when the page is hidden)
 * - Syncs changes across browser tabs in real-time
 * - Validates data on load with Zod schema
 * - Falls back to emptyProject if data invalid
 */
export const projectStore = createProjectStore();

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
