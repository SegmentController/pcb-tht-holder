import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toastStore } from './toastStore';
import { addUndo, clearUndoStack, executeLastUndo, undoStoreLastItem } from './undoStore';

describe('undoStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		clearUndoStack();
	});

	afterEach(() => {
		clearUndoStack();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('exposes the name of the most recent entry', () => {
		expect(get(undoStoreLastItem)).toBeUndefined();

		addUndo('first', vi.fn());
		addUndo('second', vi.fn());

		expect(get(undoStoreLastItem)).toBe('second');
	});

	it('executes entries last-in first-out', () => {
		const order: string[] = [];
		addUndo('a', () => order.push('a'));
		addUndo('b', () => order.push('b'));

		executeLastUndo();
		expect(get(undoStoreLastItem)).toBe('a');
		executeLastUndo();

		expect(order).toEqual(['b', 'a']);
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	it('does nothing on an empty stack', () => {
		expect(() => executeLastUndo()).not.toThrow();
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	it('keeps at most 50 entries, dropping the oldest', () => {
		const executed: number[] = [];
		for (let index = 0; index < 55; index++) addUndo(`op ${index}`, () => executed.push(index));

		while (get(undoStoreLastItem) !== undefined) executeLastUndo();

		expect(executed).toHaveLength(50);
		expect(executed[0]).toBe(54);
		expect(executed.at(-1)).toBe(5);
	});

	it('re-queues a failing action and notifies the user', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const push = vi.spyOn(toastStore, 'push');
		let shouldFail = true;
		const action = vi.fn(() => {
			if (shouldFail) throw new Error('inconsistent');
		});
		addUndo('Delete circle', action);

		executeLastUndo();

		expect(get(undoStoreLastItem)).toBe('Delete circle');
		expect(push).toHaveBeenCalledWith('error', 'Failed to undo: Delete circle', 5000);
		expect(consoleError).toHaveBeenCalled();

		shouldFail = false;
		executeLastUndo();

		expect(action).toHaveBeenCalledTimes(2);
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	it('clearUndoStack empties the stack', () => {
		addUndo('x', vi.fn());
		clearUndoStack();
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	describe('coalescing', () => {
		it('merges quick operations with the same key into the entry restoring the oldest state', () => {
			const restored: string[] = [];
			addUndo('Rotate', () => restored.push('first'), 'rotate:1');
			vi.advanceTimersByTime(300);
			addUndo('Rotate', () => restored.push('second'), 'rotate:1');
			addUndo('Rotate', () => restored.push('third'), 'rotate:1');

			executeLastUndo();

			expect(restored).toEqual(['first']);
			expect(get(undoStoreLastItem)).toBeUndefined();
		});

		it('starts a new entry after the window has passed', () => {
			addUndo('Rotate', vi.fn(), 'rotate:1');
			vi.advanceTimersByTime(2000);
			addUndo('Rotate', vi.fn(), 'rotate:1');

			executeLastUndo();

			expect(get(undoStoreLastItem)).toBe('Rotate');
		});

		it('does not merge different keys or entries without a key', () => {
			addUndo('Rotate A', vi.fn(), 'rotate:a');
			addUndo('Rotate B', vi.fn(), 'rotate:b');
			addUndo('Delete', vi.fn());
			addUndo('Delete', vi.fn());

			let count = 0;
			while (get(undoStoreLastItem) !== undefined) {
				executeLastUndo();
				count++;
			}

			expect(count).toBe(4);
		});
	});
});
