import { get } from 'svelte/store';

import { modalStore } from '$stores/modalStore';

export interface ShortcutAttributes {
	'on:shortcut'?: (event: CustomEvent<ShortcutEventDetail>) => void;
}

export type ShortcutModifier = 'alt' | 'ctrl' | 'meta' | 'shift';

export type ShortcutModifierDefinition =
	ShortcutModifier | ShortcutModifier[] | ShortcutModifier[][];

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

const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'radio', 'range', 'submit']);

/** True when the focused control consumes this key itself (text entry, select, range arrows) */
const isHandledByFocusedControl = (event: KeyboardEvent) => {
	const target = event.target;
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
	if (target instanceof HTMLSelectElement) return true;
	if (target instanceof HTMLInputElement)
		return target.type === 'range'
			? event.key.startsWith('Arrow')
			: !NON_TEXT_INPUT_TYPES.has(target.type);
	return false;
};

export function shortcut(node: HTMLElement, parameter: ShortcutParameter) {
	let { enabled = true, trigger, type = 'keydown' } = parameter;
	let normalizedTriggers = (Array.isArray(trigger) ? trigger : [trigger]).map((t) =>
		normalizeTrigger(t)
	);

	function handler(event: KeyboardEvent) {
		/**
		 * Modal-Aware Shortcut Handling
		 *
		 * All keyboard shortcuts are disabled when any modal dialog is open.
		 * This prevents letter shortcuts from interfering with text input in modal forms.
		 *
		 * Implementation: Check modalStore array length on every keypress.
		 * If modals are open (array.length > 0), exit early without processing shortcuts.
		 */
		const openModals = get(modalStore);
		if (openModals.length > 0 && event.key !== 'Escape') return; // Shortcuts disabled while modal is open, except ESC

		// Do not hijack typing / native keys of focused form controls (keep ESC working everywhere)
		if (event.key !== 'Escape' && isHandledByFocusedControl(event)) return;

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
				} else if (
					(event.ctrlKey || event.metaKey || event.altKey) &&
					!event.getModifierState('AltGraph') // AltGr (Ctrl+Alt on Windows) types characters like '*'
				)
					continue; // never swallow browser shortcuts (reload, find, zoom...)
				if (event.key === key) {
					if (preventDefault) event.preventDefault();
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
