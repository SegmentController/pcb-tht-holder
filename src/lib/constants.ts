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

// Fine movement
export const FINE_MOVEMENT_DELTA = 0.1; // mm per arrow key press
export const FINE_MOVEMENT_SHIFT_MULTIPLIER = 5; // 5x faster with shift key (0.5mm)

// Properties to skip when serializing elements to JSON
// These are Konva-specific properties that shouldn't be persisted
export const ELEMENT_SKIP_JSON_PROPERTIES = ['fill', 'draggable', 'opacity'];
