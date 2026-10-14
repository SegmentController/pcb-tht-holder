<script lang="ts">
	import { Line } from 'svelte-konva';

	const LINELENGTH_PX = 2;

	interface Properties {
		x: number;
		y: number;
	}

	const { x, y }: Properties = $props();
</script>

<Line
	dashEnabled={false}
	listening={false}
	points={[x - LINELENGTH_PX / 2, y, x + LINELENGTH_PX / 2, y]}
	stroke="#000"
	strokeWidth={0.2}
/>
<Line
	dashEnabled={false}
	listening={false}
	points={[x, y - LINELENGTH_PX / 2, x, y + LINELENGTH_PX / 2]}
	stroke="#000"
	strokeWidth={0.2}
/>
