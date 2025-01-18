<script lang="ts">
	import {
		Circle,
		Image,
		type KonvaDragTransformEvent,
		type KonvaMouseEvent,
		Layer,
		Rect,
		Stage
	} from 'svelte-konva';

	import ContextMenu from '$components/base/ContextMenu.svelte';
	import ZoomRangeBottom from '$components/base/input/ZoomRangeBottom.svelte';
	import {
		getContextMenuItemForCircle,
		modifyCircle,
		updateCircleChanges
	} from '$lib/elements/circle';
	import { deleteLeg, getContextMenuItemForLeg, updateLegChanges } from '$lib/elements/leg';
	import {
		getContextMenuItemForRectangle,
		modifyRectangle,
		updateRectangleChanges
	} from '$lib/elements/rectangle';
	import { deselectElementByMouseLeave, selectElementByMouseEnter } from '$lib/fineMovement';
	import { projectStore } from '$stores/projectStore';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import { LEG_SIZE, type LegData } from '$types/LegData';
	import type { RectangleData } from '$types/RectangleData';

	export let pcbImage: HTMLImageElement | undefined;
	export let imageSize: ImageSize | undefined;

	const limitBox = (event: KonvaDragTransformEvent, box: RectangleData | LegData) => {
		const target = event.target;
		const maxX = $projectStore.panelSettings.width - ('sizeX' in box ? box.width : LEG_SIZE);
		const maxY = $projectStore.panelSettings.height - ('sizeY' in box ? box.height : LEG_SIZE);

		if (target.x() < 0) target.x(0);
		if (target.x() > maxX) target.x(maxX);
		if (target.y() < 0) target.y(0);
		if (target.y() > maxY) target.y(maxY);
	};
	const limitCircle = (event: KonvaDragTransformEvent, circle: CircleData) => {
		const target = event.target;
		const minX = circle.radius;
		const minY = circle.radius;
		const maxX = $projectStore.panelSettings.width - circle.radius;
		const maxY = $projectStore.panelSettings.height - circle.radius;

		if (target.x() < minX) target.x(minX);
		if (target.x() > maxX) target.x(maxX);
		if (target.y() < minY) target.y(minY);
		if (target.y() > maxY) target.y(maxY);
	};

	let contextMenu: ContextMenu;
	const stageClick = (event: KonvaMouseEvent) => {
		if (event.evt.button === 2) {
			const id = event.target.id();

			for (const retriever of [
				getContextMenuItemForCircle,
				getContextMenuItemForRectangle,
				getContextMenuItemForLeg
			]) {
				const items = retriever(id);
				if (items !== undefined) {
					contextMenu.setItems(items);
					contextMenu.toggleAt(event.evt.pageX, event.evt.pageY);
					return;
				}
			}
		}
	};
</script>

{#if imageSize}
	<Stage
		onclick={stageClick}
		width={imageSize.width * ($projectStore.zoom / 100)}
		height={imageSize.height * ($projectStore.zoom / 100)}
		scaleX={(imageSize.width / $projectStore.panelSettings.width) * ($projectStore.zoom / 100)}
		scaleY={(imageSize.height / $projectStore.panelSettings.height) * ($projectStore.zoom / 100)}
	>
		<Layer>
			<Image
				image={pcbImage}
				scaleX={$projectStore.panelSettings.width / imageSize.width}
				scaleY={(-1 * $projectStore.panelSettings.height) / imageSize.height}
				offsetY={imageSize.height}
				opacity={0.25}
			/>
			<ContextMenu bind:this={contextMenu} />
			{#each $projectStore.circles as circle}
				<Circle
					fill="orange"
					draggable
					opacity={0.75}
					radius={circle.radius}
					bind:x={circle.x}
					bind:y={circle.y}
					onmouseenter={(event) => selectElementByMouseEnter(event, circle)}
					onmouseleave={(event) => deselectElementByMouseLeave(event, circle)}
					ondblclick={() => modifyCircle(circle)}
					ondragmove={(event) => limitCircle(event, circle)}
					ondragend={() => updateCircleChanges()}
				/>
			{/each}
			{#each $projectStore.rectangles as rectangle}
				<Rect
					fill="green"
					draggable
					opacity={0.75}
					width={rectangle.width}
					height={rectangle.height}
					bind:x={rectangle.x}
					bind:y={rectangle.y}
					onmouseenter={(event) => selectElementByMouseEnter(event, rectangle)}
					onmouseleave={(event) => deselectElementByMouseLeave(event, rectangle)}
					ondblclick={() => modifyRectangle(rectangle)}
					ondragmove={(event) => limitBox(event, rectangle)}
					ondragend={() => updateRectangleChanges()}
				/>
			{/each}
			{#each $projectStore.legs as leg}
				<Rect
					fill="gray"
					draggable
					opacity={0.75}
					width={leg.width}
					height={leg.height}
					bind:x={leg.x}
					bind:y={leg.y}
					onmouseenter={(event) => selectElementByMouseEnter(event, leg)}
					onmouseleave={(event) => deselectElementByMouseLeave(event, leg)}
					ondblclick={() => deleteLeg(leg)}
					ondragmove={(event) => limitBox(event, leg)}
					ondragend={() => updateLegChanges()}
				/>
			{/each}
		</Layer>
	</Stage>
	<ZoomRangeBottom class="w-2/5" bind:value={$projectStore.zoom} min={10} max={200} step={5} />
{/if}
