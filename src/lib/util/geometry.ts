/**
 * Half extents of the axis-aligned bounding box of a rectangle rotated around its center.
 *
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param rotationDegrees - Rotation around the center in degrees (either direction)
 */
export const rotatedHalfExtents = (width: number, height: number, rotationDegrees: number) => {
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	if (rotationDegrees === 0) return { x: halfWidth, y: halfHeight };

	const radians = (rotationDegrees * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	return { x: cos * halfWidth + sin * halfHeight, y: sin * halfWidth + cos * halfHeight };
};
