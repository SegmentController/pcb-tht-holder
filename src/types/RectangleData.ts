import { z } from 'zod';

export const RectangleData = z.object({
	depth: z.number(),

	id: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),

	fill: z.literal('green').default('green'),
	draggable: z.literal(true).default(true),
	opacity: z.literal(0.75).default(0.75),
});
export type RectangleData = z.infer<typeof RectangleData>;

export const RectangleSkipJsonProperties = ['fill', 'draggable', 'opacity'];
