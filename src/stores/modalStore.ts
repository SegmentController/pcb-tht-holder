/**
 * Modal Dialog Store - Centralized Modal Management
 *
 * Provides a promise-based modal system for all user dialogs in the application.
 * Uses a custom Svelte modal library (`$lib/svelteModal`) that implements a stack-based
 * modal system with overlay, z-index management, and keyboard escape handling.
 *
 * **Architecture:**
 * - Modal stack: Multiple modals can be opened simultaneously (stacked)
 * - Promise-based API: Each modal returns a Promise that resolves when closed
 * - Type-safe results: Each helper function returns strongly-typed result objects
 * - Centralized rendering: ModalPortal in App.svelte renders all modals
 *
 * **Modal Categories:**
 *
 * 1. **Confirmation Modals:**
 *    - Generic confirm/cancel dialogs for destructive operations
 *    - Used for: Reset project, delete all legs, etc.
 *
 * 2. **Input Modals:**
 *    - Name editing for library items
 *    - Image resize confirmation with dimension input
 *
 * 3. **Settings Modals:**
 *    - Project settings (panel dimensions, tolerance, etc.)
 *    - Circle settings (radius, depth)
 *    - Rectangle settings (width, height, depth, rotation)
 *
 * 4. **Display Modals:**
 *    - Library management (view/delete saved components)
 *    - 3D mesh preview with STL export options
 *
 * **Usage Pattern:**
 * All modal helper functions follow this pattern:
 * ```typescript
 * const { confirmed, ...data } = await showModalXxx(props);
 * if (confirmed) {
 *   // User clicked OK/Confirm - process returned data
 * } else {
 *   // User cancelled - no action needed
 * }
 * ```
 *
 * **Props Cloning:**
 * Settings modals clone props (e.g., `{ ...panelSettings }`) to prevent
 * direct mutation of store state during editing. Changes only applied on confirm.
 *
 * **Modal Lifecycle:**
 * 1. Helper function pushes modal component to stack
 * 2. ModalPortal renders modal with backdrop
 * 3. User interacts with form fields
 * 4. User clicks confirm/cancel or presses Escape
 * 5. Modal component resolves promise with result object
 * 6. Modal pops from stack, backdrop removed if stack empty
 */
import ModalCircleSettings, {
	type CircleSettings
} from '$components/modal/ModalCircleSettings.svelte';
import ModalConfirm from '$components/modal/ModalConfirm.svelte';
import ModalLibrary from '$components/modal/ModalLibrary.svelte';
import ModalMeshDisplay from '$components/modal/ModalMeshDisplay.svelte';
import ModalNameEdit from '$components/modal/ModalNameEdit.svelte';
import ModalProjectSettings from '$components/modal/ModalProjectSettings.svelte';
import ModalRectangleSettings, {
	type RectangleSettings
} from '$components/modal/ModalRectangleSettings.svelte';
import ModalResizeImage from '$components/modal/ModalResizeImage.svelte';
import { createModalStore } from '$lib/svelteModal/modal';
import type { MeshInfoTuple } from '$types/MeshInfo';
import type { PanelSettings } from '$types/PanelSettings';

/**
 * Global modal store instance
 * Manages stack of active modals and provides push/pop operations
 */
export const modalStore = createModalStore();

/**
 * Shows confirmation dialog with customizable title
 *
 * Generic yes/no confirmation for destructive operations.
 *
 * @param title - Question or statement to display to user
 * @returns Promise resolving to { confirmed: true/false }
 */
export const showModalConfirm = async (title: string): Promise<{ confirmed: boolean }> =>
	await modalStore
		.push({
			component: ModalConfirm,
			props: {
				title
			}
		})
		.resolve();

/**
 * Shows name editing dialog for library items
 *
 * Allows user to assign or change name when saving component to library.
 *
 * @param name - Current/default name to display
 * @returns Promise resolving to { confirmed, name } where name is edited value
 */
export const showModalNameEdit = async (
	name: string
): Promise<{ confirmed: boolean; name: string }> =>
	await modalStore
		.push({
			component: ModalNameEdit,
			props: {
				name
			}
		})
		.resolve();

/**
 * Shows project settings dialog for panel configuration
 *
 * Comprehensive settings modal for PCB dimensions, thickness, SMD height,
 * print tolerance, project name, and optional text label for 3D engraving.
 *
 * Props are cloned to prevent direct store mutation during editing.
 *
 * @param panelSettings - Current panel configuration
 * @param name - Project name
 * @param label - Optional text label for 3D model engraving
 * @returns Promise resolving to { confirmed, panelSettings, name, label }
 */
export const showModalProjectSettings = async (
	panelSettings: PanelSettings,
	name: string,
	label: string
): Promise<{ confirmed: boolean; panelSettings: PanelSettings; name: string; label: string }> =>
	await modalStore
		.push({
			component: ModalProjectSettings,
			props: {
				panelSettings: { ...panelSettings },
				name,
				label
			}
		})
		.resolve();

/**
 * Shows image resize confirmation dialog
 *
 * Offers to resize large images (>1280x1024px) for better performance.
 * Calculates new height automatically to maintain aspect ratio.
 *
 * @param width - Current image width in pixels
 * @param height - Current image height in pixels
 * @returns Promise resolving to { confirmed, width } where width is target resize dimension
 */
export const showModalResizeImage = async (
	width: number,
	height: number
): Promise<{ confirmed: boolean; width: number }> =>
	await modalStore
		.push({
			component: ModalResizeImage,
			props: {
				width,
				height
			}
		})
		.resolve();

/**
 * Shows circle component settings dialog
 *
 * Edit radius and depth for circular THT components.
 * Settings object is cloned to prevent direct mutation.
 *
 * @param settings - Current circle settings { radius, depth }
 * @returns Promise resolving to { confirmed, settings } with updated values
 */
export const showModalCircleSettings = async (
	settings: CircleSettings
): Promise<{ confirmed: boolean; settings: CircleSettings }> =>
	await modalStore
		.push({
			component: ModalCircleSettings,
			props: {
				settings: { ...settings }
			}
		})
		.resolve();

/**
 * Shows rectangle component settings dialog
 *
 * Edit width, height, depth, and rotation for rectangular THT components.
 * Settings object is cloned to prevent direct mutation.
 *
 * @param settings - Current rectangle settings { width, height, depth, rotation }
 * @returns Promise resolving to { confirmed, settings } with updated values
 */
export const showModalRectangleSettings = async (
	settings: RectangleSettings
): Promise<{ confirmed: boolean; settings: RectangleSettings }> =>
	await modalStore
		.push({
			component: ModalRectangleSettings,
			props: {
				settings: { ...settings }
			}
		})
		.resolve();

/**
 * Shows library management modal
 *
 * Displays all saved component templates with delete functionality.
 * No confirmation result needed as operations are immediate.
 *
 * @returns Promise resolving to empty object when modal closes
 */
export const showModalLibrary = async (): Promise<object> =>
	await modalStore.push({ component: ModalLibrary }).resolve();

/**
 * Shows 3D mesh preview and export modal
 *
 * Displays Three.js rendered preview of generated STL meshes with:
 * - Wireframe/solid view toggle
 * - Main/hollow/positive mesh switching
 * - Positive mesh distance slider
 * - STL export buttons (text and binary formats)
 *
 * @param filename - Project name used for STL download filename
 * @param meshInfoTuple - Promise resolving to tuple of [mainMesh, hollowMesh, positiveMesh]
 * @returns Promise resolving to empty object when modal closes
 */
export const showModalMesh = async (
	filename: string,
	meshInfoTuple: Promise<MeshInfoTuple>
): Promise<object> =>
	await modalStore
		.push({
			component: ModalMeshDisplay,
			props: {
				name: filename,
				meshInfoTuple
			}
		})
		.resolve();
