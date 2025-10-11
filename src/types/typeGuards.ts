/**
 * Type guard functions for element discrimination
 */

import type { CircleData } from './CircleData';
import type { LegData } from './LegData';
import type { RectangleData } from './RectangleData';

export type GenericElement = CircleData | RectangleData | LegData;

/**
 * Type guard to check if an element is a Circle
 */
export const isCircle = (element: GenericElement): element is CircleData => {
	return 'radius' in element;
};

/**
 * Type guard to check if an element is a Rectangle
 */
export const isRectangle = (element: GenericElement): element is RectangleData => {
	return 'width' in element && 'height' in element && 'depth' in element;
};

/**
 * Type guard to check if an element is a Leg
 */
export const isLeg = (element: GenericElement): element is LegData => {
	return 'width' in element && 'height' in element && !('depth' in element);
};
