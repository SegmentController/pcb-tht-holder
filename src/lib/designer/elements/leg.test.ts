import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { showModalConfirm } from '$stores/modalStore';
import { getProjectStoreValue } from '$stores/projectStore';
import {
	clearUndoStack,
	executeLastRedo,
	executeLastUndo,
	undoStoreLastItem
} from '$stores/undoStore';
import { LEG_SIZE } from '$types/LegData';

import { legOf, PANEL, resetProject } from './elementTestUtilities';
import {
	addCornerLegs,
	addNewLeg,
	deleteAllLegsWithConfirm,
	deleteLegWithConfirm,
	getContextMenuItemForLeg,
	moveLeg
} from './leg';

vi.mock('$stores/modalStore', () => ({ showModalConfirm: vi.fn() }));

const legs = () => getProjectStoreValue().legs;
const lastUndoName = () => get(undoStoreLastItem);
const confirm = (confirmed: boolean) =>
	vi.mocked(showModalConfirm).mockResolvedValue({ confirmed });

describe('leg operations', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetProject({ legs: [legOf('a'), legOf('b')] });
	});

	afterEach(() => {
		clearUndoStack();
		vi.resetAllMocks();
		vi.useRealTimers();
	});

	it('adds a leg at the centre of the panel', () => {
		addNewLeg();

		expect(legs()).toHaveLength(3);
		expect(legs()[2]).toMatchObject({
			x: PANEL.width / 2,
			y: PANEL.height / 2,
			width: LEG_SIZE,
			height: LEG_SIZE
		});
	});

	it('adds four legs one leg size inside the corners', () => {
		resetProject();

		addCornerLegs();

		const positions = legs().map((leg) => [leg.x, leg.y]);
		expect(positions).toHaveLength(4);
		expect(positions).toEqual(
			expect.arrayContaining([
				[LEG_SIZE, LEG_SIZE],
				[LEG_SIZE, PANEL.height - LEG_SIZE * 2],
				[PANEL.width - LEG_SIZE * 2, LEG_SIZE],
				[PANEL.width - LEG_SIZE * 2, PANEL.height - LEG_SIZE * 2]
			])
		);
		expect(new Set(legs().map((leg) => leg.id)).size).toBe(4);
	});

	describe('deleteLegWithConfirm', () => {
		it('deletes with an undo entry once confirmed', async () => {
			confirm(true);
			const [first] = legs();

			await deleteLegWithConfirm(first);
			expect(legs().map((leg) => leg.id)).toEqual(['b']);
			expect(lastUndoName()).toBe('Delete leg');

			executeLastUndo();
			expect(legs()).toContain(first);
		});

		it('keeps the leg when declined', async () => {
			confirm(false);

			await deleteLegWithConfirm(legs()[0]);

			expect(legs()).toHaveLength(2);
			expect(lastUndoName()).toBeUndefined();
		});
	});

	describe('deleteAllLegsWithConfirm', () => {
		it('removes every leg and brings the same ones back on undo', async () => {
			confirm(true);
			const before = [...legs()];

			await deleteAllLegsWithConfirm();
			expect(legs()).toEqual([]);
			expect(lastUndoName()).toBe('Delete all legs');

			executeLastUndo();
			expect(legs()).toEqual(before);
			expect(legs()[0]).toBe(before[0]);
		});

		it('redo removes the restored legs again', async () => {
			confirm(true);
			await deleteAllLegsWithConfirm();
			executeLastUndo();

			executeLastRedo();

			expect(legs()).toEqual([]);
		});

		it('redo leaves legs added after the deletion alone', async () => {
			confirm(true);
			await deleteAllLegsWithConfirm();
			executeLastUndo();
			addNewLeg();
			const added = legs().at(-1)!;

			executeLastRedo();

			expect(legs()).toEqual([added]);
		});

		it('keeps everything when declined', async () => {
			confirm(false);

			await deleteAllLegsWithConfirm();

			expect(legs()).toHaveLength(2);
			expect(lastUndoName()).toBeUndefined();
		});
	});

	it('moves with an undo entry', () => {
		const [leg] = legs();

		moveLeg(leg, 7, 8);
		expect([leg.x, leg.y]).toEqual([7, 8]);
		expect(lastUndoName()).toBe('Move leg');

		executeLastUndo();
		expect([leg.x, leg.y]).toEqual([3, 3]);
	});

	describe('getContextMenuItemForLeg', () => {
		it('has no menu for an unknown element', () => {
			expect(getContextMenuItemForLeg('missing')).toBeUndefined();
		});

		it('offers the deletion, which asks first', async () => {
			const items = getContextMenuItemForLeg('a')!;
			expect(items.map((item) => item.name)).toEqual(['Leg', 'Delete']);

			confirm(true);
			await items[1].onClick!({});

			expect(legs().map((leg) => leg.id)).toEqual(['b']);
		});
	});
});
