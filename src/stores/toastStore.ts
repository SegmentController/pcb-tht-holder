/**
 * Toast Notification Store - User Feedback System
 *
 * Provides a simple toast notification system for showing temporary messages
 * to the user. Toasts auto-dismiss after a configurable duration.
 *
 * **Architecture:**
 * - Array-based store of active toast messages
 * - Auto-removal via setTimeout after specified duration
 * - Each toast has unique ID for tracking and manual dismissal
 * - Type-safe toast types (success, error, warning, info)
 *
 * **Toast Types:**
 * - success: Positive confirmation (green)
 * - error: Error or failure notification (red)
 * - warning: Caution or important notice (orange)
 * - info: Informational message (blue)
 *
 * **Usage:**
 * ```typescript
 * import { toastStore } from '$stores/toastStore';
 *
 * // Generic push
 * toastStore.push('error', 'Failed to save', 5000);
 *
 * // Convenience method
 * toastStore.error('Failed to save', 5000);
 * ```
 *
 * **UI Integration:**
 * - ToastContainer component subscribes to this store
 * - Renders toasts in bottom-right corner with stacking
 * - Uses Flowbite Svelte Toast component for styling
 * - Dismissable by user or auto-removed after duration
 */
import { writable } from 'svelte/store';

/**
 * Toast notification types mapped to visual styles
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Individual toast notification entry
 */
export type Toast = {
	/** Unique identifier for this toast (UUID) */
	id: string;
	/** Visual style and icon type */
	type: ToastType;
	/** Message text to display */
	message: string;
	/** Duration in milliseconds before auto-dismiss (default: 3000) */
	duration?: number;
};

/**
 * Creates the toast notification store with push and removal methods
 */
const createToastStore = () => {
	const { subscribe, update } = writable<Toast[]>([]);

	/**
	 * Adds a new toast notification to the stack
	 *
	 * Toast will auto-remove after specified duration.
	 *
	 * @param type - Visual style (success, error, warning, info)
	 * @param message - Text to display
	 * @param duration - Milliseconds before auto-dismiss (default: 3000)
	 */
	const push = (type: ToastType, message: string, duration = 3000) => {
		const id = crypto.randomUUID();
		update((toasts) => [...toasts, { id, type, message, duration }]);

		// Auto-remove after duration
		setTimeout(() => {
			update((toasts) => toasts.filter((t) => t.id !== id));
		}, duration);
	};

	return {
		subscribe,
		push,
		/**
		 * Convenience method for error toasts
		 *
		 * @param message - Error message to display
		 * @param duration - Milliseconds before auto-dismiss (default: 5000, longer for errors)
		 */
		error: (message: string, duration = 5000) => {
			push('error', message, duration);
		},
		/**
		 * Manually removes a toast by ID
		 *
		 * @param id - Toast UUID to remove
		 */
		remove: (id: string) => {
			update((toasts) => toasts.filter((t) => t.id !== id));
		}
	};
};

/**
 * Global toast notification store instance
 */
export const toastStore = createToastStore();
