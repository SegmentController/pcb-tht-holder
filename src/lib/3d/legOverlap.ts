import { MathMinMax } from '$lib/Math';
import type { CircleData } from '$types/CircleData';
import type { LegData } from '$types/LegData';
import type { RectangleData } from '$types/RectangleData';

/**
 * Checks if a leg overlaps with a circle component
 *
 * Uses closest-point-on-rectangle algorithm to detect intersection.
 * Leg is treated as an axis-aligned bounding box (top-left corner positioning).
 *
 * @param leg - Support leg with top-left corner coordinates
 * @param circle - Circle component with center coordinates
 * @returns true if the leg overlaps with the circle (tangent does not count)
 */
export const isLegOverlappingCircle = (leg: LegData, circle: CircleData): boolean => {
	// Find closest point on leg rectangle to circle center
	const closestX = MathMinMax(circle.x, leg.x, leg.x + leg.width);
	const closestY = MathMinMax(circle.y, leg.y, leg.y + leg.height);

	// Calculate distance from closest point to circle center
	const distanceX = circle.x - closestX;
	const distanceY = circle.y - closestY;
	const distanceSquared = distanceX * distanceX + distanceY * distanceY;

	// Check if distance is less than radius (using squared values to avoid sqrt)
	return distanceSquared < circle.radius * circle.radius;
};

/**
 * Checks if a leg overlaps with a rectangle component
 *
 * - Non-rotated: simple AABB overlap test
 * - Rotated: separating axis test over the leg's axes and the rectangle's rotated axes,
 *   which also catches edge-crossing overlaps where no corner lies inside the other shape
 *
 * Touching edges count as overlap in both cases.
 *
 * @param leg - Support leg with top-left corner coordinates
 * @param rectangle - Rectangle component with center coordinates and optional rotation
 * @returns true if the leg overlaps with the rectangle
 */
export const isLegOverlappingRectangle = (leg: LegData, rectangle: RectangleData): boolean => {
	const halfWidth = rectangle.width / 2;
	const halfHeight = rectangle.height / 2;

	if (!rectangle.rotation)
		return !(
			rectangle.x + halfWidth < leg.x ||
			rectangle.x - halfWidth > leg.x + leg.width ||
			rectangle.y + halfHeight < leg.y ||
			rectangle.y - halfHeight > leg.y + leg.height
		);

	const angle = (rectangle.rotation * Math.PI) / 180;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	// Leg is axis-aligned: center + half extents
	const legHalfWidth = leg.width / 2;
	const legHalfHeight = leg.height / 2;
	const deltaX = rectangle.x - (leg.x + legHalfWidth);
	const deltaY = rectangle.y - (leg.y + legHalfHeight);

	// Rotated rectangle's half extents projected onto world axes
	const extentX = Math.abs(cos) * halfWidth + Math.abs(sin) * halfHeight;
	const extentY = Math.abs(sin) * halfWidth + Math.abs(cos) * halfHeight;
	if (Math.abs(deltaX) > legHalfWidth + extentX) return false;
	if (Math.abs(deltaY) > legHalfHeight + extentY) return false;

	// Leg's half extents projected onto the rectangle's local axes
	const legExtentU = Math.abs(cos) * legHalfWidth + Math.abs(sin) * legHalfHeight;
	const legExtentV = Math.abs(sin) * legHalfWidth + Math.abs(cos) * legHalfHeight;
	const distanceU = Math.abs(deltaX * cos + deltaY * sin);
	const distanceV = Math.abs(-deltaX * sin + deltaY * cos);
	return distanceU <= halfWidth + legExtentU && distanceV <= halfHeight + legExtentV;
};
