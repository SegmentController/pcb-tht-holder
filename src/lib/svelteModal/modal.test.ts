import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

import { createModalStore } from './modal';
import type { ModalStore } from './modal.types';

// Components are never rendered by the store, so any function works as a stand-in
const component = (() => {}) as never;
const other = (() => {}) as never;

// The generic pop() signature cannot infer the resolved type for stand-in components
const pop = (store: ModalStore, pushed?: unknown, value?: unknown) =>
	store.pop(pushed as never, value as never) as { id: string } | undefined;

describe('createModalStore', () => {
	it('starts empty', () => {
		expect(get(createModalStore())).toEqual([]);
	});

	it('pushes a bare component with generated id and empty props', () => {
		const store = createModalStore();

		const pushed = store.push(component);

		expect(pushed.id).toBeTruthy();
		expect(pushed.props).toEqual({});
		expect(get(store)).toHaveLength(1);
	});

	it('honors a custom id and props', () => {
		const store = createModalStore();

		const pushed = store.push({ component, id: 'custom', props: { title: 'hi' } } as never);

		expect(pushed.id).toBe('custom');
		expect(pushed.props).toEqual({ title: 'hi' });
	});

	it('pops the most recent modal and resolves its promise with the value', async () => {
		const store = createModalStore();
		store.push(component);
		const second = store.push(other);

		const popped = pop(store, undefined, 'done');

		expect(popped?.id).toBe(second.id);
		await expect(second.resolve()).resolves.toBe('done');
		expect(get(store)).toHaveLength(1);
	});

	it('pops a specific modal by id and keeps the others', async () => {
		const store = createModalStore();
		const first = store.push(component);
		const second = store.push(other);

		pop(store, first, 42);

		await expect(first.resolve()).resolves.toBe(42);
		expect(get(store).map((modal) => modal.id)).toEqual([second.id]);
	});

	it('returns undefined when popping an empty store', () => {
		expect(createModalStore().pop()).toBeUndefined();
	});

	it('reports resolved state once the modal is popped', () => {
		const store = createModalStore();
		const pushed = store.push(component);

		expect(pushed.resolved).toBe(false);
		pop(store, pushed);
		expect(pushed.resolved).toBe(true);
	});

	it('calls onPop callbacks once per pop', () => {
		const store = createModalStore();
		const pushed = store.push(component);
		const callback = vi.fn();
		store.onPop(pushed.id, callback);
		store.onPop(pushed.id, callback); // duplicate registration is ignored

		pop(store, pushed, 'v');

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith('v');
	});

	it('stops calling onPop callbacks after unsubscribing', () => {
		const store = createModalStore();
		const pushed = store.push(component);
		const callback = vi.fn();
		const unsubscribe = store.onPop(pushed.id, callback);

		unsubscribe();
		pop(store, pushed);

		expect(callback).not.toHaveBeenCalled();
	});
});
