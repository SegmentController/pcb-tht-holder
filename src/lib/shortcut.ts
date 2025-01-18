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

/**
 * Svelte action for handling keyboard shortcuts with advanced configuration.
 *
 * @remarks
 * Allows dynamic configuration of keyboard shortcuts with support for multiple triggers,
 * modifier keys, and custom event handling.
 *
 * @param node - The HTML element to attach the keyboard shortcut listener
 * @param parameter - Configuration parameters for the keyboard shortcut
 * @returns An object with update and destroy methods for managing the shortcut action
 *
 * @example
 * ```typescript
 * // Basic usage
 * <div use:shortcut={{
 *   trigger: { key: 'Enter', callback: () => handleSubmit() }
 * }} />
 *
 * // Advanced usage with modifiers
 * <div use:shortcut={{
 *   trigger: { 
 *     key: 'S', 
 *     modifier: ['ctrl'], 
 *     callback: () => saveDocument() 
 *   }
 * }} />
 * ```
 *
 * @beta
 */
export function shortcut(node: HTMLElement, parameter: ShortcutParameter) {
	let { enabled = true, trigger, type = 'keydown' } = parameter;

	function handler(event: KeyboardEvent) {
		const normalizedTriggers = Array.isArray(trigger) ? trigger : [trigger];
		/** @type {Record<import('./public').ShortcutModifier, boolean>} */
		const modifiedMap = {
			alt: event.altKey,
			ctrl: event.ctrlKey,
			shift: event.shiftKey,
			meta: event.metaKey
		};
		for (const trigger of normalizedTriggers) {
			const mergedTrigger = {
				modifier: [],
				preventDefault: false,
				enabled: true,
				...trigger
			};
			const { modifier, key, callback, preventDefault, enabled: triggerEnabled } = mergedTrigger;
			if (triggerEnabled) {
				if (modifier.length > 0) {
					const modifierDefs = (Array.isArray(modifier) ? modifier : [modifier]).map((deferred) =>
						typeof deferred === 'string' ? [deferred] : deferred
					);
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
						trigger: mergedTrigger,
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

			if (enabled && (!currentEnabled || type !== currentType)) {
				node.removeEventListener(type, handler);
			} else if (!enabled && currentEnabled) {
				node.addEventListener(currentType, handler);
			}

			enabled = currentEnabled;
			type = currentType;
			trigger = update.trigger;
		},
		destroy: () => {
			node.removeEventListener(type, handler);
		}
	};
}
