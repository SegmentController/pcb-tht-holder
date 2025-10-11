import { z } from 'zod';

import { CIRCLE_COLOR, ELEMENT_DRAGGABLE, ELEMENT_OPACITY } from '$lib/constants';

export const CircleData = z.object({
	depth: z.number(),

	id: z.string(),
	x: z.number(),
	y: z.number(),
	radius: z.number(),

	fill: z.literal(CIRCLE_COLOR).default(CIRCLE_COLOR),
	draggable: z.literal(ELEMENT_DRAGGABLE).default(ELEMENT_DRAGGABLE),
	opacity: z.literal(ELEMENT_OPACITY).default(ELEMENT_OPACITY)
});
export type CircleData = z.infer<typeof CircleData>;
