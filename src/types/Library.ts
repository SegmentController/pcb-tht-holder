import { z } from 'zod';

export const LibraryItem = z.union([
	z.object({
		type: z.literal('circle'),
		name: z.string(),
		diameter: z.number(),
		depth: z.number()
	}),
	z.object({
		type: z.literal('rectangle'),
		name: z.string(),
		sizeX: z.number(),
		sizeY: z.number(),
		depth: z.number()
	})
]);
export type LibraryItem = z.infer<typeof LibraryItem>;

export const Library = z.array(LibraryItem);
export type Library = z.infer<typeof Library>;
