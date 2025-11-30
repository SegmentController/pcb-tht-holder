import type { Action, ActionReturn } from 'svelte/action';

export interface ShortcutAttributes {
	'on:shortcut'?: (event: CustomEvent<ShortcutEventDetail>) => void;
}

export type ShortcutModifier = 'alt' | 'ctrl' | 'meta' | 'shift';

export type ShortcutModifierDefinition =
	| ShortcutModifier
	| ShortcutModifier[]
	| ShortcutModifier[][];

export interface ShortcutTrigger {
	enabled?: boolean;
	modifier?: ShortcutModifierDefinition;
	id?: string;
	key: string;
	callback?: (detail: ShortcutEventDetail) => void;
	preventDefault?: boolean;
}

export interface ShortcutParameter {
	enabled?: boolean;
	trigger: Array<ShortcutTrigger> | ShortcutTrigger;
	type?: 'keydown' | 'keyup';
}

export interface ShortcutEventDetail {
	node: HTMLElement;
	trigger: ShortcutTrigger;
	originalEvent: KeyboardEvent;
}

export type ShortcutAction = Action<HTMLElement, ShortcutParameter, ShortcutAttributes>;

export type ShortcutActionReturn = ActionReturn<ShortcutParameter, ShortcutAttributes>;

type NormalizedTrigger = Omit<ShortcutTrigger, 'modifier'> & {
	modifierDefs: ShortcutModifier[][];
};

const normalizeTrigger = (trigger: ShortcutTrigger): NormalizedTrigger => {
	const { modifier = [], ...rest } = trigger;
	const modifierDefs = (Array.isArray(modifier) ? modifier : [modifier]).map((deferred) =>
		typeof deferred === 'string' ? [deferred] : deferred
	);
	return { ...rest, modifierDefs };
};

export function shortcut(node: HTMLElement, parameter: ShortcutParameter) {
	let { enabled = true, trigger, type = 'keydown' } = parameter;
	let normalizedTriggers = (Array.isArray(trigger) ? trigger : [trigger]).map((t) =>
		normalizeTrigger(t)
	);

	function handler(event: KeyboardEvent) {
		/** @type {Record<import('./public').ShortcutModifier, boolean>} */
		const modifiedMap = {
			alt: event.altKey,
			ctrl: event.ctrlKey,
			shift: event.shiftKey,
			meta: event.metaKey
		};
		for (const normalizedTrigger of normalizedTriggers) {
			const {
				modifierDefs,
				key,
				callback,
				preventDefault = false,
				enabled: triggerEnabled = true
			} = normalizedTrigger;
			if (triggerEnabled) {
				if (modifierDefs.length > 0) {
					const modified = modifierDefs.some((deferred) =>
						deferred.every((modifier) => modifiedMap[modifier])
					);
					if (!modified) continue;
				}
				if (event.key === key) {
					if (preventDefault) event.preventDefault();
					/** @type {import('./public').ShortcutEventDetail} */
					const detail = {
						node,
						trigger: normalizedTrigger as ShortcutTrigger,
						originalEvent: event
					};
					node.dispatchEvent(new CustomEvent('shortcut', { detail }));
					callback?.(detail);
				}
			}
		}
	}

	if (enabled) node.addEventListener(type, handler);

	return {
		update: (update: ShortcutParameter) => {
			const { enabled: currentEnabled = true, type: currentType = 'keydown' } = update;

			if (enabled && (!currentEnabled || type !== currentType))
				node.removeEventListener(type, handler);
			else if (!enabled && currentEnabled) node.addEventListener(currentType, handler);

			enabled = currentEnabled;
			type = currentType;
			trigger = update.trigger;
			normalizedTriggers = (Array.isArray(trigger) ? trigger : [trigger]).map((t) =>
				normalizeTrigger(t)
			);
		},
		destroy: () => {
			node.removeEventListener(type, handler);
		}
	};
}
