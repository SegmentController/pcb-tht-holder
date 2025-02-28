<script lang="ts">
	import { Line } from 'svelte-konva';

	const GRIDSIZE_MM = 10;
	const GridLines = [
		{ isDash: false, color: '#ddd' },
		{ isDash: true, color: '#444' }
	];

	interface Properties {
		width: number;
		height: number;
	}

	const { width, height }: Properties = $props();

	const generateInterval = (length: number, step = 1) =>
		Array.from({ length: length / step }, (_, y) => step * y);
</script>

{#snippet line(points: number[])}
	{#each GridLines as { isDash, color }}
		<Line
			dash={[0.5, 0.5]}
			dashEnabled={isDash}
			listening={false}
			{points}
			stroke={color}
			strokeWidth={0.1}
		/>
	{/each}
{/snippet}

{#each generateInterval(height, GRIDSIZE_MM) as y}
	{@render line([0, y, width, y])}
	{#each generateInterval(width, GRIDSIZE_MM) as x}
		{@render line([x, 0, x, height])}
	{/each}
{/each}
