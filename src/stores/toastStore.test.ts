import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toastStore } from './toastStore';

const clearToasts = () => {
	for (const toast of get(toastStore)) toastStore.remove(toast.id);
};

describe('toastStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		clearToasts();
		vi.useRealTimers();
	});

	it('pushes a toast with a unique id and default duration', () => {
		toastStore.push('info', 'first');
		toastStore.push('info', 'second');

		const toasts = get(toastStore);
		expect(toasts).toHaveLength(2);
		expect(toasts[0]).toMatchObject({ type: 'info', message: 'first', duration: 3000 });
		expect(toasts[0]!.id).not.toBe(toasts[1]!.id);
	});

	it('removes a toast automatically after its duration', () => {
		toastStore.push('success', 'saved', 1000);

		vi.advanceTimersByTime(999);
		expect(get(toastStore)).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(get(toastStore)).toHaveLength(0);
	});

	it('removes only the targeted toast manually', () => {
		toastStore.push('warning', 'keep');
		toastStore.push('warning', 'drop');
		const drop = get(toastStore).find((toast) => toast.message === 'drop')!;

		toastStore.remove(drop.id);

		expect(get(toastStore).map((toast) => toast.message)).toEqual(['keep']);
	});

	it('error() pushes an error toast that lasts 5 seconds by default', () => {
		toastStore.error('boom');

		expect(get(toastStore)[0]).toMatchObject({ type: 'error', message: 'boom', duration: 5000 });
		vi.advanceTimersByTime(5000);
		expect(get(toastStore)).toHaveLength(0);
	});
});
