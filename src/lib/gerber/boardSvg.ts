import type { CircleData } from '$types/CircleData';
import type { RectangleData } from '$types/RectangleData';

import type { ElementPlan } from './plan';
import { type PcbLayout, type PlottedLayer, type Point, resolveColors } from './types';

/** Long side of the rendered picture in pixels: the designer shows it at 100 % zoom */
const LONG_SIDE_PX = 1000;

const number = (value: number) => String(Math.round(value * 100) / 100);

/** Board colours of the rendered layout: substrate under the mask, copper, exposed pads, silkscreen */
const COLORS = {
	background: '#e5e7eb',
	board: '#1f6f43',
	copper: '#3c9a62',
	exposed: '#d6bf7a',
	silk: '#f5f5f0'
};

/** Pictures larger than this fall back to the simple outline + holes render (kept in localStorage) */
export const MAX_LAYOUT_SVG_LENGTH = 1_500_000;

/** Generated pictures are SVG; photos are raster images (the designer shows photos transparent) */
export const isGeneratedImage = (dataUrl: string) => dataUrl.startsWith('data:image/svg+xml');

export interface BoardSvgOptions {
	/** Also draw the planned circles and rectangles (import preview); the designer draws those itself */
	shapes?: { circles: readonly CircleData[]; rectangles: readonly RectangleData[] };
	/** Top copper, solder mask openings and silkscreen drawn under the holes */
	layout?: PcbLayout;
}

/**
 * Renders a top view of the board (outline and drilled holes) as an SVG document.
 *
 * Row 0 is the highest y: the designer flips the project picture vertically, exactly as it does for
 * a photo of the top side, so elements and picture line up. Strokes are strong because the designer
 * shows the picture at 25 % opacity.
 */
export const renderBoardSvg = (
	plan: Pick<ElementPlan, 'panel' | 'contours' | 'holes'> & Partial<Pick<ElementPlan, 'origin'>>,
	options: BoardSvgOptions = {}
) => {
	const { width, height } = plan.panel;
	const scale = LONG_SIDE_PX / Math.max(width, height);
	const pixelWidth = Math.round(width * scale);
	const pixelHeight = Math.round(height * scale);
	const px = (x: number) => number(x * scale);
	const py = (y: number) => number((height - y) * scale);

	const { layout, shapes } = options;
	// Closed contours fill the board (cut-outs by even-odd); an open outline cannot be filled
	const closed = (contour: readonly Point[]) =>
		contour.length > 2 &&
		Math.hypot(contour[0].x - contour.at(-1)!.x, contour[0].y - contour.at(-1)!.y) < 0.05;
	const outlinePath =
		plan.contours.length > 0 && plan.contours.every((contour) => closed(contour))
			? plan.contours
					.map(
						(contour) => `M${contour.map((point) => `${px(point.x)} ${py(point.y)}`).join('L')}Z`
					)
					.join('')
			: '';

	const parts: string[] = [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${pixelWidth} ${pixelHeight}">`
	];

	if (layout) {
		// Layers are drawn in CAM coordinates (mm, Y up): the group maps them onto the picture
		const origin = plan.origin ?? { x: 0, y: 0 };
		const bounds = `x="${number(origin.x)}" y="${number(origin.y)}" width="${number(width)}" height="${number(height)}"`;
		const fill = (color: string) => `<rect ${bounds} fill="${color}"/>`;

		// What a layer's image stands for: copper and legend are material when positive, mask layers
		// show the openings unless declared positive (then the image is the mask itself)
		const complementOf = (layer: PlottedLayer, kind: 'material' | 'openings') =>
			layer.complement !== (layer.polarity === (kind === 'material' ? 'Negative' : 'Positive'));
		const layers = [
			{
				id: 'copper',
				layer: layout.copper,
				invert: layout.copper && complementOf(layout.copper, 'material')
			},
			{
				id: 'opening',
				layer: layout.mask,
				invert: layout.mask && complementOf(layout.mask, 'openings')
			},
			{
				id: 'silk',
				layer: layout.silk,
				invert: layout.silk && complementOf(layout.silk, 'material')
			}
		];
		const definitions = layers.map(({ id, layer, invert }) =>
			layer
				? `${resolveColors(layer.defs, invert)}<mask id="${id}" maskUnits="userSpaceOnUse" ${bounds}>${invert ? fill('#fff') : ''}${resolveColors(layer.objects, invert)}</mask>`
				: ''
		);

		parts.push(
			`<defs>${definitions.join('')}</defs>`,
			`<rect width="${pixelWidth}" height="${pixelHeight}" fill="${COLORS.background}"/>`,
			outlinePath
				? `<path d="${outlinePath}" fill="${COLORS.board}" fill-rule="evenodd"/>`
				: `<rect width="${pixelWidth}" height="${pixelHeight}" fill="${COLORS.board}"/>`,
			`<g transform="matrix(${number(scale)} 0 0 ${number(-scale)} ${number(-origin.x * scale)} ${number((height + origin.y) * scale)})">`
		);
		if (layout.copper) {
			// Copper not covered by mask shines through the openings
			const exposed = layout.mask
				? `<g mask="url(#opening)">${fill(COLORS.exposed)}</g>`
				: fill(COLORS.exposed);
			parts.push(`<g mask="url(#copper)">${fill(COLORS.copper)}${exposed}</g>`);
		}
		if (layout.silk) parts.push(`<g mask="url(#silk)">${fill(COLORS.silk)}</g>`);
		parts.push('</g>');
	} else parts.push(`<rect width="${pixelWidth}" height="${pixelHeight}" fill="#dcefd8"/>`);

	for (const contour of plan.contours)
		parts.push(
			`<polyline points="${contour.map((point) => `${px(point.x)},${py(point.y)}`).join(' ')}" fill="none" stroke="${layout ? '#0b2e1a' : '#14532d'}" stroke-width="3" stroke-linejoin="round"/>`
		);

	if (shapes) {
		for (const rectangle of shapes.rectangles) {
			const cx = rectangle.x * scale;
			const cy = (height - rectangle.y) * scale;
			const rectWidth = rectangle.width * scale;
			const rectHeight = rectangle.height * scale;
			parts.push(
				`<rect x="${number(cx - rectWidth / 2)}" y="${number(cy - rectHeight / 2)}" width="${number(rectWidth)}" height="${number(rectHeight)}" transform="rotate(${-rectangle.rotation} ${number(cx)} ${number(cy)})" fill="#16a34a" fill-opacity="0.35" stroke="#15803d" stroke-width="2"/>`
			);
		}
		for (const circle of shapes.circles)
			parts.push(
				`<circle cx="${px(circle.x)}" cy="${py(circle.y)}" r="${number(circle.radius * scale)}" fill="#f97316" fill-opacity="0.35" stroke="#c2410c" stroke-width="2"/>`
			);
	}

	for (const hole of plan.holes) {
		const radius = Math.max(1.5, (hole.diameter / 2) * scale);
		const idle = layout ? COLORS.background : 'none';
		if (hole.slot) {
			const slotIdle = idle === 'none' ? '#dcefd8' : idle;
			const line = `x1="${px(hole.x)}" y1="${py(hole.y)}" x2="${px(hole.slot.x)}" y2="${py(hole.slot.y)}" stroke-linecap="round"`;
			parts.push(
				`<line ${line} stroke="${hole.selected ? '#000000' : '#525252'}" stroke-width="${number(2 * radius + (hole.selected ? 5 : 3))}"/>`,
				`<line ${line} stroke="${hole.selected ? '#ffffff' : slotIdle}" stroke-width="${number(2 * radius)}"/>`
			);
			continue;
		}
		parts.push(
			hole.selected
				? `<circle cx="${px(hole.x)}" cy="${py(hole.y)}" r="${number(radius)}" fill="#ffffff" stroke="#000000" stroke-width="2.5"/>`
				: `<circle cx="${px(hole.x)}" cy="${py(hole.y)}" r="${number(radius)}" fill="${idle}" stroke="#525252" stroke-width="1.5"/>`
		);
	}

	parts.push('</svg>');
	return parts.join('');
};

/** `data:` URL of an SVG document (the content is plain ASCII numbers and tags) */
export const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

/**
 * Picture stored with an imported project: the full layout, or the simple outline + holes render when
 * the layout would be too large for localStorage.
 */
export const renderProjectImage = (
	plan: Parameters<typeof renderBoardSvg>[0],
	layout?: PcbLayout
) => {
	const full = layout ? renderBoardSvg(plan, { layout }) : undefined;
	if (full && full.length <= MAX_LAYOUT_SVG_LENGTH) return { svg: full, simplified: false };
	return { svg: renderBoardSvg(plan), simplified: Boolean(layout) };
};
