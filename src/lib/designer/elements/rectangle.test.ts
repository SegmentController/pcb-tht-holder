import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getLibraryStoreValue, setLibraryStoreValue } from '$stores/libraryStore';
import {
	showModalConfirm,
	showModalNameEdit,
	showModalRectangleSettings
} from '$stores/modalStore';
import { getProjectStoreValue } from '$stores/projectStore';
import {
	clearUndoStack,
	executeLastRedo,
	executeLastUndo,
	undoStoreLastItem
} from '$stores/undoStore';

import { PANEL, rectangleOf, resetProject } from './elementTestUtilities';
import {
	addNewRectangle,
	addRectangleToLibrary,
	deleteRectangle,
	duplicateRectangle,
	flipRectangleDimensions,
	getContextMenuItemForRectangle,
	modifyRectangle,
	moveRectangle,
	resetRectangleRotation,
	rotateRectangleDegrees
} from './rectangle';

vi.mock('$stores/modalStore', () => ({
	showModalConfirm: vi.fn(),
	showModalNameEdit: vi.fn(),
	showModalRectangleSettings: vi.fn()
}));

const rectangles = () => getProjectStoreValue().rectangles;
const lastUndoName = () => get(undoStoreLastItem);

describe('rectangle operations', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetProject({ rectangles: [rectangleOf('a', 8, 4, 30)] });
		setLibraryStoreValue([]);
	});

	afterEach(() => {
		clearUndoStack();
		vi.resetAllMocks();
		vi.useRealTimers();
	});

	describe('addNewRectangle', () => {
		it('places a copy of the source in the centre of the panel without asking', async () => {
			await addNewRectangle({ width: 12, height: 6, depth: 9, rotation: 45 });

			expect(showModalRectangleSettings).not.toHaveBeenCalled();
			expect(rectangles()).toHaveLength(2);
			expect(rectangles()[1]).toMatchObject({
				x: PANEL.width / 2,
				y: PANEL.height / 2,
				width: 12,
				height: 6,
				depth: 9,
				rotation: 45
			});
		});

		it('applies the settings confirmed in the dialog', async () => {
			vi.mocked(showModalRectangleSettings).mockResolvedValue({
				confirmed: true,
				settings: { width: 20, height: 10, depth: 3, rotation: 90 }
			});

			await addNewRectangle();

			expect(rectangles()[1]).toMatchObject({ width: 20, height: 10, depth: 3, rotation: 90 });
		});

		it('offers 10x5x5 and discards the rectangle when the dialog is cancelled', async () => {
			vi.mocked(showModalRectangleSettings).mockResolvedValue({
				confirmed: false,
				settings: { width: 0, height: 0, depth: 0, rotation: 0 }
			});

			await addNewRectangle();

			expect(showModalRectangleSettings).toHaveBeenCalledWith(
				expect.objectContaining({ width: 10, height: 5, depth: 5, rotation: 0 })
			);
			expect(rectangles().map((rectangle) => rectangle.id)).toEqual(['a']);
			expect(lastUndoName()).toBeUndefined();
		});

		it('duplicates the dimensions and rotation', async () => {
			await duplicateRectangle(rectangles()[0]);

			expect(rectangles()[1]).toMatchObject({ width: 8, height: 4, depth: 5, rotation: 30 });
			expect(rectangles()[1].id).not.toBe('a');
		});
	});

	describe('flipRectangleDimensions', () => {
		it('swaps width and height and can be undone and redone', () => {
			const [rectangle] = rectangles();

			flipRectangleDimensions(rectangle);
			expect([rectangle.width, rectangle.height]).toEqual([4, 8]);
			expect(lastUndoName()).toBe('Flip rectangle');

			executeLastUndo();
			expect([rectangle.width, rectangle.height]).toEqual([8, 4]);

			executeLastRedo();
			expect([rectangle.width, rectangle.height]).toEqual([4, 8]);
		});
	});

	describe('rotateRectangleDegrees', () => {
		it('adds the delta', () => {
			const [rectangle] = rectangles();

			rotateRectangleDegrees(rectangle, 5);

			expect(rectangle.rotation).toBe(35);
			expect(lastUndoName()).toBe('Rotate rectangle');
		});

		it('wraps around in both directions', () => {
			const [rectangle] = rectangles();
			rectangle.rotation = 357;
			rotateRectangleDegrees(rectangle, 5);
			expect(rectangle.rotation).toBe(2);

			rotateRectangleDegrees(rectangle, -5);
			expect(rectangle.rotation).toBe(357);
		});

		it('keeps the rotation inside the range the schema accepts', () => {
			const [rectangle] = rectangles();
			rectangle.rotation = 355;

			rotateRectangleDegrees(rectangle, 5);

			expect(rectangle.rotation).toBe(0);
		});

		it('merges a burst of rotations into one undo step', () => {
			const [rectangle] = rectangles();

			for (let step = 0; step < 4; step++) rotateRectangleDegrees(rectangle, 5);
			expect(rectangle.rotation).toBe(50);

			executeLastUndo();
			expect(rectangle.rotation).toBe(30);
			expect(lastUndoName()).toBeUndefined();

			executeLastRedo();
			expect(rectangle.rotation).toBe(50);
		});
	});

	describe('resetRectangleRotation', () => {
		it('sets the rotation to zero with an undo entry', () => {
			const [rectangle] = rectangles();

			resetRectangleRotation(rectangle);
			expect(rectangle.rotation).toBe(0);
			expect(lastUndoName()).toBe('Reset rotation');

			executeLastUndo();
			expect(rectangle.rotation).toBe(30);

			executeLastRedo();
			expect(rectangle.rotation).toBe(0);
		});

		it('registers nothing for an unrotated rectangle', () => {
			const [rectangle] = rectangles();
			rectangle.rotation = 0;

			resetRectangleRotation(rectangle);

			expect(lastUndoName()).toBeUndefined();
		});
	});

	describe('modifyRectangle', () => {
		it('applies confirmed changes and registers an undo/redo pair', async () => {
			const [rectangle] = rectangles();
			vi.mocked(showModalRectangleSettings).mockResolvedValue({
				confirmed: true,
				settings: { width: 9, height: 3, depth: 6, rotation: 90 }
			});

			await modifyRectangle(rectangle);
			expect(rectangle).toMatchObject({ width: 9, height: 3, depth: 6, rotation: 90 });
			expect(lastUndoName()).toBe('Modify rectangle');

			executeLastUndo();
			expect(rectangle).toMatchObject({ width: 8, height: 4, depth: 5, rotation: 30 });

			executeLastRedo();
			expect(rectangle).toMatchObject({ width: 9, height: 3, depth: 6, rotation: 90 });
		});

		it('registers nothing when only the dialog was confirmed', async () => {
			const [rectangle] = rectangles();
			vi.mocked(showModalRectangleSettings).mockResolvedValue({
				confirmed: true,
				settings: { width: 8, height: 4, depth: 5, rotation: 30 }
			});

			await modifyRectangle(rectangle);

			expect(lastUndoName()).toBeUndefined();
		});

		it('notices a change of the rotation alone', async () => {
			const [rectangle] = rectangles();
			vi.mocked(showModalRectangleSettings).mockResolvedValue({
				confirmed: true,
				settings: { width: 8, height: 4, depth: 5, rotation: 31 }
			});

			await modifyRectangle(rectangle);

			expect(rectangle.rotation).toBe(31);
			expect(lastUndoName()).toBe('Modify rectangle');
		});

		it('leaves the rectangle alone when the dialog is cancelled', async () => {
			const [rectangle] = rectangles();
			vi.mocked(showModalRectangleSettings).mockResolvedValue({
				confirmed: false,
				settings: { width: 1, height: 1, depth: 1, rotation: 1 }
			});

			await modifyRectangle(rectangle);

			expect(rectangle).toMatchObject({ width: 8, height: 4, depth: 5, rotation: 30 });
			expect(lastUndoName()).toBeUndefined();
		});
	});

	it('deletes with an undo entry that brings the rectangle back', () => {
		const [rectangle] = rectangles();

		deleteRectangle(rectangle);
		expect(rectangles()).toEqual([]);
		expect(lastUndoName()).toBe('Delete rectangle');

		executeLastUndo();
		expect(rectangles()).toEqual([rectangle]);
	});

	it('moves with an undo entry', () => {
		const [rectangle] = rectangles();

		moveRectangle(rectangle, 1, 2);
		expect([rectangle.x, rectangle.y]).toEqual([1, 2]);
		expect(lastUndoName()).toBe('Move rectangle');

		executeLastUndo();
		expect([rectangle.x, rectangle.y]).toEqual([10, 10]);
	});

	describe('addRectangleToLibrary', () => {
		it('stores dimensions and rotation under the chosen name', async () => {
			vi.mocked(showModalNameEdit).mockResolvedValue({ confirmed: true, name: 'Relay' });

			await addRectangleToLibrary(rectangles()[0]);

			expect(showModalNameEdit).toHaveBeenCalledWith('rectangle');
			expect(getLibraryStoreValue()).toEqual([
				{ type: 'rectangle', name: 'Relay', width: 8, height: 4, depth: 5, rotation: 30 }
			]);
		});

		it('stores nothing when the name dialog is cancelled', async () => {
			vi.mocked(showModalNameEdit).mockResolvedValue({ confirmed: false, name: 'x' });

			await addRectangleToLibrary(rectangles()[0]);

			expect(getLibraryStoreValue()).toEqual([]);
		});
	});

	describe('getContextMenuItemForRectangle', () => {
		it('has no menu for an unknown element', () => {
			expect(getContextMenuItemForRectangle('missing')).toBeUndefined();
		});

		it('lists the dimensions as header followed by the actions', () => {
			expect(getContextMenuItemForRectangle('a')!.map((item) => item.name)).toEqual([
				'Rectangle 8x4x5mm 30°',
				'Properties...',
				'Flip dimensions',
				'Duplicate',
				'Add to library...',
				'',
				'Delete'
			]);
		});

		it('deletes only after the confirmation', async () => {
			const remove = getContextMenuItemForRectangle('a')!.find((item) => item.name === 'Delete')!;

			vi.mocked(showModalConfirm).mockResolvedValue({ confirmed: false });
			await remove.onClick!({});
			expect(rectangles()).toHaveLength(1);

			vi.mocked(showModalConfirm).mockResolvedValue({ confirmed: true });
			await remove.onClick!({});
			expect(rectangles()).toHaveLength(0);
		});
	});
});
