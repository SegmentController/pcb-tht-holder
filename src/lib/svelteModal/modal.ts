import { type ComponentProps, type ComponentType } from 'svelte';
import { writable } from 'svelte/store';

import type {
	ModalComponentBase,
	ModalComponentBaseResolved,
	ModalPushInput,
	ModalPushOutput,
	ModalResolveCallback,
	ModalResolved,
	ModalStore,
	ModalStoreOnPop,
	ModalStorePop,
	ModalStorePush
} from './modal.types';

export function createModalStore(): ModalStore {
	const { subscribe, set } = writable<
		ModalPushOutput<ModalComponentBase, ModalComponentBaseResolved>[]
	>([]);
	let modals: ModalPushOutput<ModalComponentBase, ModalComponentBaseResolved>[] = [];
	const resolveMap: Record<string, undefined | ModalResolveCallback> = {};
	const resolveCallbacks: Record<string, undefined | ModalResolveCallback[]> = {};

	const push: ModalStorePush = function <Component extends ModalComponentBase>(
		input: ModalPushInput<Component>
	): ModalPushOutput<Component> {
		let _resolve: ModalResolveCallback<Component> | undefined;
		let resolved = false;
		const promise = new Promise<ModalResolved<Component>>((resolve) => {
			_resolve = (value) => {
				resolved = true;
				resolve(value);
			};
		});

		let id: string =
			(crypto && crypto.randomUUID && crypto.randomUUID()) ?? `modal-indexed-${modals.length}`;
		let properties: ComponentProps<Component>;
		let component: ComponentType<Component>;
		if (typeof input === 'function') {
			component = input;
			properties = {} as ComponentProps<Component>;
		} else {
			id = input.id ?? id;
			properties = input.props ?? ({} as ComponentProps<Component>);
			component = input.component;
		}

		const pushed: ModalPushOutput<Component> = {
			id,
			props: properties,
			component,
			resolve: () => promise,
			resolved
		};

		modals.push(pushed);
		resolveMap[pushed.id] = _resolve as unknown as ModalResolveCallback;

		set([...modals]);

		return pushed;
	};

	const pop: ModalStorePop = function <
		Pushed extends ModalPushOutput<Component, Resolved>,
		Component extends ModalComponentBase,
		Resolved extends ModalResolved<Component>
	>(pushed?: Pushed, resolved?: Resolved) {
		let popped: Pushed | undefined;
		if (pushed?.id) {
			modals = modals.filter((modal) => {
				if (modal.id === pushed.id) {
					popped = modal as Pushed;
					return false;
				}
				return true;
			});
			set(modals);
		} else {
			popped = modals.pop() as Pushed;
			set([...modals]);
		}
		if (popped) {
			const rResolved = resolved as Resolved;
			resolveMap[popped.id]?.(rResolved);
			resolveMap[popped.id] = undefined;
			if (resolveCallbacks[popped.id])
				for (const callback of resolveCallbacks[popped.id]!) callback(rResolved);
			resolveCallbacks[popped.id] = undefined;
		}
		return popped;
	};

	const onPop: ModalStoreOnPop = function (modalId, callback) {
		if (!resolveCallbacks[modalId]) resolveCallbacks[modalId] = [callback];
		else if (!resolveCallbacks[modalId]?.includes(callback))
			resolveCallbacks[modalId]?.push(callback);
		return () => {
			if (resolveCallbacks[modalId])
				resolveCallbacks[modalId] = resolveCallbacks[modalId]?.filter(
					(callback_) => callback_ !== callback
				);
		};
	};

	return {
		subscribe,
		push,
		pop,
		onPop
	};
}
