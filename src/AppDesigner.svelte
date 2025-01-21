<script lang="ts" module>
	export type DesignerMode = 'pointer' | 'measure';
</script>

<script lang="ts">
	import { type Writable, writable } from 'svelte/store';
	import {
		Circle,
		Image,
		type KonvaDragTransformEvent,
		type KonvaMouseEvent,
		Layer,
		Line,
		Rect,
		Stage,
		Text
	} from 'svelte-konva';

	import ContextMenu from '$components/base/ContextMenu.svelte';
	import ZoomRange from '$components/base/input/ZoomRange.svelte';
	import {
		getContextMenuItemForCircle,
		modifyCircle,
		updateCircleChanges
	} from '$lib/elements/circle';
	import {
		deleteLegWithConfirm,
		getContextMenuItemForLeg,
		updateLegChanges
	} from '$lib/elements/leg';
	import {
		getContextMenuItemForRectangle,
		modifyRectangle,
		updateRectangleChanges
	} from '$lib/elements/rectangle';
	import { deselectElementByMouseLeave, selectElementByMouseEnter } from '$lib/fineMovement';
	import {
		empytMeasurementInfo,
		type MeasurementInfo,
		stageMeasureModeMouseDown,
		stageMeasureModeMouseUp,
		stageMouseMove
	} from '$lib/measurement';
	import { projectStore } from '$stores/projectStore';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import { LEG_SIZE, type LegData } from '$types/LegData';
	import type { RectangleData } from '$types/RectangleData';

	interface Properties {
		pcbImage: HTMLImageElement | undefined;
		imageSize: ImageSize | undefined;
		mode: DesignerMode;
	}

	const {
		pcbImage = $bindable(),
		imageSize = $bindable(),
		mode = $bindable()
	}: Properties = $props();

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

	let contextMenu: ContextMenu | undefined = $state();
	const stageClick = (event: KonvaMouseEvent) => {
		if (event.evt.button === 2 && mode === 'pointer') {
			const id = event.target.id();

			for (const retriever of [
				getContextMenuItemForCircle,
				getContextMenuItemForRectangle,
				getContextMenuItemForLeg
			]) {
				const items = retriever(id);
				if (items !== undefined) {
					contextMenu?.setItems(items);
					contextMenu?.toggleAt(event.evt.pageX, event.evt.pageY);
					return;
				}
			}
		}
	};

	const measurementInfo: Writable<MeasurementInfo> = writable(empytMeasurementInfo);
</script>

{#if imageSize}
	{@const getStageScaleX =
		(imageSize.width / $projectStore.panelSettings.width) * ($projectStore.zoom / 100)}
	{@const getStageScaleY =
		(imageSize.height / $projectStore.panelSettings.height) * ($projectStore.zoom / 100)}

	<div class="flex justify-center mb-2">
		<ZoomRange class="w-2/5" bind:value={$projectStore.zoom} min={10} max={300} step={10} />
	</div>
	<div class="flex justify-center">
		<Stage
			onmousemove={(event) =>
				stageMouseMove(event, mode === 'measure', measurementInfo, getStageScaleX, getStageScaleY)}
			onmousedown={(event) => {
				if (mode === 'measure')
					stageMeasureModeMouseDown(event, measurementInfo, getStageScaleX, getStageScaleY);
			}}
			onmouseup={(event) => {
				if (mode === 'measure') stageMeasureModeMouseUp(event, measurementInfo);
			}}
			onclick={stageClick}
			width={imageSize.width * ($projectStore.zoom / 100)}
			height={imageSize.height * ($projectStore.zoom / 100)}
			scaleX={getStageScaleX}
			scaleY={getStageScaleY}
		>
			<Layer>
				<Image
					image={pcbImage}
					scaleX={$projectStore.panelSettings.width / imageSize.width}
					scaleY={(-1 * $projectStore.panelSettings.height) / imageSize.height}
					offsetY={imageSize.height}
					opacity={0.25}
				/>
				{#each $projectStore.circles as circle}
					<Circle
						id={circle.id}
						fill="orange"
						draggable={mode === 'pointer'}
						opacity={0.75}
						radius={circle.radius}
						bind:x={circle.x}
						bind:y={circle.y}
						onmouseenter={(event) => selectElementByMouseEnter(event, circle, mode === 'measure')}
						onmouseleave={(event) => deselectElementByMouseLeave(event, circle, mode === 'measure')}
						ondblclick={() => modifyCircle(circle)}
						ondragmove={(event) => limitCircle(event, circle)}
						ondragend={() => updateCircleChanges()}
					/>
				{/each}
				{#each $projectStore.rectangles as rectangle}
					<Rect
						id={rectangle.id}
						fill="green"
						draggable={mode === 'pointer'}
						opacity={0.75}
						width={rectangle.width}
						height={rectangle.height}
						bind:x={rectangle.x}
						bind:y={rectangle.y}
						onmouseenter={(event) =>
							selectElementByMouseEnter(event, rectangle, mode === 'measure')}
						onmouseleave={(event) =>
							deselectElementByMouseLeave(event, rectangle, mode === 'measure')}
						ondblclick={() => modifyRectangle(rectangle)}
						ondragmove={(event) => limitBox(event, rectangle)}
						ondragend={() => updateRectangleChanges()}
					/>
				{/each}
				{#each $projectStore.legs as leg}
					<Rect
						id={leg.id}
						fill="gray"
						draggable={mode === 'pointer'}
						opacity={0.75}
						width={leg.width}
						height={leg.height}
						bind:x={leg.x}
						bind:y={leg.y}
						onmouseenter={(event) => selectElementByMouseEnter(event, leg, mode === 'measure')}
						onmouseleave={(event) => deselectElementByMouseLeave(event, leg, mode === 'measure')}
						ondblclick={() => deleteLegWithConfirm(leg)}
						ondragmove={(event) => limitBox(event, leg)}
						ondragend={() => updateLegChanges()}
					/>
				{/each}
				{#if $measurementInfo.visible}
					<Line
						listening={false}
						dashEnabled
						dash={[0.5, 0.5]}
						points={[
							$measurementInfo.startPoint.x,
							$measurementInfo.startPoint.y,
							$measurementInfo.endPoint.x,
							$measurementInfo.endPoint.y
						]}
						stroke="#000"
						opacity={0.75}
						strokeWidth={0.25}
					/>
					<Text
						listening={false}
						align="center"
						verticalAlign="center"
						x={($measurementInfo.textPoint.x < $projectStore.panelSettings.width / 2 ? 5 : -5) +
							$measurementInfo.textPoint.x}
						y={($measurementInfo.textPoint.y < $projectStore.panelSettings.height / 2 ? 5 : -5) +
							$measurementInfo.textPoint.y}
						fontSize={3}
						opacity={0.75}
						text={$measurementInfo.text}
					/>
				{/if}
			</Layer>
		</Stage>
		<ContextMenu bind:this={contextMenu} />
	</div>
{/if}
