/**
 * Undo/Redo History Store - Operation History Management
 *
 * Implements undo and redo using two stacks of reversible actions.
 *
 * **Architecture:**
 * - Each undoable operation stores a pair of closures: `undo` reverses it, `redo` applies it again
 * - Undoing moves the entry from the undo stack to the redo stack, redoing moves it back
 * - Any new undoable operation clears the redo stack (the undone future is no longer valid)
 * - Operations are named for display in the Edit menu ("Undo: Delete circle")
 * - Non-persistent: history is lost on page refresh
 * - Maximum undo stack size: 50 operations (oldest removed when exceeded). The redo stack is
 *   bounded by it, because entries only get there by being undone
 *
 * **Undoable Operations:**
 * The following operations add entries to the history:
 * - Delete circle/rectangle/leg (restores element with all properties)
 * - Delete all legs (restores entire legs array)
 * - Modify circle/rectangle properties (restores previous values)
 * - Rotate rectangle (restores previous rotation angle)
 * - Flip rectangle dimensions (restores previous width/height)
 * - Move circle/rectangle/leg by dragging (one entry per drag) or arrow keys (holding a key is
 *   one entry); a move to the same position adds nothing
 *
 * **Implementation Pattern:**
 * When performing a destructive operation:
 * 1. Capture the state before and after in closures (absolute values and element references,
 *    so interleaved non-undoable changes such as moving cannot corrupt them)
 * 2. Perform the operation (delete, modify, etc.)
 * 3. Add the entry with a descriptive name
 *
 * **Error Handling:**
 * If an undo/redo action throws an error (e.g., data inconsistency), the entry is
 * put back on the stack it came from to prevent loss of the opportunity. The error is
 * logged to console and a toast notification is shown to the user.
 *
 * **UI Integration:**
 * - Keyboard shortcuts: Ctrl+Z / Cmd+Z undo, Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y redo (AppNavigation)
 * - Edit menu: "Undo: {name}" / "Redo: {name}" (only shown if the stack is not empty)
 * - Edit menu items also show both counts via `undoStoreHistory`
 * - Toast notifications shown on errors
 *
 * **Non-Undoable Operations:**
 * The following operations do NOT add entries:
 * - Zoom changes (view state, not data)
 * - Mode switching (pointer/measure)
 * - Add operations (user can immediately delete if unwanted)
 *
 * Moves share the 50 entry limit, so a long editing session evicts the oldest entries sooner.
 *
 * **Limitations:**
 * - Stacks cleared on page refresh (not persisted)
 * - Stacks cleared on project reset to prevent cross-project undo
 * - Maximum 50 operations retained (FIFO when exceeded)
 */
import { derived, get, writable } from 'svelte/store';

import { toastStore } from './toastStore';

/**
 * Maximum number of undo operations to retain in stack
 * Oldest operations are removed when this limit is exceeded (FIFO)
 */
export const MAX_UNDO_STACK_SIZE = 50;

/** Closure that moves application state to the one before / after an operation */
type HistoryAction = () => void;

/**
 * Undoable operation entry in the history
 * Contains user-friendly name and both restoration functions
 */
type Undoable = {
	/** Display name shown in Edit menu (e.g., "Delete circle", "Modify rectangle") */
	name: string;
	/** Closure that reverses the operation when executed */
	undo: HistoryAction;
	/** Closure that applies the operation again after it was undone */
	redo: HistoryAction;
	/** Repeated operations with the same key shortly after each other share one entry */
	coalesceKey?: string;
	/** Creation time, used for coalescing */
	timestamp: number;
};

/** Operations with the same coalesce key within this window collapse into one undo entry */
const COALESCE_WINDOW_MS = 1500;

/**
 * Internal undo stack - array of undoable operations
 * New operations pushed to end, undo pops from end (LIFO)
 */
const undoStore = writable<Undoable[]>([]);

/** Internal redo stack - entries that were undone, last undone on the end */
const redoStore = writable<Undoable[]>([]);

/**
 * Derived store exposing name of last undoable operation
 * Used in Edit menu to show "Undo: {name}" or hide menu item if undefined
 */
export const undoStoreLastItem = derived(undoStore, ($undoStore) => $undoStore.at(-1)?.name);

/** Derived store exposing name of the operation a redo would apply again */
export const redoStoreLastItem = derived(redoStore, ($redoStore) => $redoStore.at(-1)?.name);

/** Sizes of both stacks and the undo limit, for the Edit menu */
export const undoStoreHistory = derived([undoStore, redoStore], ([$undo, $redo]) => ({
	undo: $undo.length,
	redo: $redo.length,
	max: MAX_UNDO_STACK_SIZE
}));

/**
 * Adds a new undoable operation to the history
 *
 * Called by element operation functions after performing destructive changes.
 * The closures should capture all state needed to reverse and to re-apply the operation.
 *
 * Clears the redo stack and enforces the maximum stack size by removing the oldest
 * operation (FIFO) when the limit is exceeded.
 *
 * @param name - User-friendly operation name for Edit menu display
 * @param undo - Closure that reverses the operation when called
 * @param redo - Closure that applies the operation again when called
 * @param coalesceKey - Optional: a following call with the same key within 1.5 s is merged into this entry
 */
export const addUndo = (
	name: string,
	undo: HistoryAction,
	redo: HistoryAction,
	coalesceKey?: string
) => {
	redoStore.set([]);
	undoStore.update((undoables) => {
		const now = Date.now();

		// Repeated quick operations (e.g. holding the rotate key) keep the entry that restores the
		// oldest state and redoes to the newest one, instead of flooding the stack and evicting real deletions
		const last = undoables.at(-1);
		if (
			coalesceKey !== undefined &&
			last?.coalesceKey === coalesceKey &&
			now - last.timestamp <= COALESCE_WINDOW_MS
		) {
			last.redo = redo;
			last.timestamp = now;
			return undoables;
		}

		// Add new undo entry
		undoables.push({ name, undo, redo, coalesceKey, timestamp: now });

		// Enforce stack size limit (remove oldest if exceeded)
		if (undoables.length > MAX_UNDO_STACK_SIZE) undoables.shift(); // Remove oldest entry (FIFO)

		return undoables;
	});
};

/**
 * Pops the last entry of `from`, runs its `kind` action and pushes it onto `to`.
 *
 * **Error Handling:**
 * If the action throws:
 * - Error details logged to console for debugging
 * - Toast notification shown to user
 * - Entry stays on `from` to allow retry
 */
const runHistoryStep = (from: typeof undoStore, to: typeof undoStore, kind: 'redo' | 'undo') => {
	const entries = get(from);
	const entry = entries.at(-1);
	if (!entry) return;

	try {
		entry[kind]();
	} catch (error) {
		// Detailed error logging for debugging
		// eslint-disable-next-line no-console
		console.error(`=== ${kind === 'undo' ? 'Undo' : 'Redo'} Operation Failed ===`);
		// eslint-disable-next-line no-console
		console.error('Operation name:', entry.name);
		// eslint-disable-next-line no-console
		console.error('Error details:', error);
		// eslint-disable-next-line no-console
		console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
		// eslint-disable-next-line no-console
		console.error('============================');

		// Show user notification, entry stays on its stack for retry
		toastStore.push('error', `Failed to ${kind}: ${entry.name}`, 5000);
		return;
	}

	from.set(entries.slice(0, -1));
	to.update((target) => [...target, entry]);
};

/**
 * Executes the most recent undo action and moves its entry to the redo stack
 *
 * Triggered by Ctrl+Z keyboard shortcut or Edit menu selection.
 */
export const executeLastUndo = () => runHistoryStep(undoStore, redoStore, 'undo');

/**
 * Applies the most recently undone operation again and moves its entry back to the undo stack
 *
 * Triggered by Ctrl+Shift+Z / Ctrl+Y or Edit menu selection.
 * Does not clear the redo stack, so several undone operations can be redone in sequence.
 */
export const executeLastRedo = () => runHistoryStep(redoStore, undoStore, 'redo');

/**
 * Clears the entire history (undo and redo)
 *
 * Called when project is reset to prevent undoing operations from previous project.
 * Ensures user cannot accidentally restore deleted elements after starting fresh.
 */
export const clearUndoStack = () => {
	undoStore.set([]);
	redoStore.set([]);
};
