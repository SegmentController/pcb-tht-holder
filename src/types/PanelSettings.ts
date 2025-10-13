import { z } from 'zod';

/**
 * Physical properties and manufacturing tolerances for PCB panel and holder
 *
 * Defines the dimensional specifications and 3D printer compensation parameters
 * that control how the holder is generated. These settings affect:
 * - Overall holder dimensions
 * - Internal cavity sizing for PCB
 * - Support leg height calculations
 * - 3D printer tolerance compensation
 *
 * @remarks
 * **All measurements are in millimeters**
 *
 * **Units and Precision:**
 * - All dimensions: millimeters (mm)
 * - Typical PCB thickness: 1.6mm (standard FR4)
 * - Common SMD heights: 1-5mm
 * - Print tolerance precision: 0.1mm (1/10th millimeter)
 *
 * **Measurement Guidelines:**
 * 1. **Panel Dimensions**: Measure the actual PCB width and height with calipers
 * 2. **PCB Thickness**: Standard is 1.6mm, but verify with calipers or datasheet
 * 3. **SMD Height**: Measure tallest SMD component, add safety margin (~0.5mm)
 * 4. **Print Tolerance**: Start with 0.2mm, adjust based on printer calibration
 */
export const PanelSettings = z.object({
	/**
	 * PCB panel width in millimeters
	 *
	 * Defines the X-axis dimension of the PCB. The holder's inner cavity will be
	 * sized to fit this width (adjusted by printTolerance).
	 *
	 * Typical range: 50-200mm for hobby PCBs
	 */
	width: z.number(),

	/**
	 * PCB panel height in millimeters
	 *
	 * Defines the Y-axis dimension of the PCB. The holder's inner cavity will be
	 * sized to fit this height (adjusted by printTolerance).
	 *
	 * Typical range: 50-200mm for hobby PCBs
	 */
	height: z.number(),

	/**
	 * PCB thickness in millimeters
	 *
	 * The physical thickness of the PCB substrate (usually FR4 fiberglass).
	 * Used to calculate the holder's internal cavity depth.
	 *
	 * Common values:
	 * - 1.6mm: Standard PCB thickness (most common)
	 * - 0.8mm: Thin PCBs
	 * - 2.0mm: Thick PCBs
	 */
	pcbThickness: z.number(),

	/**
	 * SMD component clearance height in millimeters
	 *
	 * The vertical space needed for Surface Mount Device (SMD) components on the
	 * bottom of the PCB. This determines:
	 * - The holder's cavity depth (pcbThickness + smdHeight)
	 * - Support leg height
	 * - Clearance to prevent crushing SMD components
	 *
	 * Measurement: Height of tallest SMD component + ~0.5mm safety margin
	 *
	 * Typical values:
	 * - 2-3mm: For resistors, capacitors, small ICs
	 * - 4-5mm: For larger SMD components, inductors
	 * - 1mm: For minimal SMD or none
	 */
	smdHeight: z.number(),

	/**
	 * 3D printer tolerance compensation in millimeters (0.1mm precision)
	 *
	 * Compensates for dimensional inaccuracies in 3D printing by:
	 * - **Enlarging component holes**: Adds tolerance to circle radius and
	 *   rectangle dimensions (circle: +tolerance, rectangle: +tolerance*2)
	 * - **Shrinking holder panel**: Subtracts tolerance from holder width/height
	 *   (both dimensions: -tolerance*2)
	 *
	 * This bidirectional adjustment ensures:
	 * - THT components fit easily into holes (not too tight)
	 * - Holder grips PCB snugly (not too loose)
	 *
	 * **Calibration Guide:**
	 * - Start with 0.2mm for well-calibrated printers
	 * - Increase to 0.3-0.5mm if holes are too tight or holder too loose
	 * - Decrease to 0.1mm if holder is too loose or holes too large
	 * - Set to 0mm to disable compensation (use exact dimensions)
	 *
	 * Range: 0-2mm (0.1mm increments)
	 * Default: 0mm (no compensation)
	 *
	 * @remarks
	 * The tolerance is NOT applied to the positive mesh (PCB visualization),
	 * which always uses exact dimensions for accurate component visualization.
	 */
	printTolerance: z.number().default(0)
});
export type PanelSettings = z.infer<typeof PanelSettings>;
