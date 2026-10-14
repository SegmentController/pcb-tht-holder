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
	- Photos are drawn at 25 % opacity, generated board pictures (SVG from a Gerber import) opaque
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
	import DesignerCrosshair from '$components/designer/DesignerCrosshair.svelte';
	import DesignerGrid from '$components/designer/DesignerGrid.svelte';
	import {
		ALIGNMENT_LINE_COLOR,
		ALIGNMENT_LINE_WIDTH,
		FINE_MOVEMENT_DELTA,
		FINE_MOVEMENT_SHIFT_MULTIPLIER,
		ZOOM_MAX,
		ZOOM_MIN,
		ZOOM_STEP
	} from '$lib/constants';
	import {
		type AlignmentLine,
		calculateSnapPosition,
		detectAlignments
	} from '$lib/designer/alignment';
	import {
		getContextMenuItemForCircle,
		modifyCircle,
		moveCircle
	} from '$lib/designer/elements/circle';
	import {
		deleteLegWithConfirm,
		getContextMenuItemForLeg,
		moveLeg
	} from '$lib/designer/elements/leg';
	import {
		getContextMenuItemForRectangle,
		modifyRectangle,
		moveRectangle
	} from '$lib/designer/elements/rectangle';
	import {
		deselectElementByMouseLeave,
		getSelectedElementInfo,
		pruneSelectedElements,
		selectElementByMouseEnter
	} from '$lib/designer/fineMovement';
	import {
		cleanupMeasurement,
		emptyMeasurementInfo,
		type MeasurementInfo,
		stageMeasureModeMouseDown,
		stageMeasureModeMouseUp,
		stageMouseMove
	} from '$lib/designer/measurement';
	import { wheelZoom } from '$lib/designer/zoom';
	import { isGeneratedImage } from '$lib/gerber/boardSvg';
	import { rotatedHalfExtents } from '$lib/util/geometry';
	import { projectStore } from '$stores/projectStore';
	import type { CircleData } from '$types/CircleData';
	import type { ImageSize } from '$types/ImageSize';
	import { type LegData } from '$types/LegData';
	import type { RectangleData } from '$types/RectangleData';
	import { type GenericElement, isRectangle } from '$types/typeGuards';

	import { alignmentEnabled } from './AppNavigation.svelte';

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

		// Offsets of the (rotated) shape's bounding box relative to the anchor position
		let minX = 0;
		let maxX = box.width;
		let minY = 0;
		let maxY = box.height;
		if ('rotation' in box) {
			// Rectangle: anchor is the center, rotation is applied around it
			const half = rotatedHalfExtents(box.width, box.height, box.rotation);
			minX = -half.x;
			maxX = half.x;
			minY = -half.y;
			maxY = half.y;
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

	/**
	 * Commits a finished drag with a single store write and one undo entry.
	 * Position is read from the Konva node and assigned on the raw element (not through the
	 * store-bound each item), so persistence happens once instead of once per axis plus once more.
	 */
	const commitDragEnd = (event: KonvaDragTransformEvent, move: (x: number, y: number) => void) => {
		move(event.target.x(), event.target.y());
		clearAlignmentLines();
	};

	/** Context menu instance for right-click element operations */
	let contextMenu: ContextMenu | undefined = $state();

	/** Hover info tooltip showing element details and keyboard shortcuts */
	let hoverInfo: HoverInfo | undefined = $state();

	/** Alignment lines to display during element dragging (replaced as a whole, never mutated) */
	let alignmentLines: AlignmentLine[] = $state.raw([]);

	/** Other elements of the drag in progress: built once per drag, not on every move event */
	let otherElementsCache: { id: string; elements: GenericElement[] } | undefined;
	const getOtherElements = (draggedId: string) => {
		if (otherElementsCache?.id !== draggedId)
			otherElementsCache = {
				id: draggedId,
				elements: [
					...$projectStore.circles.filter((c) => c.id !== draggedId),
					...$projectStore.rectangles.filter((r) => r.id !== draggedId),
					...$projectStore.legs.filter((l) => l.id !== draggedId)
				]
			};
		return otherElementsCache.elements;
	};

	/**
	 * Applies magnetic snapping to a dragged element
	 *
	 * Adjusts element position to snap to nearby alignment points when within snap distance.
	 * Uses the live position from the drag event to provide real-time snapping feedback.
	 *
	 * Only applies snapping if the alignment toggle is enabled.
	 *
	 * @param event - Konva drag event with current position
	 * @param draggedElement - The element being dragged (for ID and properties)
	 */
	const applySnapping = (
		event: KonvaDragTransformEvent,
		draggedElement: CircleData | RectangleData | LegData
	) => {
		// Skip snapping if toggle is disabled
		if (!$alignmentEnabled) return;

		// Create a copy of the element with the current drag position
		const liveElement = {
			...draggedElement,
			x: event.target.x(),
			y: event.target.y()
		};

		const allOtherElements = getOtherElements(draggedElement.id);

		// Calculate snapped position
		const snappedPosition = calculateSnapPosition(liveElement, allOtherElements);

		// Apply snapped position to the drag target
		event.target.x(snappedPosition.x);
		event.target.y(snappedPosition.y);
	};

	/**
	 * Detects and updates alignment lines for the currently dragged element
	 *
	 * Called during ondragmove events to show visual alignment guides.
	 * Uses the live position from the drag event (not the stored position)
	 * to provide real-time alignment feedback.
	 *
	 * Only shows alignment lines if the alignment toggle is enabled.
	 *
	 * @param event - Konva drag event with current position
	 * @param draggedElement - The element being dragged (for ID and properties)
	 */
	const updateAlignmentLines = (
		event: KonvaDragTransformEvent,
		draggedElement: CircleData | RectangleData | LegData
	) => {
		// Skip alignment detection if toggle is disabled
		if (!$alignmentEnabled) {
			alignmentLines = [];
			return;
		}

		// Create a copy of the element with the current drag position
		const liveElement = {
			...draggedElement,
			x: event.target.x(),
			y: event.target.y()
		};

		const allOtherElements = getOtherElements(draggedElement.id);

		alignmentLines = detectAlignments(
			liveElement,
			allOtherElements,
			$projectStore.panelSettings.width,
			$projectStore.panelSettings.height
		);
	};

	/**
	 * Clears all alignment lines
	 *
	 * Called on dragend events to remove visual guides after dragging completes.
	 */
	const clearAlignmentLines = () => {
		alignmentLines = [];
		otherElementsCache = undefined;
		hoverAnchor = undefined; // the dragged element moved
	};

	// Deleted elements get no mouseleave: forget them so arrow keys cannot move a stale element
	$effect(() => {
		pruneSelectedElements([
			...$projectStore.circles,
			...$projectStore.rectangles,
			...$projectStore.legs
		]);
	});

	/**
	 * Shows hover info for an element with delayed display
	 *
	 * Calculates position and content for hover info tooltip.
	 * Called by both mouseenter and mousemove handlers.
	 *
	 * @param event - Konva mouse event with target element and stage
	 * @param element - Circle, rectangle, or leg data
	 */
	/** Tooltip anchor of the hovered element, measured once on enter (mousemove only restarts the timer) */
	let hoverAnchor: { element: GenericElement; x: number; y: number } | undefined;

	const showHoverInfoForElement = (
		event: KonvaMouseEvent,
		element: CircleData | RectangleData | LegData,
		remeasure = true
	) => {
		if (mode !== 'pointer') return;

		const elementInfo = getSelectedElementInfo();
		if (!elementInfo) return;

		const instructions = [
			'Mouse: free move',
			`Arrow keys: finemove (${FINE_MOVEMENT_DELTA}mm)`,
			`SHIFT+arrows: move (${FINE_MOVEMENT_DELTA * FINE_MOVEMENT_SHIFT_MULTIPLIER}mm)`
		];
		if (isRectangle(element))
			instructions.push('F: flip dimensions', 'R: rotate +5°', 'SHIFT+R: reset rotation');

		instructions.push('Right click: context menu');

		// Calculate position to the right of the element
		if (remeasure || hoverAnchor?.element !== element) {
			hoverAnchor = undefined;

			const stage = event.target.getStage();
			if (stage) {
				const elementBounds = event.target.getClientRect();
				const stageContainer = stage.container().getBoundingClientRect();

				// Position to the right of the element with some padding
				hoverAnchor = {
					element,
					x: stageContainer.left + elementBounds.x + elementBounds.width + 20,
					y: stageContainer.top + elementBounds.y
				};
			}
		}

		if (hoverAnchor)
			hoverInfo?.show(hoverAnchor.x, hoverAnchor.y, elementInfo, instructions.join('\n'));
	};

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
		showHoverInfoForElement(event, element);
	};

	/**
	 * Mouse move event handler - restarts hover info timer after movement
	 *
	 * When mouse moves while hovering over an element, hides the info
	 * and restarts the 1-second timer to show it again if mouse stops moving.
	 *
	 * @param event - Konva mouse event with target element and stage
	 * @param element - Circle, rectangle, or leg data
	 */
	const handleMouseMove = (
		event: KonvaMouseEvent,
		element: CircleData | RectangleData | LegData
	) => {
		showHoverInfoForElement(event, element, false);
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
		hoverAnchor = undefined;
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
		<ZoomRange
			class="w-2/5"
			max={ZOOM_MAX}
			min={ZOOM_MIN}
			step={ZOOM_STEP}
			bind:value={$projectStore.zoom}
		/>
		{#if isGeneratedImage($projectStore.image)}
			<span
				class="ms-4 self-center whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
				title="Picture and holes come from Gerber files: exact millimetres, no photo scale"
				>Gerber layout · exact size</span
			>
		{:else}
			<span
				class="ms-4 self-center whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
				title="Photo overlay at 25 % opacity, stretched to the panel size of the project settings"
				>Photo overlay · scale from settings</span
			>
		{/if}
	</div>
	<!-- justify-center-safe: centered while it fits, scrollable from the left edge once wider than the viewport -->
	<div
		class="flex justify-center-safe overflow-x-auto"
		aria-label="PCB designer canvas"
		role="region"
		use:wheelZoom={{
			getZoom: () => $projectStore.zoom,
			setZoom: (zoom) => ($projectStore.zoom = zoom)
		}}
	>
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
			<!-- Background: static image, not interactive, only redrawn when zoom/size changes -->
			<Layer listening={false}>
				<Image
					image={pcbImage}
					listening={false}
					offsetY={imageSize.height}
					opacity={isGeneratedImage($projectStore.image) ? 1 : 0.25}
					scaleX={$projectStore.panelSettings.width / imageSize.width}
					scaleY={(-1 * $projectStore.panelSettings.height) / imageSize.height}
				/>
			</Layer>
			<!-- Elements: redrawn while dragging, without repainting the image -->
			<Layer>
				{#each $projectStore.circles as circle (circle.id)}
					<Circle
						id={circle.id}
						draggable={mode === 'pointer'}
						fill="orange"
						ondblclick={() => {
							if (mode === 'pointer') modifyCircle(circle);
						}}
						ondragend={(event) => commitDragEnd(event, (x, y) => moveCircle(circle, x, y))}
						ondragmove={(event) => {
							limitCircle(event, circle);
							applySnapping(event, circle);
							updateAlignmentLines(event, circle);
						}}
						ondragstart={() => {
							hoverInfo?.hide();
						}}
						onmouseenter={(event) => handleMouseEnter(event, circle)}
						onmouseleave={(event) => handleMouseLeave(event, circle)}
						onmousemove={(event) => handleMouseMove(event, circle)}
						opacity={0.75}
						radius={circle.radius}
						staticConfig
						x={circle.x}
						y={circle.y}
					/>
				{/each}
				{#each $projectStore.rectangles as rectangle (rectangle.id)}
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
						ondragend={(event) => commitDragEnd(event, (x, y) => moveRectangle(rectangle, x, y))}
						ondragmove={(event) => {
							limitBox(event, rectangle);
							applySnapping(event, rectangle);
							updateAlignmentLines(event, rectangle);
						}}
						ondragstart={() => {
							hoverInfo?.hide();
						}}
						onmouseenter={(event) => handleMouseEnter(event, rectangle)}
						onmouseleave={(event) => handleMouseLeave(event, rectangle)}
						onmousemove={(event) => handleMouseMove(event, rectangle)}
						opacity={0.75}
						rotation={rectangle.rotation}
						staticConfig
						width={rectangle.width}
						x={rectangle.x}
						y={rectangle.y}
					/>
				{/each}
				{#each $projectStore.legs as leg (leg.id)}
					<Rect
						id={leg.id}
						draggable={mode === 'pointer'}
						fill="gray"
						height={leg.height}
						ondblclick={() => {
							if (mode === 'pointer') deleteLegWithConfirm(leg);
						}}
						ondragend={(event) => commitDragEnd(event, (x, y) => moveLeg(leg, x, y))}
						ondragmove={(event) => {
							limitBox(event, leg);
							applySnapping(event, leg);
							updateAlignmentLines(event, leg);
						}}
						ondragstart={() => {
							hoverInfo?.hide();
						}}
						onmouseenter={(event) => handleMouseEnter(event, leg)}
						onmouseleave={(event) => handleMouseLeave(event, leg)}
						onmousemove={(event) => handleMouseMove(event, leg)}
						opacity={0.75}
						staticConfig
						width={leg.width}
						x={leg.x}
						y={leg.y}
					/>
				{/each}
			</Layer>
			<!-- Overlays: alignment guides, grid and measurement, never hit-tested -->
			<Layer listening={false}>
				{#if mode === 'pointer'}
					{#each alignmentLines as line}
						<Line
							listening={false}
							opacity={0.9}
							points={[line.x1, line.y1, line.x2, line.y2]}
							stroke={ALIGNMENT_LINE_COLOR}
							strokeWidth={ALIGNMENT_LINE_WIDTH}
						/>
					{/each}
				{/if}
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
