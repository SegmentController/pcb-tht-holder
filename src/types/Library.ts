import { z } from 'zod';

export const LibraryItem = z.union([
	z.object({
		type: z.literal('circle'),
		name: z.string(),
		radius: z.number(),
		depth: z.number()
	}),
	z.object({
		type: z.literal('rectangle'),
		name: z.string(),
		width: z.number(),
		height: z.number(),
		depth: z.number(),
		rotation: z.number().default(0)
	})
]);
export type LibraryItem = z.infer<typeof LibraryItem>;

export const Library = z.array(LibraryItem);
export type Library = z.infer<typeof Library>;
