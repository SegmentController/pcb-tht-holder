/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentEvents, ComponentProps, ComponentType, SvelteComponent } from 'svelte';
import type { Writable } from 'svelte/store';

export type ModalComponentBaseResolved<ExtendedResolved extends Record<string, any> = object> =
	ExtendedResolved;

export type ModalComponentBaseEvents<
	Resolved extends ModalComponentBaseResolved = ModalComponentBaseResolved
> = { resolve: CustomEvent<Resolved> };

export type ModalResolved<Component extends ModalComponentBase> =
	ComponentEvents<Component>['resolve']['detail'];

export type ModalComponentBase = SvelteComponent<
	object,
	ModalComponentBaseEvents<ModalComponentBaseResolved>,
	object
>;

export type ModalPushInput<Component extends ModalComponentBase> =
	| ComponentType<Component>
	| {
			id?: string;
			component: ComponentType<Component>;
			props?: ComponentProps<Component>;
	  };

export interface ModalPushOutput<
	Component extends ModalComponentBase,
	Resolved extends ModalComponentBaseResolved = ModalResolved<Component>
> {
	id: string;
	component: ComponentType<Component>;
	props: ComponentProps<Component>;
	resolve: () => Promise<Resolved>;
	resolved: boolean;
}

export type ModalResolveCallback<Component extends ModalComponentBase = ModalComponentBase> = (
	resolved: ModalResolved<Component>
) => void;

export type ModalStorePush = <Component extends ModalComponentBase>(
	input: ModalPushInput<Component>
) => ModalPushOutput<Component>;

export type ModalStorePop = <
	Pushed extends ModalPushOutput<Component, Resolved>,
	Component extends ModalComponentBase,
	Resolved extends ModalResolved<Component>
>(
	pushed?: Pushed,
	resolved?: Resolved
) => Pushed | undefined;

export type ModalStoreOnPop = <Component extends ModalComponentBase = ModalComponentBase>(
	modalId: string,
	callback: ModalResolveCallback<Component>
) => () => void;

export type ModalStoreValue = ModalPushOutput<ModalComponentBase, ModalComponentBaseResolved>[];

export type ModalStoreSubscribe = Writable<ModalStoreValue>['subscribe'];

export interface ModalStore {
	subscribe: ModalStoreSubscribe;
	push: ModalStorePush;
	pop: ModalStorePop;
	onPop: ModalStoreOnPop;
}
