import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toastStore } from './toastStore';
import {
	addUndo,
	clearUndoStack,
	executeLastRedo,
	executeLastUndo,
	redoStoreLastItem,
	undoStoreHistory,
	undoStoreLastItem
} from './undoStore';

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

		addUndo('first', vi.fn(), vi.fn());
		addUndo('second', vi.fn(), vi.fn());

		expect(get(undoStoreLastItem)).toBe('second');
	});

	it('executes entries last-in first-out', () => {
		const order: string[] = [];
		addUndo('a', () => order.push('a'), vi.fn());
		addUndo('b', () => order.push('b'), vi.fn());

		executeLastUndo();
		expect(get(undoStoreLastItem)).toBe('a');
		executeLastUndo();

		expect(order).toEqual(['b', 'a']);
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	it('does nothing on an empty stack', () => {
		expect(() => executeLastUndo()).not.toThrow();
		expect(() => executeLastRedo()).not.toThrow();
		expect(get(undoStoreLastItem)).toBeUndefined();
		expect(get(redoStoreLastItem)).toBeUndefined();
	});

	it('keeps at most 50 entries, dropping the oldest', () => {
		const executed: number[] = [];
		for (let index = 0; index < 55; index++)
			addUndo(`op ${index}`, () => executed.push(index), vi.fn());

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
		addUndo('Delete circle', action, vi.fn());

		executeLastUndo();

		expect(get(undoStoreLastItem)).toBe('Delete circle');
		expect(get(redoStoreLastItem)).toBeUndefined();
		expect(push).toHaveBeenCalledWith('error', 'Failed to undo: Delete circle', 5000);
		expect(consoleError).toHaveBeenCalled();

		shouldFail = false;
		executeLastUndo();

		expect(action).toHaveBeenCalledTimes(2);
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	it('clearUndoStack empties the stack', () => {
		addUndo('x', vi.fn(), vi.fn());
		clearUndoStack();
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	describe('redo', () => {
		it('moves an undone entry to the redo stack and applies it again', () => {
			const calls: string[] = [];
			addUndo(
				'Delete circle',
				() => calls.push('undo'),
				() => calls.push('redo')
			);

			executeLastUndo();
			expect(get(undoStoreLastItem)).toBeUndefined();
			expect(get(redoStoreLastItem)).toBe('Delete circle');

			executeLastRedo();
			expect(get(undoStoreLastItem)).toBe('Delete circle');
			expect(get(redoStoreLastItem)).toBeUndefined();

			executeLastUndo();

			expect(calls).toEqual(['undo', 'redo', 'undo']);
		});

		it('redoes entries in the order they were undone from the end', () => {
			const order: string[] = [];
			for (const name of ['a', 'b', 'c'])
				addUndo(
					name,
					() => order.push(`undo ${name}`),
					() => order.push(`redo ${name}`)
				);

			executeLastUndo();
			executeLastUndo();
			expect(get(redoStoreLastItem)).toBe('b');
			executeLastRedo();
			executeLastRedo();

			expect(order).toEqual(['undo c', 'undo b', 'redo b', 'redo c']);
			expect(get(undoStoreLastItem)).toBe('c');
		});

		it('is discarded by a new operation', () => {
			addUndo('a', vi.fn(), vi.fn());
			addUndo('b', vi.fn(), vi.fn());
			executeLastUndo();
			expect(get(redoStoreLastItem)).toBe('b');

			addUndo('c', vi.fn(), vi.fn());

			expect(get(redoStoreLastItem)).toBeUndefined();
			expect(get(undoStoreLastItem)).toBe('c');
		});

		it('is cleared together with the undo stack', () => {
			addUndo('a', vi.fn(), vi.fn());
			executeLastUndo();

			clearUndoStack();

			expect(get(redoStoreLastItem)).toBeUndefined();
			expect(get(undoStoreHistory)).toMatchObject({ undo: 0, redo: 0 });
		});

		it('re-queues a failing redo and notifies the user', () => {
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
			const push = vi.spyOn(toastStore, 'push');
			let shouldFail = true;
			const redo = vi.fn(() => {
				if (shouldFail) throw new Error('inconsistent');
			});
			addUndo('Modify circle', vi.fn(), redo);
			executeLastUndo();

			executeLastRedo();

			expect(get(redoStoreLastItem)).toBe('Modify circle');
			expect(get(undoStoreLastItem)).toBeUndefined();
			expect(push).toHaveBeenCalledWith('error', 'Failed to redo: Modify circle', 5000);
			expect(consoleError).toHaveBeenCalled();

			shouldFail = false;
			executeLastRedo();

			expect(redo).toHaveBeenCalledTimes(2);
			expect(get(undoStoreLastItem)).toBe('Modify circle');
		});

		it('keeps the total within the limit across undo/redo cycles', () => {
			for (let index = 0; index < 60; index++) addUndo(`op ${index}`, vi.fn(), vi.fn());
			for (let index = 0; index < 20; index++) executeLastUndo();
			expect(get(undoStoreHistory)).toEqual({ undo: 30, redo: 20, max: 50 });

			for (let index = 0; index < 5; index++) executeLastRedo();

			expect(get(undoStoreHistory)).toEqual({ undo: 35, redo: 15, max: 50 });
		});
	});

	describe('history counts', () => {
		it('reports both stack sizes and the limit', () => {
			expect(get(undoStoreHistory)).toEqual({ undo: 0, redo: 0, max: 50 });

			addUndo('a', vi.fn(), vi.fn());
			addUndo('b', vi.fn(), vi.fn());
			executeLastUndo();

			expect(get(undoStoreHistory)).toEqual({ undo: 1, redo: 1, max: 50 });
		});
	});

	describe('coalescing', () => {
		it('merges quick operations with the same key into the entry restoring the oldest state', () => {
			const restored: string[] = [];
			addUndo('Rotate', () => restored.push('first'), vi.fn(), 'rotate:1');
			vi.advanceTimersByTime(300);
			addUndo('Rotate', () => restored.push('second'), vi.fn(), 'rotate:1');
			addUndo('Rotate', () => restored.push('third'), vi.fn(), 'rotate:1');

			executeLastUndo();

			expect(restored).toEqual(['first']);
			expect(get(undoStoreLastItem)).toBeUndefined();
		});

		it('redoes to the newest state of a merged entry', () => {
			const applied: string[] = [];
			addUndo('Rotate', vi.fn(), () => applied.push('first'), 'rotate:1');
			addUndo('Rotate', vi.fn(), () => applied.push('second'), 'rotate:1');
			addUndo('Rotate', vi.fn(), () => applied.push('third'), 'rotate:1');

			executeLastUndo();
			executeLastRedo();

			expect(applied).toEqual(['third']);
		});

		it('starts a new entry after the window has passed', () => {
			addUndo('Rotate', vi.fn(), vi.fn(), 'rotate:1');
			vi.advanceTimersByTime(2000);
			addUndo('Rotate', vi.fn(), vi.fn(), 'rotate:1');

			executeLastUndo();

			expect(get(undoStoreLastItem)).toBe('Rotate');
		});

		it('does not merge different keys or entries without a key', () => {
			addUndo('Rotate A', vi.fn(), vi.fn(), 'rotate:a');
			addUndo('Rotate B', vi.fn(), vi.fn(), 'rotate:b');
			addUndo('Delete', vi.fn(), vi.fn());
			addUndo('Delete', vi.fn(), vi.fn());

			let count = 0;
			while (get(undoStoreLastItem) !== undefined) {
				executeLastUndo();
				count++;
			}

			expect(count).toBe(4);
		});
	});
});
