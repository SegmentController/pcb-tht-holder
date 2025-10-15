/**
 * Alignment guide utilities for PCB designer
 *
 * Provides visual feedback when dragging elements by detecting and displaying
 * alignment with other elements on the canvas. Shows thin lines when edges or
 * centers align within a threshold distance.
 *
 * @remarks
 * **Alignment Detection Algorithm:**
 *
 * For each dragged element:
 * 1. Extract key alignment points (center, edges) based on element type
 * 2. Compare against all other elements' alignment points
 * 3. When distance < threshold, create alignment line
 * 4. Return vertical and horizontal lines separately
 *
 * **Coordinate Systems:**
 * - All calculations in PCB/world space (millimeters)
 * - Handles different element coordinate systems:
 *   - Circles: center-based (x, y = center)
 *   - Rectangles: center-based with rotation (requires AABB calculation)
 *   - Legs: top-left corner-based, no rotation
 *
 * **Performance:**
 * - Only calculates during drag operations
 * - Clears immediately on drag end
 * - Minimal overhead with O(n²) element comparison (acceptable for typical PCB counts)
 */

import { ALIGNMENT_SNAP_THRESHOLD } from '$lib/constants';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { RectangleData } from '$types/RectangleData';
import { type GenericElement, isCircle, isLeg, isRectangle } from '$types/typeGuards';

/**
 * Categorized alignment points for an element
 * Separates vertical edges, horizontal edges, and center for proper alignment comparison
 */
type AlignmentPoints = {
	/** Center point (x, y) */
	center: { x: number; y: number };
	/** Vertical edge X coordinates (left and right edges) */
	verticalEdges: number[];
	/** Horizontal edge Y coordinates (top and bottom edges) */
	horizontalEdges: number[];
};

/**
 * Alignment line to be drawn on canvas
 * Represents a visual guide showing alignment between elements
 */
export type AlignmentLine = {
	/** Start X coordinate in millimeters */
	x1: number;
	/** Start Y coordinate in millimeters */
	y1: number;
	/** End X coordinate in millimeters */
	x2: number;
	/** End Y coordinate in millimeters */
	y2: number;
};

/**
 * Extracts categorized alignment points from a circle element
 *
 * Returns center point, vertical edges (left, right), and horizontal edges (top, bottom).
 * Circle coordinate system: (x, y) is the center position.
 *
 * @param circle - Circle element data
 * @returns Categorized alignment points
 */
const getCircleAlignmentPoints = (circle: CircleData): AlignmentPoints => {
	return {
		center: { x: circle.x, y: circle.y },
		verticalEdges: [circle.x - circle.radius, circle.x + circle.radius], // Left, Right
		horizontalEdges: [circle.y - circle.radius, circle.y + circle.radius] // Top, Bottom
	};
};

/**
 * Extracts categorized alignment points from a rectangle element
 *
 * Returns center point, vertical edges (left, right), and horizontal edges (top, bottom).
 * For rotated rectangles, uses AABB (Axis-Aligned Bounding Box) calculation.
 * Rectangle coordinate system: (x, y) is the center position, rotation is applied around center.
 *
 * **Algorithm:**
 * 1. Calculate all 4 corners relative to center
 * 2. Apply 2D rotation matrix to each corner
 * 3. Find min/max X/Y (AABB bounds)
 * 4. Return center and edge coordinates
 *
 * @param rectangle - Rectangle element data with optional rotation
 * @returns Categorized alignment points
 */
const getRectangleAlignmentPoints = (rectangle: RectangleData): AlignmentPoints => {
	if (rectangle.rotation === 0) {
		// No rotation - simple edge calculation
		return {
			center: { x: rectangle.x, y: rectangle.y },
			verticalEdges: [
				rectangle.x - rectangle.width / 2, // Left
				rectangle.x + rectangle.width / 2 // Right
			],
			horizontalEdges: [
				rectangle.y - rectangle.height / 2, // Top
				rectangle.y + rectangle.height / 2 // Bottom
			]
		};
	}

	// Calculate AABB for rotated rectangle
	const angleRad = (rectangle.rotation * Math.PI) / 180;
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);

	const halfWidth = rectangle.width / 2;
	const halfHeight = rectangle.height / 2;
	const corners = [
		{ dx: -halfWidth, dy: -halfHeight }, // top-left
		{ dx: halfWidth, dy: -halfHeight }, // top-right
		{ dx: halfWidth, dy: halfHeight }, // bottom-right
		{ dx: -halfWidth, dy: halfHeight } // bottom-left
	];

	// Rotate corners around center
	const rotatedCorners = corners.map((c) => ({
		x: rectangle.x + c.dx * cos - c.dy * sin,
		y: rectangle.y + c.dx * sin + c.dy * cos
	}));

	// Find AABB bounds
	const minX = Math.min(...rotatedCorners.map((c) => c.x));
	const maxX = Math.max(...rotatedCorners.map((c) => c.x));
	const minY = Math.min(...rotatedCorners.map((c) => c.y));
	const maxY = Math.max(...rotatedCorners.map((c) => c.y));

	return {
		center: { x: rectangle.x, y: rectangle.y },
		verticalEdges: [minX, maxX], // Left, Right
		horizontalEdges: [minY, maxY] // Top, Bottom
	};
};

/**
 * Extracts categorized alignment points from a leg element
 *
 * Returns center point, vertical edges (left, right), and horizontal edges (top, bottom).
 * Leg coordinate system: (x, y) is the top-left corner position (unlike circles/rectangles).
 * Legs do not support rotation.
 *
 * @param leg - Leg element data
 * @returns Categorized alignment points
 */
const getLegAlignmentPoints = (leg: LegData): AlignmentPoints => {
	const centerX = leg.x + leg.width / 2;
	const centerY = leg.y + leg.height / 2;

	return {
		center: { x: centerX, y: centerY },
		verticalEdges: [leg.x, leg.x + leg.width], // Left, Right
		horizontalEdges: [leg.y, leg.y + leg.height] // Top, Bottom
	};
};

/**
 * Extracts categorized alignment points from any element type
 *
 * Uses type guards to determine element type and calls appropriate extraction function.
 *
 * @param element - Generic element (circle, rectangle, or leg)
 * @returns Categorized alignment points
 */
const getAlignmentPoints = (element: GenericElement): AlignmentPoints => {
	if (isCircle(element)) return getCircleAlignmentPoints(element);
	if (isRectangle(element)) return getRectangleAlignmentPoints(element);
	if (isLeg(element)) return getLegAlignmentPoints(element);
	// Fallback (should never reach with proper type guards)
	return { center: { x: 0, y: 0 }, verticalEdges: [], horizontalEdges: [] };
};

/**
 * Gets bounding box for an element to determine line extents
 *
 * Returns the min/max coordinates that fully contain the element.
 * Used to draw alignment lines that span the full element height/width.
 *
 * @param element - Generic element
 * @returns Bounding box {minX, maxX, minY, maxY}
 */
const getElementBounds = (
	element: GenericElement
): { minX: number; maxX: number; minY: number; maxY: number } => {
	if (isCircle(element)) {
		return {
			minX: element.x - element.radius,
			maxX: element.x + element.radius,
			minY: element.y - element.radius,
			maxY: element.y + element.radius
		};
	}

	if (isRectangle(element)) {
		if (element.rotation !== 0) {
			// Calculate AABB for rotated rectangle
			const angleRad = (element.rotation * Math.PI) / 180;
			const cos = Math.cos(angleRad);
			const sin = Math.sin(angleRad);

			const halfWidth = element.width / 2;
			const halfHeight = element.height / 2;
			const corners = [
				{ dx: -halfWidth, dy: -halfHeight },
				{ dx: halfWidth, dy: -halfHeight },
				{ dx: halfWidth, dy: halfHeight },
				{ dx: -halfWidth, dy: halfHeight }
			];

			const rotatedCorners = corners.map((c) => ({
				x: element.x + c.dx * cos - c.dy * sin,
				y: element.y + c.dx * sin + c.dy * cos
			}));

			return {
				minX: Math.min(...rotatedCorners.map((c) => c.x)),
				maxX: Math.max(...rotatedCorners.map((c) => c.x)),
				minY: Math.min(...rotatedCorners.map((c) => c.y)),
				maxY: Math.max(...rotatedCorners.map((c) => c.y))
			};
		}
		return {
			minX: element.x - element.width / 2,
			maxX: element.x + element.width / 2,
			minY: element.y - element.height / 2,
			maxY: element.y + element.height / 2
		};
	}

	if (isLeg(element)) {
		return {
			minX: element.x,
			maxX: element.x + element.width,
			minY: element.y,
			maxY: element.y + element.height
		};
	}

	// Fallback (should never reach here with proper type guards)
	return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
};

/**
 * Detects alignment between dragged element and other elements
 *
 * Compares same-oriented sides of the dragged element against other elements:
 * - Vertical edges (left/right) align with other vertical edges (left/right)
 * - Horizontal edges (top/bottom) align with other horizontal edges (top/bottom)
 * - Centers align with other centers
 *
 * Returns alignment lines for alignments within the threshold distance.
 *
 * **Algorithm:**
 * 1. Get categorized alignment points for dragged element
 * 2. For each other element:
 *    - Get its categorized alignment points
 *    - Compare vertical edges with vertical edges → create vertical line
 *    - Compare horizontal edges with horizontal edges → create horizontal line
 *    - Compare centers with centers → create both vertical and horizontal lines
 * 3. Deduplicate lines at the same position
 *
 * @param draggedElement - The element currently being dragged
 * @param otherElements - All other elements to check alignment against
 * @param panelWidth - Panel width for line extent
 * @param panelHeight - Panel height for line extent
 * @returns Array of alignment lines to draw
 */
export const detectAlignments = (
	draggedElement: GenericElement,
	otherElements: GenericElement[],
	panelWidth: number,
	panelHeight: number
): AlignmentLine[] => {
	const lines: AlignmentLine[] = [];
	const draggedPoints = getAlignmentPoints(draggedElement);
	const draggedBounds = getElementBounds(draggedElement);

	// Track added alignments to avoid duplicates
	const addedVertical = new Set<number>();
	const addedHorizontal = new Set<number>();

	for (const other of otherElements) {
		// Skip if it's the same element (by ID)
		if (other.id === draggedElement.id) continue;

		const otherPoints = getAlignmentPoints(other);
		const otherBounds = getElementBounds(other);

		// Check vertical edge alignments (left/right with left/right)
		for (const draggedX of draggedPoints.verticalEdges) {
			for (const otherX of otherPoints.verticalEdges) {
				const deltaX = Math.abs(draggedX - otherX);
				if (deltaX < ALIGNMENT_SNAP_THRESHOLD) {
					const alignX = (draggedX + otherX) / 2;
					const roundedX = Math.round(alignX * 1000) / 1000;

					if (!addedVertical.has(roundedX)) {
						addedVertical.add(roundedX);

						// Vertical line spans from top to bottom of both elements
						const minY = Math.min(draggedBounds.minY, otherBounds.minY);
						const maxY = Math.max(draggedBounds.maxY, otherBounds.maxY);

						lines.push({
							x1: alignX,
							y1: Math.max(0, minY),
							x2: alignX,
							y2: Math.min(panelHeight, maxY)
						});
					}
				}
			}
		}

		// Check horizontal edge alignments (top/bottom with top/bottom)
		for (const draggedY of draggedPoints.horizontalEdges) {
			for (const otherY of otherPoints.horizontalEdges) {
				const deltaY = Math.abs(draggedY - otherY);
				if (deltaY < ALIGNMENT_SNAP_THRESHOLD) {
					const alignY = (draggedY + otherY) / 2;
					const roundedY = Math.round(alignY * 1000) / 1000;

					if (!addedHorizontal.has(roundedY)) {
						addedHorizontal.add(roundedY);

						// Horizontal line spans from left to right of both elements
						const minX = Math.min(draggedBounds.minX, otherBounds.minX);
						const maxX = Math.max(draggedBounds.maxX, otherBounds.maxX);

						lines.push({
							x1: Math.max(0, minX),
							y1: alignY,
							x2: Math.min(panelWidth, maxX),
							y2: alignY
						});
					}
				}
			}
		}

		// Check center-to-center alignments (both vertical and horizontal)
		const deltaX = Math.abs(draggedPoints.center.x - otherPoints.center.x);
		if (deltaX < ALIGNMENT_SNAP_THRESHOLD) {
			const alignX = (draggedPoints.center.x + otherPoints.center.x) / 2;
			const roundedX = Math.round(alignX * 1000) / 1000;

			if (!addedVertical.has(roundedX)) {
				addedVertical.add(roundedX);

				const minY = Math.min(draggedBounds.minY, otherBounds.minY);
				const maxY = Math.max(draggedBounds.maxY, otherBounds.maxY);

				lines.push({
					x1: alignX,
					y1: Math.max(0, minY),
					x2: alignX,
					y2: Math.min(panelHeight, maxY)
				});
			}
		}

		const deltaY = Math.abs(draggedPoints.center.y - otherPoints.center.y);
		if (deltaY < ALIGNMENT_SNAP_THRESHOLD) {
			const alignY = (draggedPoints.center.y + otherPoints.center.y) / 2;
			const roundedY = Math.round(alignY * 1000) / 1000;

			if (!addedHorizontal.has(roundedY)) {
				addedHorizontal.add(roundedY);

				const minX = Math.min(draggedBounds.minX, otherBounds.minX);
				const maxX = Math.max(draggedBounds.maxX, otherBounds.maxX);

				lines.push({
					x1: Math.max(0, minX),
					y1: alignY,
					x2: Math.min(panelWidth, maxX),
					y2: alignY
				});
			}
		}
	}

	return lines;
};
