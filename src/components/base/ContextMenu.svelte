<script lang="ts" module>
	export type ContextMenuItem<T = object> = {
		name: string;
		extra?: T;
		onClick?: (itemExtra: T | undefined) => void;
	};
</script>

<script lang="ts">
	import { tick } from 'svelte';

	const MARGIN_DELTA = 16;
	let items: ContextMenuItem[];

	export const toggleAt = async (x: number, y: number) => {
		if (items.length === 0) return;

		posX = x - MARGIN_DELTA;
		posY = y - MARGIN_DELTA;
		visible = !visible;
		if (!visible) return;

		// Keyboard users continue inside the menu; Escape hands focus back to where it was
		returnFocusTo =
			document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
		await tick();
		getMenuItems()[0]?.focus();
	};
	export const setItems = (_items: ContextMenuItem[]) => (items = _items);

	let posX: number = 0;
	let posY: number = 0;
	let visible = false;
	let menu: HTMLUListElement | undefined;
	let returnFocusTo: HTMLElement | undefined;

	const getMenuItems = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

	const nextIndex: Record<string, (current: number, count: number) => number> = {
		ArrowDown: (current, count) => (current + 1) % count,
		ArrowUp: (current, count) => (current <= 0 ? count - 1 : current - 1),
		Home: () => 0,
		End: (_current, count) => count - 1
	};

	const onMenuKeydown = (event: KeyboardEvent) => {
		const next = nextIndex[event.key];
		const entries = getMenuItems();
		if (!next || entries.length === 0) return;

		event.preventDefault();
		// Keep arrow keys from also nudging the selected element (fine movement shortcut)
		event.stopPropagation();
		const current = entries.indexOf(document.activeElement as HTMLElement);
		entries[next(current, entries.length)]?.focus();
	};
</script>

<svelte:window
	onclick={() => (visible = false)}
	oncontextmenu={(event) => {
		visible = false;
		// Only the designer canvas gets the custom menu: keep the native one (copy/paste) elsewhere
		if (event.target instanceof HTMLCanvasElement) event.preventDefault();
	}}
	onkeydown={(event) => {
		if (event.key !== 'Escape' || !visible) return;
		visible = false;
		returnFocusTo?.focus();
	}}
/>

{#if visible}
	<nav style="position: absolute; top:{posY}px; left:{posX}px" class="navbar">
		<ul
			bind:this={menu}
			aria-label="Element actions"
			onkeydown={onMenuKeydown}
			role="menu"
			tabindex="-1"
		>
			{#each items as item}
				{#if item.name === ''}
					<hr />
				{:else if !item.onClick}
					<li class="group" role="presentation">{item.name}</li>
				{:else}
					<li role="none">
						<button
							onclick={() => {
								if (!item.onClick) return;
								visible = false;
								item.onClick(item.extra);
							}}
							role="menuitem"
						>
							{item.name}
						</button>
					</li>
				{/if}
			{/each}
		</ul>
	</nav>
{/if}

<style>
	.navbar {
		display: inline-flex;
		border: 1px #999 solid;
		width: auto;
		min-width: 150px;
		background-color: #fff;
		border-radius: 8px;
		overflow: hidden;
		flex-direction: column;
	}
	.navbar ul {
		margin: 6px;
	}
	ul li {
		display: block;
		list-style-type: none;
		width: 1fr;
	}
	ul li.group {
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0px 10px;
	}
	ul li button {
		font-size: 1rem;
		color: #222;
		width: 100%;
		height: 30px;
		text-align: left;
		border: 0px;
		background-color: #fff;
		padding: 0px 20px;
	}
	ul li button:hover {
		color: #000;
		text-align: left;
		border-radius: 5px;
		background-color: #eee;
	}
	hr {
		border: none;
		border-bottom: 1px solid #ccc;
		margin: 5px 0px;
	}
</style>
