import type { CircleData } from '$types/CircleData';
import type { RectangleData } from '$types/RectangleData';

import type { ElementPlan } from './plan';

/** Long side of the rendered picture in pixels: the designer shows it at 100 % zoom */
const LONG_SIDE_PX = 1000;

const number = (value: number) => String(Math.round(value * 100) / 100);

export interface BoardSvgOptions {
	/** Also draw the planned circles and rectangles (import preview); the designer draws those itself */
	shapes?: { circles: readonly CircleData[]; rectangles: readonly RectangleData[] };
}

/**
 * Renders a top view of the board (outline and drilled holes) as an SVG document.
 *
 * Row 0 is the highest y: the designer flips the project picture vertically, exactly as it does for
 * a photo of the top side, so elements and picture line up. Strokes are strong because the designer
 * shows the picture at 25 % opacity.
 */
export const renderBoardSvg = (
	plan: Pick<ElementPlan, 'panel' | 'contours' | 'holes'>,
	options: BoardSvgOptions = {}
) => {
	const { width, height } = plan.panel;
	const scale = LONG_SIDE_PX / Math.max(width, height);
	const pixelWidth = Math.round(width * scale);
	const pixelHeight = Math.round(height * scale);
	const px = (x: number) => number(x * scale);
	const py = (y: number) => number((height - y) * scale);

	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${pixelWidth} ${pixelHeight}">`,
		`<rect width="${pixelWidth}" height="${pixelHeight}" fill="#dcefd8"/>`
	];

	for (const contour of plan.contours)
		parts.push(
			`<polyline points="${contour.map((point) => `${px(point.x)},${py(point.y)}`).join(' ')}" fill="none" stroke="#14532d" stroke-width="3" stroke-linejoin="round"/>`
		);

	if (options.shapes) {
		for (const rectangle of options.shapes.rectangles) {
			const cx = rectangle.x * scale;
			const cy = (height - rectangle.y) * scale;
			const rectWidth = rectangle.width * scale;
			const rectHeight = rectangle.height * scale;
			parts.push(
				`<rect x="${number(cx - rectWidth / 2)}" y="${number(cy - rectHeight / 2)}" width="${number(rectWidth)}" height="${number(rectHeight)}" transform="rotate(${-rectangle.rotation} ${number(cx)} ${number(cy)})" fill="#16a34a" fill-opacity="0.35" stroke="#15803d" stroke-width="2"/>`
			);
		}
		for (const circle of options.shapes.circles)
			parts.push(
				`<circle cx="${px(circle.x)}" cy="${py(circle.y)}" r="${number(circle.radius * scale)}" fill="#f97316" fill-opacity="0.35" stroke="#c2410c" stroke-width="2"/>`
			);
	}

	for (const hole of plan.holes) {
		const radius = Math.max(1.5, (hole.diameter / 2) * scale);
		parts.push(
			hole.selected
				? `<circle cx="${px(hole.x)}" cy="${py(hole.y)}" r="${number(radius)}" fill="#ffffff" stroke="#000000" stroke-width="2.5"/>`
				: `<circle cx="${px(hole.x)}" cy="${py(hole.y)}" r="${number(radius)}" fill="none" stroke="#525252" stroke-width="1.5"/>`
		);
	}

	parts.push('</svg>');
	return parts.join('');
};

/** `data:` URL of an SVG document (the content is plain ASCII numbers and tags) */
export const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;
