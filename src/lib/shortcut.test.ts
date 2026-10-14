import type { Writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { modalStore } from '$stores/modalStore';

import { shortcut, type ShortcutParameter, type ShortcutTrigger } from './shortcut';

vi.mock('$stores/modalStore', async () => {
	const { writable } = await import('svelte/store');
	return { modalStore: writable<unknown[]>([]) };
});

// The suite runs without a DOM: just enough of it for the focus checks
class FakeElement {
	isContentEditable = false;
}
class FakeInput extends FakeElement {
	constructor(public type = 'text') {
		super();
	}
}
class FakeTextArea extends FakeElement {}
class FakeSelect extends FakeElement {}

// The real store only exposes `push`/`pop`: the mock above is a plain writable
const setModals = (value: unknown[]) => (modalStore as unknown as Writable<unknown[]>).set(value);

type Handler = (event: KeyboardEvent) => void;

const createNode = () => {
	const listeners = new Map<string, Set<Handler>>();
	return {
		addEventListener: vi.fn((type: string, handler: Handler) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)!.add(handler);
		}),
		removeEventListener: vi.fn((type: string, handler: Handler) => {
			listeners.get(type)?.delete(handler);
		}),
		dispatchEvent: vi.fn(),
		listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
		fire: (type: string, event: KeyboardEvent) => {
			for (const handler of listeners.get(type) ?? []) handler(event);
		}
	};
};

type Keys = Partial<{
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altGraph: boolean;
	target: unknown;
}>;

const key = (name: string, { altGraph = false, ...rest }: Keys = {}) => {
	const event = {
		key: name,
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		target: undefined,
		preventDefault: vi.fn(),
		getModifierState: (state: string) => altGraph && state === 'AltGraph',
		...rest
	};
	return event as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
};

describe('shortcut action', () => {
	let node: ReturnType<typeof createNode>;
	const attach = (parameter: ShortcutParameter) =>
		shortcut(node as unknown as HTMLElement, parameter);
	const trigger = (overrides: Partial<ShortcutTrigger> = {}): ShortcutTrigger => ({
		key: 'p',
		callback: vi.fn(),
		...overrides
	});

	beforeEach(() => {
		node = createNode();
		setModals([]);
		vi.stubGlobal('HTMLElement', FakeElement);
		vi.stubGlobal('HTMLInputElement', FakeInput);
		vi.stubGlobal('HTMLTextAreaElement', FakeTextArea);
		vi.stubGlobal('HTMLSelectElement', FakeSelect);
	});

	afterEach(() => vi.unstubAllGlobals());

	describe('matching', () => {
		it('runs the callback with node, trigger and event for the pressed key', () => {
			const callback = vi.fn();
			const definition = trigger({ callback });
			attach({ trigger: definition });
			const event = key('p');

			node.fire('keydown', event);

			expect(callback).toHaveBeenCalledOnce();
			const detail = callback.mock.calls[0][0];
			expect(detail.node).toBe(node);
			expect(detail.originalEvent).toBe(event);
			expect(detail.trigger.key).toBe('p');
		});

		it('also dispatches a shortcut event on the node', () => {
			attach({ trigger: trigger() });

			node.fire('keydown', key('p'));

			const [dispatched] = node.dispatchEvent.mock.calls[0] as [CustomEvent];
			expect(dispatched.type).toBe('shortcut');
			expect(dispatched.detail.trigger.key).toBe('p');
		});

		it('ignores other keys and is case sensitive', () => {
			const definition = trigger();
			attach({ trigger: definition });

			node.fire('keydown', key('m'));
			node.fire('keydown', key('P', { shiftKey: true }));

			expect(definition.callback).not.toHaveBeenCalled();
		});

		it('handles several triggers, each at its own key', () => {
			const first = trigger({ key: 'p' });
			const second = trigger({ key: 'm' });
			attach({ trigger: [first, second] });

			node.fire('keydown', key('m'));

			expect(first.callback).not.toHaveBeenCalled();
			expect(second.callback).toHaveBeenCalledOnce();
		});

		it('prevents the default action only when asked to', () => {
			attach({
				trigger: [trigger({ key: 'a', preventDefault: true }), trigger({ key: 'b' })]
			});
			const a = key('a');
			const b = key('b');

			node.fire('keydown', a);
			node.fire('keydown', b);

			expect(a.preventDefault).toHaveBeenCalledOnce();
			expect(b.preventDefault).not.toHaveBeenCalled();
		});

		it('skips a disabled trigger', () => {
			const definition = trigger({ enabled: false });
			attach({ trigger: definition });

			node.fire('keydown', key('p'));

			expect(definition.callback).not.toHaveBeenCalled();
		});
	});

	describe('modifiers', () => {
		it('never swallows browser shortcuts of plain keys', () => {
			const definition = trigger();
			attach({ trigger: definition });

			node.fire('keydown', key('p', { ctrlKey: true }));
			node.fire('keydown', key('p', { metaKey: true }));
			node.fire('keydown', key('p', { altKey: true }));

			expect(definition.callback).not.toHaveBeenCalled();
		});

		it('lets AltGr characters through (Ctrl+Alt on Windows)', () => {
			const definition = trigger({ key: '*' });
			attach({ trigger: definition });

			node.fire('keydown', key('*', { ctrlKey: true, altKey: true, altGraph: true }));

			expect(definition.callback).toHaveBeenCalledOnce();
		});

		it('requires the declared modifier', () => {
			const definition = trigger({ key: 'z', modifier: 'ctrl' });
			attach({ trigger: definition });

			node.fire('keydown', key('z'));
			expect(definition.callback).not.toHaveBeenCalled();

			node.fire('keydown', key('z', { ctrlKey: true }));
			expect(definition.callback).toHaveBeenCalledOnce();
		});

		it('requires every modifier of one nested combination', () => {
			const definition = trigger({ key: 'Z', modifier: [['ctrl', 'shift']] });
			attach({ trigger: definition });

			node.fire('keydown', key('Z', { ctrlKey: true }));
			expect(definition.callback).not.toHaveBeenCalled();

			node.fire('keydown', key('Z', { ctrlKey: true, shiftKey: true }));
			expect(definition.callback).toHaveBeenCalledOnce();
		});

		it('reads a flat list as alternatives: Ctrl or Cmd', () => {
			const definition = trigger({ key: 'z', modifier: ['ctrl', 'meta'] });
			attach({ trigger: definition });

			node.fire('keydown', key('z', { ctrlKey: true }));
			node.fire('keydown', key('z', { metaKey: true }));
			node.fire('keydown', key('z', { shiftKey: true }));

			expect(definition.callback).toHaveBeenCalledTimes(2);
		});

		it('accepts any of several combinations', () => {
			const definition = trigger({ key: 'z', modifier: [['ctrl'], ['meta']] });
			attach({ trigger: definition });

			node.fire('keydown', key('z', { ctrlKey: true }));
			node.fire('keydown', key('z', { metaKey: true }));
			node.fire('keydown', key('z', { altKey: true }));

			expect(definition.callback).toHaveBeenCalledTimes(2);
		});

		it('fires an unmodified trigger when shift is held (the key itself changes)', () => {
			const definition = trigger({ key: '+' });
			attach({ trigger: definition });

			node.fire('keydown', key('+', { shiftKey: true }));

			expect(definition.callback).toHaveBeenCalledOnce();
		});
	});

	describe('modals', () => {
		it('is silent while a modal is open', () => {
			const definition = trigger();
			attach({ trigger: definition });
			setModals([{}]);

			node.fire('keydown', key('p'));
			expect(definition.callback).not.toHaveBeenCalled();

			setModals([]);
			node.fire('keydown', key('p'));
			expect(definition.callback).toHaveBeenCalledOnce();
		});

		it('still reports Escape while a modal is open', () => {
			const definition = trigger({ key: 'Escape' });
			attach({ trigger: definition });
			setModals([{}]);

			node.fire('keydown', key('Escape'));

			expect(definition.callback).toHaveBeenCalledOnce();
		});
	});

	describe('focused controls', () => {
		const pressedIn = (target: unknown, name = 'p') => {
			const definition = trigger({ key: name });
			attach({ trigger: definition });
			node.fire('keydown', key(name, { target }));
			return vi.mocked(definition.callback!).mock.calls.length;
		};

		it('leaves typing in text fields alone', () => {
			expect(pressedIn(new FakeInput('text'))).toBe(0);
			expect(pressedIn(new FakeInput('number'))).toBe(0);
			expect(pressedIn(new FakeTextArea())).toBe(0);
			expect(pressedIn(new FakeSelect())).toBe(0);
			const editable = new FakeElement();
			editable.isContentEditable = true;
			expect(pressedIn(editable)).toBe(0);
		});

		it('reacts when a button-like input or a plain element has the focus', () => {
			for (const type of ['button', 'checkbox', 'radio', 'submit', 'range'])
				expect(pressedIn(new FakeInput(type))).toBe(1);
			expect(pressedIn(new FakeElement())).toBe(1);
			expect(pressedIn(null)).toBe(1);
		});

		it('lets a range input keep its arrow keys only', () => {
			expect(pressedIn(new FakeInput('range'), 'ArrowLeft')).toBe(0);
			expect(pressedIn(new FakeInput('range'), 'ArrowUp')).toBe(0);
			expect(pressedIn(new FakeInput('range'), 'p')).toBe(1);
		});

		it('keeps Escape working in every control', () => {
			expect(pressedIn(new FakeInput('text'), 'Escape')).toBe(1);
			expect(pressedIn(new FakeTextArea(), 'Escape')).toBe(1);
		});
	});

	describe('lifecycle', () => {
		it('listens to keydown by default and to keyup on request', () => {
			attach({ trigger: trigger() });
			expect(node.listenerCount('keydown')).toBe(1);

			const upNode = createNode();
			shortcut(upNode as unknown as HTMLElement, { trigger: trigger(), type: 'keyup' });
			expect(upNode.listenerCount('keyup')).toBe(1);
			expect(upNode.listenerCount('keydown')).toBe(0);
		});

		it('does not listen when disabled and starts when enabled by an update', () => {
			const definition = trigger();
			const action = attach({ enabled: false, trigger: definition });
			expect(node.listenerCount('keydown')).toBe(0);

			action.update({ enabled: true, trigger: definition });
			expect(node.listenerCount('keydown')).toBe(1);

			node.fire('keydown', key('p'));
			expect(definition.callback).toHaveBeenCalledOnce();
		});

		it('stops listening when disabled by an update', () => {
			const definition = trigger();
			const action = attach({ trigger: definition });

			action.update({ enabled: false, trigger: definition });
			node.fire('keydown', key('p'));

			expect(node.listenerCount('keydown')).toBe(0);
			expect(definition.callback).not.toHaveBeenCalled();
		});

		it('picks up replaced triggers without re-registering', () => {
			const before = trigger({ key: 'a' });
			const after = trigger({ key: 'b' });
			const action = attach({ trigger: before });

			action.update({ trigger: after });
			node.fire('keydown', key('a'));
			node.fire('keydown', key('b'));

			expect(node.addEventListener).toHaveBeenCalledOnce();
			expect(before.callback).not.toHaveBeenCalled();
			expect(after.callback).toHaveBeenCalledOnce();
		});

		it('moves the listener to the new event type', () => {
			const definition = trigger();
			const action = attach({ trigger: definition });

			action.update({ trigger: definition, type: 'keyup' });

			expect(node.listenerCount('keydown')).toBe(0);
			expect(node.listenerCount('keyup')).toBe(1);
			node.fire('keyup', key('p'));
			expect(definition.callback).toHaveBeenCalledOnce();
		});

		it('removes the listener on destroy', () => {
			const definition = trigger();
			const action = attach({ trigger: definition });

			action.destroy();
			node.fire('keydown', key('p'));

			expect(node.listenerCount('keydown')).toBe(0);
			expect(definition.callback).not.toHaveBeenCalled();
		});
	});
});
