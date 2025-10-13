import { z } from 'zod';

/**
 * PCB image dimensions in pixels
 *
 * Represents the width and height of the uploaded PCB image used as the background
 * for component placement. These dimensions are used for:
 * - Canvas scaling and zoom calculations
 * - Automatic image resizing when images exceed maximum dimensions
 * - Coordinate system conversions between pixels and millimeters
 *
 * @remarks
 * Images larger than 1280x1024 pixels are automatically resized to improve
 * performance and reduce memory usage.
 */
export const ImageSize = z.object({
	/** Image width in pixels */
	width: z.number(),
	/** Image height in pixels */
	height: z.number()
});
export type ImageSize = z.infer<typeof ImageSize>;
