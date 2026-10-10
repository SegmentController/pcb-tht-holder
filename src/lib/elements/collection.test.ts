import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProjectStoreValue, projectStore, setProjectStoreValue } from '$stores/projectStore';
import { clearUndoStack, executeLastUndo, undoStoreLastItem } from '$stores/undoStore';
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

	it('notifies store subscribers on update', () => {
		const seen: number[] = [];
		const unsubscribe = projectStore.subscribe((value) => seen.push(value.circles.length));

		circles.update([circle('only')]);
		unsubscribe();

		expect(seen.at(-1)).toBe(1);
	});
});
