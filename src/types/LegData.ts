export const LEG_SIZE = 2;

import { z } from 'zod';

import { ELEMENT_DRAGGABLE, ELEMENT_OPACITY, LEG_COLOR } from '$lib/constants';

export const LegData = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),

	fill: z.literal(LEG_COLOR).default(LEG_COLOR),
	draggable: z.literal(ELEMENT_DRAGGABLE).default(ELEMENT_DRAGGABLE),
	opacity: z.literal(ELEMENT_OPACITY).default(ELEMENT_OPACITY)
});
export type LegData = z.infer<typeof LegData>;
