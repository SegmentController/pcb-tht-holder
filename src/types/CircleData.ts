import { z } from 'zod';

export const CircleData = z.object({
	diameter: z.number(),
	depth: z.number(),
	konvaConfig: z.object({
		x: z.number(),
		y: z.number(),

		radius: z.number(),

		fill: z.literal('orange'),
		draggable: z.literal(true),
		opacity: z.literal(0.75)
	})
});
export type CircleData = z.infer<typeof CircleData>;
