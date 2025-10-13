<!--
	2D PCB Component Placement Designer - Konva.js Canvas Interface

	This is the core interactive component where users place and manipulate THT components
	on a PCB image. It provides a Konva.js-based 2D canvas with two operational modes:

	**Modes:**
	1. **Pointer Mode** (default):
	   - Drag components to position them
	   - Double-click to edit properties
	   - Right-click for context menu
	   - Arrow keys for fine movement (0.1mm, 0.5mm with shift)
	   - Rectangle rotation (R key) and dimension flip (F key)
	   - Hover to see element info and shortcuts

	2. **Measure Mode**:
	   - Click two points to measure distance
	   - Shows grid overlay for reference
	   - Displays measurement line and distance (1/10th mm precision)
	   - All element dragging disabled

	**Coordinate Systems (Critical Implementation Detail):**

	Three coordinate spaces exist simultaneously:

	1. **Screen/Canvas Space** (pixels):
	   - Konva Stage dimensions (imageSize.width * zoom)
	   - What the user sees on screen

	2. **Image Space** (pixels):
	   - Original PCB image dimensions (imageSize.width x imageSize.height)
	   - Unscaled, before zoom applied

	3. **PCB/World Space** (millimeters):
	   - Real-world PCB dimensions (panelSettings.width x panelSettings.height)
	   - All element positions stored in this space
	   - Used for 3D mesh generation and STL export

	**Coordinate Transformations:**
	```
	Scale Factors:
	- scaleX = (imageSize.width / panelSettings.width) * (zoom / 100)
	- scaleY = (imageSize.height / panelSettings.height) * (zoom / 100)

	Image → World Space:
	- worldX = imageX / (imageSize.width / panelSettings.width)
	- worldY = imageY / (imageSize.height / panelSettings.height)

	World → Image Space:
	- imageX = worldX * (imageSize.width / panelSettings.width)
	- imageY = worldY * (imageSize.height / panelSettings.height)
	```

	**Image Rendering:**
	- Image is flipped on Y-axis (scaleY negative) for correct PCB top-view
	- Opacity set to 0.25 for visibility of overlaid components
	- offsetY applied to account for Y-flip transformation

	**Boundary Limiting Algorithm:**

	Prevents elements from being dragged outside panel bounds. Two algorithms:

	1. **Circles** (simple):
	   - Center + radius must stay within [0, panelWidth] x [0, panelHeight]

	2. **Rectangles/Legs** (complex - AABB for rotation):
	   - For rotated rectangles: calculate Axis-Aligned Bounding Box (AABB)
	   - Rotate all 4 corners around center
	   - Find min/max X/Y offsets from center
	   - Ensure center + offsets stay within bounds
	   - See limitBox() function for implementation

	**Performance Optimizations:**
	- Elements bound directly to store for real-time reactivity
	- Drag updates batched (ondragend instead of ondragmove)
	- Context menu and hover info positioned absolutely outside canvas

	**Event Flow:**
	1. User interacts with canvas (mouse/keyboard)
	2. Konva events captured (onclick, ondragmove, etc.)
	3. Element data updated in projectStore
	4. Svelte reactivity triggers re-render
	5. Konva updates canvas display
-->
<script lang="ts" module>
	/** Designer interaction mode - pointer for manipulation, measure for distance tool */
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
	import { FINE_MOVEMENT_DELTA, FINE_MOVEMENT_SHIFT_MULTIPLIER } from '$lib/constants';
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
		emptyMeasurementInfo,
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
	import { isRectangle } from '$types/typeGuards';

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

	/**
	 * Boundary limiting for rectangular elements during drag operations
	 *
	 * Prevents rectangles and legs from being dragged outside panel bounds using
	 * Axis-Aligned Bounding Box (AABB) calculation for rotated rectangles.
	 *
	 * **Algorithm:**
	 * 1. Calculate element's bounding box offsets from its anchor point
	 * 2. For rotated rectangles:
	 *    - Transform all 4 corners using rotation matrix
	 *    - Find min/max X/Y to get AABB
	 * 3. For non-rotated elements:
	 *    - Rectangles: center-based offsets (±width/2, ±height/2)
	 *    - Legs: top-left based offsets (0 to width, 0 to height)
	 * 4. Clamp position so anchor + offsets stay within [0, panelWidth] x [0, panelHeight]
	 *
	 * **Coordinate Systems:**
	 * - Rectangles: position is CENTER, rotation around center
	 * - Legs: position is TOP-LEFT corner, no rotation
	 *
	 * **Rotation Matrix (2D):**
	 * ```
	 * x' = x * cos(θ) - y * sin(θ)
	 * y' = x * sin(θ) + y * cos(θ)
	 * ```
	 *
	 * @param event - Konva drag event with target element
	 * @param box - Rectangle or leg data with dimensions and optional rotation
	 */
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

			// Rotate each corner around center using 2D rotation matrix
			const rotatedCorners = corners.map((c) => ({
				x: c.dx * cos - c.dy * sin,
				y: c.dx * sin + c.dy * cos
			}));

			// Find axis-aligned bounding box (AABB) offsets from center
			minX = Math.min(...rotatedCorners.map((c) => c.x));
			maxX = Math.max(...rotatedCorners.map((c) => c.x));
			minY = Math.min(...rotatedCorners.map((c) => c.y));
			maxY = Math.max(...rotatedCorners.map((c) => c.y));
		} else {
			// No rotation (leg or 0° rectangle)
			const isRectangle = 'rotation' in box;
			if (isRectangle) {
				// Rectangle at 0° rotation - offsets from center
				minX = -box.width / 2;
				maxX = box.width / 2;
				minY = -box.height / 2;
				maxY = box.height / 2;
			} else {
				// Leg - top-left based (no offset adjustment needed)
				minX = 0;
				maxX = box.width;
				minY = 0;
				maxY = box.height;
			}
		}

		// Apply boundary limits: clamp position so (position + offset) stays within bounds
		if (target.x() + minX < 0) target.x(-minX);
		if (target.y() + minY < 0) target.y(-minY);
		if (target.x() + maxX > $projectStore.panelSettings.width)
			target.x($projectStore.panelSettings.width - maxX);
		if (target.y() + maxY > $projectStore.panelSettings.height)
			target.y($projectStore.panelSettings.height - maxY);
	};
	/**
	 * Boundary limiting for circular elements during drag operations
	 *
	 * Prevents circles from being dragged outside panel bounds using simple
	 * radius-based boundary checking (circles are always axis-aligned).
	 *
	 * **Algorithm:**
	 * - Circle center must stay within [radius, panelWidth-radius] x [radius, panelHeight-radius]
	 * - Ensures entire circle (center + radius) stays within panel bounds
	 *
	 * @param event - Konva drag event with target element
	 * @param circle - Circle data with position and radius
	 */
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

	/** Context menu instance for right-click element operations */
	let contextMenu: ContextMenu | undefined = $state();

	/** Hover info tooltip showing element details and keyboard shortcuts */
	let hoverInfo: HoverInfo | undefined = $state();

	/**
	 * Mouse enter event handler - shows hover info and enables fine movement
	 *
	 * Triggers when cursor enters an element. In pointer mode, displays:
	 * - Element information (type, dimensions, position)
	 * - Available keyboard shortcuts for manipulation
	 * - Positioned to the right of the element to avoid obstruction
	 *
	 * @param event - Konva mouse event with target element and stage
	 * @param element - Circle, rectangle, or leg data
	 */
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
					`Arrow keys: finemove (${FINE_MOVEMENT_DELTA}mm)`,
					`SHIFT+arrows: move (${FINE_MOVEMENT_DELTA * FINE_MOVEMENT_SHIFT_MULTIPLIER}mm)`
				];
				if (isRectangle(element)) {
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

	/**
	 * Mouse leave event handler - hides hover info and disables fine movement
	 *
	 * Triggers when cursor exits an element. Cleans up UI state:
	 * - Hides hover info tooltip
	 * - Deselects element for fine movement
	 *
	 * @param event - Konva mouse event with target element
	 * @param element - Circle, rectangle, or leg data
	 */
	const handleMouseLeave = (
		event: KonvaMouseEvent,
		element: CircleData | RectangleData | LegData
	) => {
		deselectElementByMouseLeave(event, element, mode === 'measure');
		hoverInfo?.hide();
	};

	/**
	 * Stage click event handler - displays context menu on right-click
	 *
	 * Handles right-click (button === 2) events on elements. Searches through
	 * element types (circles, rectangles, legs) to find matching ID and
	 * displays type-specific context menu with available operations.
	 *
	 * **Context Menu Operations:**
	 * - Circles: Edit properties, delete
	 * - Rectangles: Edit properties, rotate, flip, delete
	 * - Legs: Delete with confirmation
	 *
	 * @param event - Konva mouse event with button type and target element
	 */
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

	/** Measurement tool state - tracks start/end points and distance calculation */
	const measurementInfo: Writable<MeasurementInfo> = writable(emptyMeasurementInfo);

	/**
	 * X-axis scale factor: converts PCB/world space (mm) to canvas space (pixels)
	 * Formula: (imagePixels / panelMillimeters) * (zoom / 100)
	 */
	const getStageScaleX = $derived(
		imageSize
			? (imageSize.width / $projectStore.panelSettings.width) * ($projectStore.zoom / 100)
			: 1
	);

	/**
	 * Y-axis scale factor: converts PCB/world space (mm) to canvas space (pixels)
	 * Formula: (imagePixels / panelMillimeters) * (zoom / 100)
	 */
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
