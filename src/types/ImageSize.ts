import { z } from 'zod';

export const ImageSize = z.object({
	width: z.number(),
	height: z.number()
});
export type ImageSize = z.infer<typeof ImageSize>;
