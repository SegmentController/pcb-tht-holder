import { z } from 'zod';

export const RectangleData = z.object({
	sizeX: z.number(),
	sizeY: z.number(),
	depth: z.number(),
	konvaConfig: z.object({
		x: z.number(),
		y: z.number(),
		width: z.number(),
		height: z.number(),

		fill: z.literal('green'),
		draggable: z.literal(true),
		opacity: z.literal(0.75)
	})
});
export type RectangleData = z.infer<typeof RectangleData>;
