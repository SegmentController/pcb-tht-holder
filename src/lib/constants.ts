/**
 * Application-wide constants for PCB THT Holder
 */

// Element default visual properties
export const ELEMENT_OPACITY = 0.75;
export const ELEMENT_DRAGGABLE = true;

// Element colors
export const CIRCLE_COLOR = 'orange';
export const RECTANGLE_COLOR = 'green';
export const LEG_COLOR = 'gray';

// 3D mesh colors
export const POSITIVE_MESH_COLOR = '#ff8811'; // Orange color for PCB visualization mesh

// Fine movement
export const FINE_MOVEMENT_DELTA = 0.1; // mm per arrow key press
export const FINE_MOVEMENT_SHIFT_MULTIPLIER = 5; // 5x faster with shift key (0.5mm)

// Alignment guides
export const ALIGNMENT_SNAP_THRESHOLD = 0.1; // mm tolerance for alignment detection
export const ALIGNMENT_SNAP_DISTANCE = 0.2; // mm distance for magnetic snapping effect
export const ALIGNMENT_LINE_COLOR = '#0088ff'; // bright blue for visibility
export const ALIGNMENT_LINE_WIDTH = 0.1; // mm stroke width

// Canvas zoom (percent of actual size), shared by the slider, keyboard and wheel zoom
export const ZOOM_MIN = 10;
export const ZOOM_MAX = 300;
export const ZOOM_STEP = 10;
export const ZOOM_DEFAULT = 100;

// Properties to skip when serializing elements to JSON
// These are Konva-specific properties that shouldn't be persisted
export const ELEMENT_SKIP_JSON_PROPERTIES = ['fill', 'draggable', 'opacity'];
