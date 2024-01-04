import { z } from 'zod';

export const PanelSettings = z.object({
	width: z.number(),
	height: z.number(),
	pcbThickness: z.number(),
	smdHeight: z.number()
});
export type PanelSettings = z.infer<typeof PanelSettings>;
