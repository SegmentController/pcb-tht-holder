export const LEG_SIZE = 2;

import { z } from 'zod';

export const LegData = z.object({
	konvaConfig: z.object({
		x: z.number(),
		y: z.number(),
		width: z.number(),
		height: z.number(),

		fill: z.literal('gray'),
		draggable: z.literal(true),
		opacity: z.literal(0.75)
	})
});
export type LegData = z.infer<typeof LegData>;
