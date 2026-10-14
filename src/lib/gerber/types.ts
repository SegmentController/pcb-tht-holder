/** A drilled hole in board coordinates (mm, Y up like the CAM files) */
export interface DrillHole {
	x: number;
	y: number;
	/** Finished diameter in mm */
	diameter: number;
	/** Key of the drill tool it came from, see {@link DrillTool.key} */
	toolKey: string;
}

/** One tool of a drill file with how many holes it drills */
export interface DrillTool {
	/** Unique across files: `<file name>#<tool id>` */
	key: string;
	file: string;
	/** Tool id as written in the file, e.g. `T10` */
	id: string;
	/** Diameter in mm */
	diameter: number;
	plated: boolean;
	/** Declared as a via drill by the CAM tool (`ViaDrill` aperture function) */
	via: boolean;
	count: number;
}

export interface Point {
	x: number;
	y: number;
}

export interface BoundingBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

/** Board outline (`Edge.Cuts` / Profile layer): contours in mm and their bounding box */
export interface BoardOutline {
	contours: Point[][];
	bbox: BoundingBox;
}

/** Plain-text file of a fabrication package */
export interface FabFile {
	name: string;
	text: string;
}

export interface FabPackage {
	holes: DrillHole[];
	tools: DrillTool[];
	outline?: BoardOutline;
	/** File that gave the outline, for display */
	outlineFile?: string;
	warnings: string[];
}

/** Rounds to 4 decimals (0.1 µm) to remove float noise of unit conversion and scaling */
export const roundCoordinate = (value: number) => Math.round(value * 1e4) / 1e4;
