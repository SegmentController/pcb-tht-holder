/** A drilled hole or slot in board coordinates (mm, Y up like the CAM files) */
export interface DrillHole {
	x: number;
	y: number;
	/** Finished diameter in mm (slot: width) */
	diameter: number;
	/** Key of the drill tool it came from, see {@link DrillTool.key} */
	toolKey: string;
	/** Slot: the end point, `x`/`y` is the start */
	slot?: Point;
}

/** What the CAD declared a tool is for (`.AperFunction` / `ViaDrill` ...), if anything */
export type DrillRole = 'component' | 'via' | 'mechanical' | 'blind' | 'pad' | 'other' | 'unknown';

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
	role: DrillRole;
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

/** Geometry created by a Gerber layer, in file coordinates converted to mm (dark objects only) */
export type PlotRecord =
	| {
			type: 'flash';
			x: number;
			y: number;
			/** Standard aperture shape: `C` circle, `R` rectangle, `O` obround, `P` polygon, others are macros or blocks */
			shape: 'C' | 'R' | 'O' | 'P' | 'other';
			width: number;
			height: number;
			/** `.AperFunction` attribute value of the aperture, e.g. `ComponentDrill` */
			function?: string;
	  }
	| {
			/** Stroked path (draws and arcs, arcs flattened); `width` is the aperture width */
			type: 'draw';
			points: Point[];
			width: number;
			function?: string;
	  }
	| { type: 'region'; points: Point[]; function?: string };

/** One Gerber layer plotted to SVG (CAM coordinates, mm, Y up) */
export interface PlottedLayer {
	/** `<g id>` / `<mask id>` definitions of the apertures and blocks */
	defs: string;
	/**
	 * Object markup. Fills and strokes are the tokens `\u0001D` (dark object) and `\u0001C` (clear
	 * object): resolve them with {@link resolveColors} when the layer is used.
	 */
	objects: string;
	/** `%IPNEG*%`: the image is the complement of the plotted objects */
	complement: boolean;
	/** `.FilePolarity` file attribute: how to interpret the image */
	polarity?: 'Positive' | 'Negative';
	warnings: string[];
}

/** Result of plotting a Gerber file: SVG plus the semantic data used to read drills and outlines */
export interface PlotResult extends PlottedLayer {
	records: PlotRecord[];
	/** File attributes (`TF`), e.g. `FileFunction` -> `['Copper', 'L1', 'Top']` */
	attributes: Record<string, string[]>;
}

/** Replaces the colour tokens of plotted markup; `invert` swaps dark and clear (complement) */
export const resolveColors = (markup: string, invert = false) =>
	markup
		.replaceAll('\u0001D', invert ? '#000' : '#fff')
		.replaceAll('\u0001C', invert ? '#fff' : '#000');

/** Top side layers used to draw the board picture */
export interface PcbLayout {
	copper?: PlottedLayer;
	/** Solder mask openings (dark = no mask) */
	mask?: PlottedLayer;
	silk?: PlottedLayer;
}

export interface FabPackage {
	holes: DrillHole[];
	tools: DrillTool[];
	outline?: BoardOutline;
	/** File that gave the outline, for display */
	outlineFile?: string;
	layout?: PcbLayout;
	warnings: string[];
}

/** Rounds to 4 decimals (0.1 µm) to remove float noise of unit conversion and scaling */
export const roundCoordinate = (value: number) => Math.round(value * 1e4) / 1e4;
