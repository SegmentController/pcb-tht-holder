import { derived, writable } from 'svelte/store';

type UndoAction = () => void;
type Undoable = {
	name: string;
	action: UndoAction;
};

const undoStore = writable<Undoable[]>([]);

export const undoStoreLastItem = derived(undoStore, ($undoStore) => $undoStore.at(-1)?.name);

export const addUndo = (name: string, action: UndoAction) =>
	undoStore.update((undoables) => [...undoables, { name, action }]);

export const executeLastUndo = () =>
	undoStore.update((undoables) => {
		const last = undoables.pop();
		if (last)
			try {
				last.action();
			} catch {
				undoables.push(last);
			}
		return undoables;
	});
