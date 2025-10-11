<script lang="ts" module>
	export type DesignerMode = 'pointer' | 'measure';
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
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
	import HoverInfo from '$components/base/HoverInfo.svelte';
	import ZoomRange from '$components/base/input/ZoomRange.svelte';
	import DesignerCrosshair from '$components/DesignerCrosshair.svelte';
	import DesignerGrid from '$components/DesignerGrid.svelte';
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
	import {
		deselectElementByMouseLeave,
		getSelectedElementInfo,
		selectElementByMouseEnter
	} from '$lib/fineMovement';
	import {
		cleanupMeasurement,
		empytMeasurementInfo,
		type MeasurementInfo,
		stageMeasureModeMouseDown,
		stageMeasureModeMouseUp,
		stageMouseMove
	} from '$lib/measurement';
	import { projectStore } from '$stores/projectStore';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import { type LegData } from '$types/LegData';
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

		let minX = 0,
			maxX = 0,
			minY = 0,
			maxY = 0;

		// Check if it's a rectangle with rotation
		if ('rotation' in box && box.rotation !== 0) {
			const angleRad = (box.rotation * Math.PI) / 180;
			const cos = Math.cos(angleRad);
			const sin = Math.sin(angleRad);

			// Four corners relative to center
			const halfWidth = box.width / 2;
			const halfHeight = box.height / 2;
			const corners = [
				{ dx: -halfWidth, dy: -halfHeight }, // top-left
				{ dx: halfWidth, dy: -halfHeight }, // top-right
				{ dx: halfWidth, dy: halfHeight }, // bottom-right
				{ dx: -halfWidth, dy: halfHeight } // bottom-left
			];

			// Rotate each corner around center
			const rotatedCorners = corners.map((c) => ({
				x: c.dx * cos - c.dy * sin,
				y: c.dx * sin + c.dy * cos
			}));

			// Find bounding box offsets from center
			minX = Math.min(...rotatedCorners.map((c) => c.x));
			maxX = Math.max(...rotatedCorners.map((c) => c.x));
			minY = Math.min(...rotatedCorners.map((c) => c.y));
			maxY = Math.max(...rotatedCorners.map((c) => c.y));
		} else {
			// No rotation (leg or 0° rectangle)
			// For legs: still top-left based, for rectangles: center-based
			const isRectangle = 'rotation' in box;
			if (isRectangle) {
				// Rectangle at 0° rotation - offsets from center
				minX = -box.width / 2;
				maxX = box.width / 2;
				minY = -box.height / 2;
				maxY = box.height / 2;
			} else {
				// Leg - top-left based (no change needed for legs)
				minX = 0;
				maxX = box.width;
				minY = 0;
				maxY = box.height;
			}
		}

		// Apply boundary limits (center + offset must stay within bounds)
		if (target.x() + minX < 0) target.x(-minX);
		if (target.y() + minY < 0) target.y(-minY);
		if (target.x() + maxX > $projectStore.panelSettings.width) {
			target.x($projectStore.panelSettings.width - maxX);
		}
		if (target.y() + maxY > $projectStore.panelSettings.height) {
			target.y($projectStore.panelSettings.height - maxY);
		}
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
	let hoverInfo: HoverInfo | undefined = $state();

	const handleMouseEnter = (
		event: KonvaMouseEvent,
		element: CircleData | RectangleData | LegData
	) => {
		selectElementByMouseEnter(event, element, mode === 'measure');

		if (mode === 'pointer') {
			const elementInfo = getSelectedElementInfo();
			if (elementInfo) {
				const instructions = [
					'Mouse: free move',
					'Arrow keys: finemove (0.1mm)',
					'SHIFT+arrows: move (0.5mm)'
				];
				if ('width' in element && 'height' in element && 'depth' in element) {
					instructions.push('F: flip dimensions', 'R: rotate +5°', 'SHIFT+R: reset rotation');
				}
				instructions.push('Right click: context menu');

				// Calculate position to the right of the element
				const stage = event.target.getStage();
				if (stage) {
					const elementBounds = event.target.getClientRect();
					const stageContainer = stage.container().getBoundingClientRect();

					// Position to the right of the element with some padding
					const infoX = stageContainer.left + elementBounds.x + elementBounds.width + 20;
					const infoY = stageContainer.top + elementBounds.y;

					hoverInfo?.show(infoX, infoY, elementInfo, instructions.join('\n'));
				}
			}
		}
	};

	const handleMouseLeave = (
		event: KonvaMouseEvent,
		element: CircleData | RectangleData | LegData
	) => {
		deselectElementByMouseLeave(event, element, mode === 'measure');
		hoverInfo?.hide();
	};

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

	const getStageScaleX = $derived(
		imageSize
			? (imageSize.width / $projectStore.panelSettings.width) * ($projectStore.zoom / 100)
			: 1
	);
	const getStageScaleY = $derived(
		imageSize
			? (imageSize.height / $projectStore.panelSettings.height) * ($projectStore.zoom / 100)
			: 1
	);

	onDestroy(() => {
		cleanupMeasurement();
	});
</script>

{#if imageSize}
	<div class="flex justify-center mb-2">
		<ZoomRange class="w-2/5" max={300} min={10} step={10} bind:value={$projectStore.zoom} />
	</div>
	<div class="flex justify-center">
		<Stage
			height={imageSize.height * ($projectStore.zoom / 100)}
			onclick={stageClick}
			onmousedown={(event) => {
				if (mode === 'measure')
					stageMeasureModeMouseDown(event, measurementInfo, getStageScaleX, getStageScaleY);
			}}
			onmousemove={(event) =>
				stageMouseMove(event, mode === 'measure', measurementInfo, getStageScaleX, getStageScaleY)}
			onmouseup={(event) => {
				if (mode === 'measure') stageMeasureModeMouseUp(event, measurementInfo);
			}}
			scaleX={getStageScaleX}
			scaleY={getStageScaleY}
			width={imageSize.width * ($projectStore.zoom / 100)}
		>
			<Layer>
				<Image
					image={pcbImage}
					offsetY={imageSize.height}
					opacity={0.25}
					scaleX={$projectStore.panelSettings.width / imageSize.width}
					scaleY={(-1 * $projectStore.panelSettings.height) / imageSize.height}
				/>
				{#each $projectStore.circles as circle}
					<Circle
						id={circle.id}
						draggable={mode === 'pointer'}
						fill="orange"
						ondblclick={() => {
							if (mode === 'pointer') modifyCircle(circle);
						}}
						ondragend={() => updateCircleChanges()}
						ondragmove={(event) => limitCircle(event, circle)}
						onmouseenter={(event) => handleMouseEnter(event, circle)}
						onmouseleave={(event) => handleMouseLeave(event, circle)}
						opacity={0.75}
						radius={circle.radius}
						bind:x={circle.x}
						bind:y={circle.y}
					/>
				{/each}
				{#each $projectStore.rectangles as rectangle}
					<Rect
						id={rectangle.id}
						draggable={mode === 'pointer'}
						fill="green"
						height={rectangle.height}
						offsetX={rectangle.width / 2}
						offsetY={rectangle.height / 2}
						ondblclick={() => {
							if (mode === 'pointer') modifyRectangle(rectangle);
						}}
						ondragend={() => updateRectangleChanges()}
						ondragmove={(event) => limitBox(event, rectangle)}
						onmouseenter={(event) => handleMouseEnter(event, rectangle)}
						onmouseleave={(event) => handleMouseLeave(event, rectangle)}
						opacity={0.75}
						rotation={rectangle.rotation}
						width={rectangle.width}
						bind:x={rectangle.x}
						bind:y={rectangle.y}
					/>
				{/each}
				{#each $projectStore.legs as leg}
					<Rect
						id={leg.id}
						draggable={mode === 'pointer'}
						fill="gray"
						height={leg.height}
						ondblclick={() => {
							if (mode === 'pointer') deleteLegWithConfirm(leg);
						}}
						ondragend={() => updateLegChanges()}
						ondragmove={(event) => limitBox(event, leg)}
						onmouseenter={(event) => handleMouseEnter(event, leg)}
						onmouseleave={(event) => handleMouseLeave(event, leg)}
						opacity={0.75}
						width={leg.width}
						bind:x={leg.x}
						bind:y={leg.y}
					/>
				{/each}
				{#if mode === 'measure'}
					<DesignerGrid
						height={$projectStore.panelSettings.height}
						width={$projectStore.panelSettings.width}
					/>
				{/if}
				{#if $measurementInfo.visible}
					<DesignerCrosshair x={$measurementInfo.startPoint.x} y={$measurementInfo.startPoint.y} />
					<Line
						dash={[0.5, 0.5]}
						dashEnabled
						listening={false}
						opacity={0.75}
						points={[
							$measurementInfo.startPoint.x,
							$measurementInfo.startPoint.y,
							$measurementInfo.endPoint.x,
							$measurementInfo.endPoint.y
						]}
						stroke="#000"
						strokeWidth={0.25}
					/>
					<Text
						align="center"
						fontSize={3}
						listening={false}
						opacity={0.75}
						text={$measurementInfo.text}
						verticalAlign="center"
						x={($measurementInfo.textPoint.x < $projectStore.panelSettings.width / 2 ? 5 : -5) +
							$measurementInfo.textPoint.x}
						y={($measurementInfo.textPoint.y < $projectStore.panelSettings.height / 2 ? 5 : -5) +
							$measurementInfo.textPoint.y}
					/>
				{/if}
			</Layer>
		</Stage>
		<ContextMenu bind:this={contextMenu} />
		<HoverInfo bind:this={hoverInfo} />
	</div>
{/if}
