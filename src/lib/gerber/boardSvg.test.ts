import { describe, expect, it } from 'vitest';

import { CircleData } from '$types/CircleData';
import { RectangleData } from '$types/RectangleData';

import { renderBoardSvg, svgToDataUrl } from './boardSvg';

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
