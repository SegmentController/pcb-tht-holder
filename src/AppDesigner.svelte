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
	let imageZoom: number = 100;

	const limitBox = (event: KonvaDragTransformEvent, box: RectangleData | LegData) => {
		const target = event.detail.target;
		const maxX = $projectStore.panelSettings.width - ('sizeX' in box ? box.width : LEG_SIZE);
		const maxY = $projectStore.panelSettings.height - ('sizeY' in box ? box.height : LEG_SIZE);

		if (target.x() < 0) target.x(0);
		if (target.x() > maxX) target.x(maxX);
		if (target.y() < 0) target.y(0);
		if (target.y() > maxY) target.y(maxY);
	};
	const limitCircle = (event: KonvaDragTransformEvent, circle: CircleData) => {
		const target = event.detail.target;
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
		if (event.detail.evt.button === 2) {
			const id = event.detail.target.id();

			for (const retriever of [
				getContextMenuItemForCircle,
				getContextMenuItemForRectangle,
				getContextMenuItemForLeg
			]) {
				const items = retriever(id);
				if (items !== undefined) {
					contextMenu.setItems(items);
					contextMenu.toggleAt(event.detail.evt.pageX, event.detail.evt.pageY);
					return;
				}
			}
		}
	};
</script>

{#if imageSize}
	<Stage
		on:click={stageClick}
		config={{
			width: imageSize.width * (imageZoom / 100),
			height: imageSize.height * (imageZoom / 100),
			scaleX: (imageSize.width / $projectStore.panelSettings.width) * (imageZoom / 100),
			scaleY: (imageSize.height / $projectStore.panelSettings.height) * (imageZoom / 100)
		}}
	>
		<Layer>
			<Image
				config={{
					image: pcbImage,
					scaleX: $projectStore.panelSettings.width / imageSize.width,
					scaleY: (-1 * $projectStore.panelSettings.height) / imageSize.height,
					offsetY: imageSize.height,
					opacity: 0.25
				}}
			/>
			<ContextMenu bind:this={contextMenu} />
			{#each $projectStore.circles as circle}
				<Circle
					bind:config={circle}
					on:mouseenter={() => selectElementByMouseEnter(circle)}
					on:mouseleave={() => deselectElementByMouseLeave(circle)}
					on:dblclick={() => modifyCircle(circle)}
					on:dragmove={(event) => limitCircle(event, circle)}
					on:dragend={() => updateCircleChanges()}
				/>
			{/each}
			{#each $projectStore.rectangles as rectangle}
				<Rect
					bind:config={rectangle}
					on:mouseenter={() => selectElementByMouseEnter(rectangle)}
					on:mouseleave={() => deselectElementByMouseLeave(rectangle)}
					on:dblclick={() => modifyRectangle(rectangle)}
					on:dragmove={(event) => limitBox(event, rectangle)}
					on:dragend={() => updateRectangleChanges()}
				/>
			{/each}
			{#each $projectStore.legs as leg}
				<Rect
					bind:config={leg}
					on:mouseenter={() => selectElementByMouseEnter(leg)}
					on:mouseleave={() => deselectElementByMouseLeave(leg)}
					on:dblclick={() => deleteLeg(leg)}
					on:dragmove={(event) => limitBox(event, leg)}
					on:dragend={() => updateLegChanges()}
				/>
			{/each}
		</Layer>
	</Stage>
	<ZoomRangeBottom class="w-2/5" bind:value={imageZoom} min={10} max={200} step={10} />
{/if}
