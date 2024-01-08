export const LEG_SIZE = 2;

import { z } from 'zod';

export const LegData = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),

	fill: z.literal('gray').default('gray'),
	draggable: z.literal(true).default(true),
	opacity: z.literal(0.75).default(0.75)
});
export type LegData = z.infer<typeof LegData>;

export const LegSkipJsonProperties = ['fill', 'draggable', 'opacity'];
