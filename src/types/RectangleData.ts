import { z } from 'zod';

import { ELEMENT_DRAGGABLE, ELEMENT_OPACITY, RECTANGLE_COLOR } from '$lib/constants';

export const RectangleData = z.object({
	depth: z.number(),

	id: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	rotation: z.number().min(0).max(359).default(0),

	fill: z.literal(RECTANGLE_COLOR).default(RECTANGLE_COLOR),
	draggable: z.literal(ELEMENT_DRAGGABLE).default(ELEMENT_DRAGGABLE),
	opacity: z.literal(ELEMENT_OPACITY).default(ELEMENT_OPACITY)
});
export type RectangleData = z.infer<typeof RectangleData>;
