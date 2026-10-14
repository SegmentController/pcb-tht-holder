import { describe, expect, it } from 'vitest';

import { CircleData } from '$types/CircleData';
import { RectangleData } from '$types/RectangleData';

import {
	isGeneratedImage,
	MAX_LAYOUT_SVG_LENGTH,
	renderBoardSvg,
	renderProjectImage,
	svgToDataUrl
} from './boardSvg';

const plan = {
	panel: { width: 20, height: 10 },
	contours: [
		[
			{ x: 0, y: 0 },
			{ x: 20, y: 0 },
			{ x: 20, y: 10 }
		]
	],
	holes: [
		{ x: 5, y: 8, diameter: 1, selected: true },
		{ x: 15, y: 2, diameter: 0.3, selected: false }
	]
};

describe('renderBoardSvg', () => {
	it('sizes the picture to a 1000 px long side with the panel aspect ratio', () => {
		const svg = renderBoardSvg(plan);
		expect(svg).toContain('width="1000" height="500"');
	});

	it('draws the top view: higher y is nearer to the top row', () => {
		const svg = renderBoardSvg(plan);
		// scale 50 px/mm: y=8 -> row (10 - 8) * 50 = 100, y=2 -> row 400
		expect(svg).toContain('cx="250" cy="100"');
		expect(svg).toContain('cx="750" cy="400"');
	});

	it('draws shapes only when asked and rotates counter-clockwise on screen', () => {
		const rectangle = RectangleData.parse({
			id: 'r',
			x: 10,
			y: 5,
			width: 4,
			height: 2,
			depth: 3,
			rotation: 30
		});
		const circle = CircleData.parse({ id: 'c', x: 2, y: 2, radius: 1, depth: 3 });
		expect(renderBoardSvg(plan)).not.toContain('rotate(');
		const svg = renderBoardSvg(plan, { shapes: { circles: [circle], rectangles: [rectangle] } });
		expect(svg).toContain('rotate(-30 500 250)');
		expect(svg).toContain('r="50"');
	});

	it('encodes as an SVG data URL', () => {
		const url = svgToDataUrl(renderBoardSvg(plan));
		expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
		expect(atob(url.split(',')[1]).startsWith('<svg')).toBe(true);
	});
});

describe('renderBoardSvg with a layout', () => {
	const layout = {
		copper: {
			defs: '<g id="c1"><circle r="1"/></g>',
			objects: '<use href="#c1" x="5" y="5" fill="#fff"/>',
			complement: false,
			warnings: []
		},
		mask: {
			defs: '',
			objects: '<use href="#c1" x="5" y="5" fill="#fff"/>',
			complement: false,
			warnings: []
		}
	};
	const withOrigin = { ...plan, origin: { x: -10, y: -5 } };

	it('maps CAM coordinates onto the picture and masks copper by the openings', () => {
		const svg = renderBoardSvg(withOrigin, { layout });
		// scale 50 px/mm, origin (-10, -5), height 10: f = (10 + -5) * 50 = 250, e = 10 * 50 = 500
		expect(svg).toContain('matrix(50 0 0 -50 500 250)');
		expect(svg).toContain(
			'<mask id="copper" maskUnits="userSpaceOnUse" x="-10" y="-5" width="20" height="10">'
		);
		expect(svg).toContain('<g mask="url(#opening)">');
		expect(svg).not.toContain('url(#silk)');
	});

	it('is opaque-friendly: a full board background, no layout leaves the simple render', () => {
		expect(renderBoardSvg(plan)).not.toContain('<mask');
		expect(renderBoardSvg(withOrigin, { layout })).toContain('fill="#1f6f43"');
	});

	it('falls back to the simple render when the layout is too large', () => {
		const huge = { copper: { ...layout.copper, objects: 'x'.repeat(MAX_LAYOUT_SVG_LENGTH) } };
		const result = renderProjectImage(withOrigin, huge);
		expect(result.simplified).toBe(true);
		expect(result.svg).not.toContain('<mask');
		expect(renderProjectImage(withOrigin, layout).simplified).toBe(false);
	});

	it('recognises generated pictures', () => {
		expect(isGeneratedImage('data:image/svg+xml;base64,AAAA')).toBe(true);
		expect(isGeneratedImage('data:image/jpeg;base64,AAAA')).toBe(false);
	});
});

describe('renderBoardSvg polarity', () => {
	const layer = (polarity?: 'Positive' | 'Negative', complement = false) => ({
		defs: '',
		objects: '<use href="#c1" x="5" y="5" fill="\u0001D"/>',
		complement,
		polarity,
		warnings: []
	});
	const withOrigin = { ...plan, origin: { x: 0, y: 0 } };
	const maskOf = (svg: string, id: string) =>
		svg.match(new RegExp(`<mask id="${id}"[^>]*>(.*?)</mask>`))?.[1] ?? '';

	it('keeps copper and silkscreen as drawn when positive or unspecified', () => {
		const svg = renderBoardSvg(withOrigin, {
			layout: { copper: layer(), silk: layer('Positive') }
		});
		expect(maskOf(svg, 'copper')).toBe('<use href="#c1" x="5" y="5" fill="#fff"/>');
		expect(maskOf(svg, 'silk')).toBe('<use href="#c1" x="5" y="5" fill="#fff"/>');
	});

	it('complements a negative copper layer', () => {
		const svg = renderBoardSvg(withOrigin, { layout: { copper: layer('Negative') } });
		expect(maskOf(svg, 'copper')).toContain(
			'fill="#fff"/><use href="#c1" x="5" y="5" fill="#000"/>'
		);
	});

	it('reads mask layers as openings, except when declared positive', () => {
		const negative = renderBoardSvg(withOrigin, {
			layout: { copper: layer(), mask: layer('Negative') }
		});
		expect(maskOf(negative, 'opening')).toBe('<use href="#c1" x="5" y="5" fill="#fff"/>');
		const unspecified = renderBoardSvg(withOrigin, { layout: { copper: layer(), mask: layer() } });
		expect(maskOf(unspecified, 'opening')).toBe('<use href="#c1" x="5" y="5" fill="#fff"/>');
		const positive = renderBoardSvg(withOrigin, {
			layout: { copper: layer(), mask: layer('Positive') }
		});
		expect(maskOf(positive, 'opening')).toContain('fill="#000"/>');
	});

	it('complements images with IPNEG once more', () => {
		const svg = renderBoardSvg(withOrigin, { layout: { copper: layer('Positive', true) } });
		expect(maskOf(svg, 'copper')).toContain('fill="#000"/>');
	});

	it('fills the board only with closed outlines and draws slots as lines', () => {
		const open = {
			...withOrigin,
			contours: [
				[
					{ x: 0, y: 0 },
					{ x: 20, y: 0 },
					{ x: 20, y: 10 }
				]
			]
		};
		expect(renderBoardSvg(open, { layout: { copper: layer() } })).not.toContain(
			'fill-rule="evenodd"'
		);
		const slotted = {
			...withOrigin,
			holes: [{ x: 4, y: 4, diameter: 1, selected: true, slot: { x: 8, y: 4 } }]
		};
		expect(renderBoardSvg(slotted)).toContain('<line x1="200" y1="300" x2="400" y2="300"');
	});
});
