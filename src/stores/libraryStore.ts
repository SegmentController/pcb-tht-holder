/**
 * Component Library Store - Persistent Template Management
 *
 * Manages a collection of reusable component templates (circles and rectangles)
 * that users can save and quickly add to new projects. This is particularly useful
 * for commonly used components like specific connector types or IC packages.
 *
 * **Storage:**
 * - Persisted to localStorage under key 'library'
 * - Survives browser sessions and page refreshes
 * - Independent from project data (not saved in .tht3d files)
 *
 * **Data Model:**
 * Library is an array of LibraryItem, where each item is a discriminated union:
 * - **Circle items**: { type: 'circle', name, radius, depth }
 * - **Rectangle items**: { type: 'rectangle', name, width, height, depth, rotation }
 *
 * **User Workflow:**
 * 1. User creates component with specific dimensions in designer
 * 2. Right-click context menu → "Add to library"
 * 3. Assigns a name (e.g., "JST-XH 2.54mm connector")
 * 4. Component saved to library with all dimensional properties
 * 5. In any project: Edit menu → "Add from library" → Select saved component
 * 6. New element created at center with saved dimensions
 *
 * **Use Cases:**
 * - Standard connector families (JST, Molex, pin headers)
 * - Common IC packages (DIP-8, DIP-16, TO-220)
 * - Frequently used capacitor/resistor footprints
 * - Custom components used across multiple PCB designs
 *
 * **Library Management:**
 * - View/edit library via Library button in navigation bar
 * - Delete individual items via modal interface
 * - Items are alphabetically sorted in "Add from library" menu
 */
import { get, type Updater } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';

import {
	convertDefaultComponentToLibraryItem,
	DEFAULT_COMPONENTS,
	type Library
} from '$types/Library';

/**
 * Persisted store holding array of saved component templates
 *
 * Automatically synchronized to localStorage, providing cross-session persistence.
 * Default value is empty array when no library exists.
 */
export const libraryStore = persisted<Library>('library', []);

/**
 * Gets current library array snapshot
 * @returns Array of saved component templates
 */
export const getLibraryStoreValue = (): Library => get(libraryStore);

/**
 * Replaces entire library with new array
 * @param library - New array of component templates
 */
export const setLibraryStoreValue = (library: Library) => libraryStore.set(library);

/**
 * Updates library using updater function pattern
 * @param updater - Function that receives current library and returns updated library
 */
export const updateLibraryStoreValue = (updater: Updater<Library>) => libraryStore.update(updater);

/**
 * Loads default THT components into the library
 *
 * Appends predefined common components (DIP sockets, capacitors, buzzers, etc.)
 * to the existing library. Performs duplicate detection by name - components whose
 * names already exist in the library are automatically skipped.
 *
 * **Behavior:**
 * - Preserves all existing library items
 * - Only adds defaults with names not already present
 * - Uses O(1) Set lookup for efficient duplicate checking
 * - Safe to call multiple times (won't create duplicates)
 *
 * **Use Case:**
 * Called when user clicks "Load defaults" button in Library modal to quickly
 * populate their library with standard component footprints.
 *
 * @see DEFAULT_COMPONENTS in Library.ts for the list of default components
 * @see convertDefaultComponentToLibraryItem for dimension mapping logic
 */
export const loadDefaultsToLibrary = () => {
	const currentLibrary = getLibraryStoreValue();

	// Build set of existing names for O(1) duplicate checking
	const existingNames = new Set(currentLibrary.map((item) => item.name));

	// Filter out defaults that already exist, then convert to LibraryItem format
	const defaultsToAdd = DEFAULT_COMPONENTS.filter(
		(component) => !existingNames.has(component.name)
	).map((component) => convertDefaultComponentToLibraryItem(component));

	// Append defaults to existing library
	if (defaultsToAdd.length > 0) setLibraryStoreValue([...currentLibrary, ...defaultsToAdd]);
};
