import { z } from 'zod';

export const CircleData = z.object({
	depth: z.number(),

	id: z.string(),
	x: z.number(),
	y: z.number(),
	radius: z.number(),

	fill: z.literal('orange').default('orange'),
	draggable: z.literal(true).default(true),
	opacity: z.literal(0.75).default(0.75)
});
export type CircleData = z.infer<typeof CircleData>;

export const CircleSkipJsonProperties = ['fill', 'draggable', 'opacity'];
