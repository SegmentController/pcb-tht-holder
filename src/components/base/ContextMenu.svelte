<script context="module" lang="ts">
	export type ContextMenuItem<T = object> = {
		name: string;
		extra?: T;
		onClick?: (itemExtra: T | undefined) => void;
	};
</script>

<script lang="ts">
	const MARGIN_DELTA = 16;
	let items: ContextMenuItem[];

	export const toggleAt = (x: number, y: number) => {
		if (items.length === 0) return;

		posX = x - MARGIN_DELTA;
		posY = y - MARGIN_DELTA;
		visible = !visible;
	};
	export const setItems = (_items: ContextMenuItem[]) => (items = _items);

	let posX: number = 0;
	let posY: number = 0;
	let visible = false;
</script>

<svelte:window
	on:contextmenu|preventDefault={() => (visible = false)}
	on:click={() => (visible = false)}
/>

{#if visible}
	<nav class="navbar" style="position: absolute; top:{posY}px; left:{posX}px">
		<ul>
			{#each items as item}
				{#if item.name === ''}
					<hr />
				{:else if !item.onClick}
					<li class="group">{item.name}</li>
				{:else}
					<li>
						<button
							on:click={() => {
								if (!item.onClick) return;
								visible = false;
								item.onClick(item.extra);
							}}
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
