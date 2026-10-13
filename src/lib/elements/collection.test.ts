import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectStoreValue, projectStore, setProjectStoreValue } from '$stores/projectStore';
import {
	clearUndoStack,
	executeLastRedo,
	executeLastUndo,
	undoStoreLastItem
} from '$stores/undoStore';
import { CircleData } from '$types/CircleData';
import { Project } from '$types/Project';

import { createElementCollection } from './collection';

const circle = (id: string) => CircleData.parse({ id, x: 1, y: 1, radius: 2, depth: 5 });

describe('createElementCollection', () => {
	const circles = createElementCollection('circles');

	beforeEach(() => {
		vi.useFakeTimers();
		setProjectStoreValue(
			Project.parse({
				name: 'p',
				image: '',
				zoom: 100,
				panelSettings: {
					width: 50,
					height: 50,
					pcbThickness: 1.6,
					smdHeight: 3,
					printTolerance: 0
				},
				circles: [circle('a'), circle('b')],
				rectangles: [],
				legs: []
			})
		);
		clearUndoStack();
	});

	afterEach(() => {
		clearUndoStack();
		vi.useRealTimers();
	});

	it('removes an element without registering an undo entry', () => {
		const [first] = getProjectStoreValue().circles;

		circles.remove(first!);

		expect(getProjectStoreValue().circles.map((c) => c.id)).toEqual(['b']);
		expect(get(undoStoreLastItem)).toBeUndefined();
	});

	it('removes with an undo entry that puts the same element back', () => {
		const [first] = getProjectStoreValue().circles;

		circles.removeWithUndo(first!, 'Delete circle');
		expect(getProjectStoreValue().circles).toHaveLength(1);
		expect(get(undoStoreLastItem)).toBe('Delete circle');

		executeLastUndo();

		const ids = getProjectStoreValue().circles.map((c) => c.id);
		expect(ids.toSorted()).toEqual(['a', 'b']);
		expect(getProjectStoreValue().circles).toContain(first);
	});

	it('redoes a deletion and undoes it again with the same element', () => {
		const [first] = getProjectStoreValue().circles;
		circles.removeWithUndo(first!, 'Delete circle');
		executeLastUndo();
		expect(getProjectStoreValue().circles).toContain(first);

		executeLastRedo();

		expect(getProjectStoreValue().circles.map((c) => c.id)).toEqual(['b']);
		expect(get(undoStoreLastItem)).toBe('Delete circle');

		executeLastUndo();

		expect(getProjectStoreValue().circles).toContain(first);
	});

	describe('moveWithUndo', () => {
		const first = () => getProjectStoreValue().circles[0]!;
		const position = (element: { x: number; y: number }) => [element.x, element.y];

		it('moves the element and registers an entry that restores and re-applies the position', () => {
			const element = first();
			const start = position(element);

			circles.moveWithUndo(element, 10, 20, 'Move circle');
			expect(position(element)).toEqual([10, 20]);
			expect(get(undoStoreLastItem)).toBe('Move circle');

			executeLastUndo();
			expect(position(element)).toEqual(start);

			executeLastRedo();
			expect(position(element)).toEqual([10, 20]);
		});

		it('registers nothing when the position does not change', () => {
			const element = first();
			const [x, y] = position(element) as [number, number];

			circles.moveWithUndo(element, x, y, 'Move circle');

			expect(get(undoStoreLastItem)).toBeUndefined();
		});

		it('merges quick moves with the same key into one entry restoring the first position', () => {
			const element = first();
			const start = position(element) as [number, number];

			for (const step of [1, 2, 3])
				circles.moveWithUndo(element, start[0] + step, start[1], 'Move circle', 'nudge:a');
			executeLastUndo();

			expect(position(element)).toEqual(start);
			expect(get(undoStoreLastItem)).toBeUndefined();

			executeLastRedo();
			expect(position(element)).toEqual([start[0] + 3, start[1]]);
		});

		it('keeps separate entries for moves without a key', () => {
			const element = first();
			const start = position(element) as [number, number];

			circles.moveWithUndo(element, start[0] + 1, start[1], 'Move circle');
			circles.moveWithUndo(element, start[0] + 2, start[1], 'Move circle');
			executeLastUndo();

			expect(position(element)).toEqual([start[0] + 1, start[1]]);
			expect(get(undoStoreLastItem)).toBe('Move circle');
		});
	});

	it('notifies store subscribers on update', () => {
		const seen: number[] = [];
		const unsubscribe = projectStore.subscribe((value) => seen.push(value.circles.length));

		circles.update([circle('only')]);
		unsubscribe();

		expect(seen.at(-1)).toBe(1);
	});
});
