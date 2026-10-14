import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getLibraryStoreValue, setLibraryStoreValue } from '$stores/libraryStore';
import { showModalCircleSettings, showModalConfirm, showModalNameEdit } from '$stores/modalStore';
import { getProjectStoreValue } from '$stores/projectStore';
import { clearUndoStack, executeLastRedo, executeLastUndo } from '$stores/undoStore';
import { undoStoreLastItem } from '$stores/undoStore';

import {
	addCircleToLibrary,
	addNewCircle,
	deleteCircle,
	duplicateCircle,
	getContextMenuItemForCircle,
	modifyCircle,
	moveCircle
} from './circle';
import { circleOf, PANEL, resetProject } from './elementTestUtilities';

vi.mock('$stores/modalStore', () => ({
	showModalCircleSettings: vi.fn(),
	showModalConfirm: vi.fn(),
	showModalNameEdit: vi.fn()
}));

const circles = () => getProjectStoreValue().circles;
const lastUndoName = () => get(undoStoreLastItem);

describe('circle operations', () => {
	beforeEach(() => {
		resetProject({ circles: [circleOf('a', 2, 5)] });
		setLibraryStoreValue([]);
	});

	afterEach(() => {
		clearUndoStack();
		vi.resetAllMocks();
	});

	describe('addNewCircle', () => {
		it('places a copy of the source in the centre of the panel without asking', async () => {
			await addNewCircle({ radius: 3.5, depth: 7 });

			expect(showModalCircleSettings).not.toHaveBeenCalled();
			expect(circles()).toHaveLength(2);
			expect(circles()[1]).toMatchObject({
				x: PANEL.width / 2,
				y: PANEL.height / 2,
				radius: 3.5,
				depth: 7
			});
			expect(circles()[1].id).not.toBe(circles()[0].id);
		});

		it('applies the settings confirmed in the dialog', async () => {
			vi.mocked(showModalCircleSettings).mockResolvedValue({
				confirmed: true,
				settings: { radius: 4, depth: 9 }
			});

			await addNewCircle();

			expect(circles()).toHaveLength(2);
			expect(circles()[1]).toMatchObject({ radius: 4, depth: 9 });
		});

		it('opens the dialog with the defaults and discards the circle when it is cancelled', async () => {
			vi.mocked(showModalCircleSettings).mockResolvedValue({
				confirmed: false,
				settings: { radius: 0, depth: 0 }
			});

			await addNewCircle();

			expect(showModalCircleSettings).toHaveBeenCalledWith(
				expect.objectContaining({ radius: 10, depth: 5 })
			);
			expect(circles().map((circle) => circle.id)).toEqual(['a']);
			expect(lastUndoName()).toBeUndefined();
		});

		it('duplicates through the source overload', async () => {
			await duplicateCircle(circles()[0]);

			expect(circles()).toHaveLength(2);
			expect(circles()[1]).toMatchObject({ radius: 2, depth: 5, x: 30, y: 20 });
		});
	});

	describe('modifyCircle', () => {
		it('applies confirmed changes and registers an undo/redo pair', async () => {
			const [circle] = circles();
			vi.mocked(showModalCircleSettings).mockResolvedValue({
				confirmed: true,
				settings: { radius: 6, depth: 8 }
			});

			await modifyCircle(circle);
			expect(circle).toMatchObject({ radius: 6, depth: 8 });
			expect(lastUndoName()).toBe('Modify circle');

			executeLastUndo();
			expect(circle).toMatchObject({ radius: 2, depth: 5 });

			executeLastRedo();
			expect(circle).toMatchObject({ radius: 6, depth: 8 });
		});

		it('registers nothing when the confirmed values are the old ones', async () => {
			const [circle] = circles();
			vi.mocked(showModalCircleSettings).mockResolvedValue({
				confirmed: true,
				settings: { radius: 2, depth: 5 }
			});

			await modifyCircle(circle);

			expect(lastUndoName()).toBeUndefined();
		});

		it('leaves the circle alone when the dialog is cancelled', async () => {
			const [circle] = circles();
			vi.mocked(showModalCircleSettings).mockResolvedValue({
				confirmed: false,
				settings: { radius: 6, depth: 8 }
			});

			await modifyCircle(circle);

			expect(circle).toMatchObject({ radius: 2, depth: 5 });
			expect(lastUndoName()).toBeUndefined();
		});
	});

	it('deletes with an undo entry that brings the circle back', () => {
		const [circle] = circles();

		deleteCircle(circle);
		expect(circles()).toEqual([]);
		expect(lastUndoName()).toBe('Delete circle');

		executeLastUndo();
		expect(circles()).toEqual([circle]);
	});

	it('moves with an undo entry', () => {
		const [circle] = circles();

		moveCircle(circle, 20, 25);
		expect([circle.x, circle.y]).toEqual([20, 25]);
		expect(lastUndoName()).toBe('Move circle');

		executeLastUndo();
		expect([circle.x, circle.y]).toEqual([10, 10]);
	});

	describe('addCircleToLibrary', () => {
		it('stores the dimensions under the chosen name', async () => {
			vi.mocked(showModalNameEdit).mockResolvedValue({ confirmed: true, name: 'Electrolytic' });

			await addCircleToLibrary(circles()[0]);

			expect(showModalNameEdit).toHaveBeenCalledWith('circle');
			expect(getLibraryStoreValue()).toEqual([
				{ type: 'circle', name: 'Electrolytic', radius: 2, depth: 5 }
			]);
		});

		it('stores nothing when the name dialog is cancelled', async () => {
			vi.mocked(showModalNameEdit).mockResolvedValue({ confirmed: false, name: 'x' });

			await addCircleToLibrary(circles()[0]);

			expect(getLibraryStoreValue()).toEqual([]);
		});
	});

	describe('getContextMenuItemForCircle', () => {
		it('has no menu for an unknown element', () => {
			expect(getContextMenuItemForCircle('missing')).toBeUndefined();
		});

		it('lists the dimensions as header followed by the actions', () => {
			const items = getContextMenuItemForCircle('a')!;
			expect(items.map((item) => item.name)).toEqual([
				'Circle 2x5mm',
				'Properties...',
				'Duplicate',
				'Add to library...',
				'',
				'Delete'
			]);
		});

		it('deletes only after the confirmation', async () => {
			const remove = getContextMenuItemForCircle('a')!.find((item) => item.name === 'Delete')!;

			vi.mocked(showModalConfirm).mockResolvedValue({ confirmed: false });
			await remove.onClick!({});
			expect(circles()).toHaveLength(1);

			vi.mocked(showModalConfirm).mockResolvedValue({ confirmed: true });
			await remove.onClick!({});
			expect(circles()).toHaveLength(0);
		});
	});
});
