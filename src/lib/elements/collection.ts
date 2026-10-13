import { getProjectStoreValue, projectStore } from '$stores/projectStore';
import { addUndo } from '$stores/undoStore';
import type { Project } from '$types/Project';

type ElementKey = 'circles' | 'rectangles' | 'legs';

/**
 * Shared bookkeeping of one kind of project element (circles, rectangles, legs): committing
 * changes to the store, and removing or moving elements with or without an undo entry.
 */
export const createElementCollection = <K extends ElementKey>(key: K) => {
	type Element = Project[K][number];

	const getElements = () => getProjectStoreValue()[key] as Element[];

	/** Notifies the store about in-place changes, optionally replacing the whole array */
	const update = (elements?: Element[]) =>
		projectStore.update((value) => {
			if (elements) (value[key] as Element[]) = elements;
			return value;
		});

	/** Removes the element without an undo entry (e.g. discarding a just added element) */
	const remove = (element: Element) =>
		update(getElements().filter((candidate) => candidate !== element));

	/** Removes the element and registers an undo entry that puts it back (redo removes it again) */
	const removeWithUndo = (element: Element, undoName: string) => {
		remove(element);
		addUndo(
			undoName,
			() => {
				getElements().push(element);
				update();
			},
			() => remove(element)
		);
	};

	/**
	 * Moves the element and registers an undo entry that puts it back (redo moves it again).
	 * A move to the same position registers nothing; moves with the same `coalesceKey` in quick
	 * succession (holding an arrow key) share one entry.
	 */
	const moveWithUndo = (
		element: Element,
		x: number,
		y: number,
		undoName: string,
		coalesceKey?: string
	) => {
		const { x: previousX, y: previousY } = element;
		if (x === previousX && y === previousY) return;

		const place = (placeX: number, placeY: number) => {
			element.x = placeX;
			element.y = placeY;
			update();
		};
		place(x, y);
		addUndo(
			undoName,
			() => place(previousX, previousY),
			() => place(x, y),
			coalesceKey
		);
	};

	return { update, remove, removeWithUndo, moveWithUndo };
};
