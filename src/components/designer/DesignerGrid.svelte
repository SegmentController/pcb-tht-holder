<script lang="ts">
	import { Path } from 'svelte-konva';

	const GRIDSIZE_MM = 10;

	interface Properties {
		width: number;
		height: number;
	}

	const { width, height }: Properties = $props();

	const generateInterval = (length: number, step = 1) =>
		Array.from({ length: length / step }, (_, y) => step * y);

	// One path for the whole grid: a couple of Konva nodes instead of hundreds of Line nodes
	const data = $derived(
		[
			...generateInterval(height, GRIDSIZE_MM).map((y) => `M0 ${y}L${width} ${y}`),
			...generateInterval(width, GRIDSIZE_MM).map((x) => `M${x} 0L${x} ${height}`)
		].join('')
	);
</script>

<Path {data} listening={false} stroke="#ddd" strokeWidth={0.1} />
<Path dash={[0.5, 0.5]} {data} listening={false} stroke="#444" strokeWidth={0.1} />
