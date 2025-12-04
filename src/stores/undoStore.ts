/**
 * Undo Stack Store - Operation History Management
 *
 * Implements a simple but effective undo system using a stack of reversible actions.
 * Provides single-level undo (no redo) for destructive operations in the designer.
 *
 * **Architecture:**
 * - Stack-based design: Last In, First Out (LIFO)
 * - Each undoable operation stores a closure that reverses the action
 * - Operations are named for display in Edit menu ("Undo: Delete circle")
 * - Non-persistent: Undo history is lost on page refresh
 * - Maximum stack size: 50 operations (oldest removed when exceeded)
 *
 * **Undoable Operations:**
 * The following operations add entries to the undo stack:
 * - Delete circle/rectangle/leg (restores element with all properties)
 * - Delete all legs (restores entire legs array)
 * - Modify circle/rectangle properties (restores previous values)
 * - Rotate rectangle (restores previous rotation angle)
 * - Flip rectangle dimensions (restores previous width/height)
 *
 * **Implementation Pattern:**
 * When performing a destructive operation:
 * 1. Capture current state in a closure
 * 2. Perform the operation (delete, modify, etc.)
 * 3. Add undo action to stack with descriptive name
 * 4. Undo action closure restores captured state when executed
 *
 * **Error Handling:**
 * If undo action throws an error (e.g., data inconsistency), the action is
 * re-added to the stack to prevent loss of undo opportunity. Error is logged
 * to console and toast notification is shown to user.
 *
 * **UI Integration:**
 * - Keyboard shortcut: Ctrl+Z / Cmd+Z (global, defined in AppNavigation)
 * - Edit menu: "Undo: {operation name}" (only shown if stack not empty)
 * - Derived store `undoStoreLastItem` provides operation name for menu
 * - Toast notifications shown on undo errors
 *
 * **Non-Undoable Operations:**
 * The following operations do NOT add undo entries:
 * - Element movement/positioning (frequent, non-destructive)
 * - Zoom changes (view state, not data)
 * - Mode switching (pointer/measure)
 * - Add operations (user can immediately delete if unwanted)
 *
 * **Limitations:**
 * - Single-level undo only (no redo functionality)
 * - Stack cleared on page refresh (not persisted)
 * - Stack cleared on project reset to prevent cross-project undo
 * - Maximum 50 operations retained (FIFO when exceeded)
 */
import { derived, writable } from 'svelte/store';

import { toastStore } from './toastStore';

/**
 * Maximum number of undo operations to retain in stack
 * Oldest operations are removed when this limit is exceeded (FIFO)
 */
const MAX_UNDO_STACK_SIZE = 50;

/**
 * Undo action function type - closure that reverses an operation
 * Should restore application state to condition before the operation
 */
type UndoAction = () => void;

/**
 * Undoable operation entry in the undo stack
 * Contains user-friendly name and restoration function
 */
type Undoable = {
	/** Display name shown in Edit menu (e.g., "Delete circle", "Modify rectangle") */
	name: string;
	/** Closure that reverses the operation when executed */
	action: UndoAction;
};

/**
 * Internal undo stack - array of undoable operations
 * New operations pushed to end, undo pops from end (LIFO)
 */
const undoStore = writable<Undoable[]>([]);

/**
 * Derived store exposing name of last undoable operation
 * Used in Edit menu to show "Undo: {name}" or hide menu item if undefined
 */
export const undoStoreLastItem = derived(undoStore, ($undoStore) => $undoStore.at(-1)?.name);

/**
 * Adds a new undoable operation to the stack
 *
 * Called by element operation functions after performing destructive changes.
 * The action closure should capture all state needed to reverse the operation.
 *
 * Enforces maximum stack size by removing oldest operation (FIFO) when limit exceeded.
 *
 * @param name - User-friendly operation name for Edit menu display
 * @param action - Closure that reverses the operation when called
 */
export const addUndo = (name: string, action: UndoAction) =>
	undoStore.update((undoables) => {
		// Add new undo entry
		undoables.push({ name, action });

		// Enforce stack size limit (remove oldest if exceeded)
		if (undoables.length > MAX_UNDO_STACK_SIZE) undoables.shift(); // Remove oldest entry (FIFO)

		return undoables;
	});

/**
 * Executes and removes the most recent undo action
 *
 * Triggered by Ctrl+Z keyboard shortcut or Edit menu selection.
 * Pops action from stack, executes it, and handles any errors.
 *
 * **Error Handling:**
 * If action throws an error during execution:
 * - Error details logged to console for debugging
 * - Toast notification shown to user
 * - Action re-added to stack to allow retry
 */
export const executeLastUndo = () =>
	undoStore.update((undoables) => {
		const last = undoables.pop();
		if (last)
			try {
				last.action();
			} catch (error) {
				// Detailed error logging for debugging
				// eslint-disable-next-line no-console
				console.error('=== Undo Operation Failed ===');
				// eslint-disable-next-line no-console
				console.error('Operation name:', last.name);
				// eslint-disable-next-line no-console
				console.error('Error details:', error);
				// eslint-disable-next-line no-console
				console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
				// eslint-disable-next-line no-console
				console.error('============================');

				// Show user notification
				toastStore.push('error', `Failed to undo: ${last.name}`, 5000);

				// Re-add to stack for retry
				undoables.push(last);
			}

		return undoables;
	});

/**
 * Clears the entire undo stack
 *
 * Called when project is reset to prevent undoing operations from previous project.
 * Ensures user cannot accidentally restore deleted elements after starting fresh.
 */
export const clearUndoStack = () => undoStore.set([]);
