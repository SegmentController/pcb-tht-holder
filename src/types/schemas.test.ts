import { describe, expect, it } from 'vitest';

import { CircleData } from './CircleData';
import {
	convertDefaultComponentToLibraryItem,
	DEFAULT_COMPONENTS,
	Library,
	LibraryItem
} from './Library';
import { PanelSettings } from './PanelSettings';
import { Project } from './Project';
import { RectangleData } from './RectangleData';

const rectangleInput = { id: 'r', x: 1, y: 2, width: 3, height: 4, depth: 5 };

describe('element schemas', () => {
	it('fills in the Konva defaults', () => {
		const parsed = CircleData.parse({ id: 'c', x: 0, y: 0, radius: 1, depth: 2 });
		expect(parsed).toMatchObject({ fill: 'orange', draggable: true, opacity: 0.75 });
	});

	it('rejects a wrong literal value', () => {
		expect(() =>
			CircleData.parse({ id: 'c', x: 0, y: 0, radius: 1, depth: 2, fill: 'red' })
		).toThrow();
	});

	it('requires an id', () => {
		expect(CircleData.safeParse({ x: 0, y: 0, radius: 1, depth: 2 }).success).toBe(false);
	});

	it('defaults rectangle rotation to 0', () => {
		expect(RectangleData.parse(rectangleInput).rotation).toBe(0);
	});

	it('accepts rotations from 0 to 359 and rejects values outside', () => {
		for (const rotation of [0, 90, 359])
			expect(RectangleData.safeParse({ ...rectangleInput, rotation }).success).toBe(true);
		for (const rotation of [-1, 360])
			expect(RectangleData.safeParse({ ...rectangleInput, rotation }).success).toBe(false);
	});
});

describe('panel and project schemas', () => {
	const panel = { width: 100, height: 80, pcbThickness: 1.6, smdHeight: 3 };

	it('defaults printTolerance to 0', () => {
		expect(PanelSettings.parse(panel).printTolerance).toBe(0);
	});

	it('defaults the project label to an empty string', () => {
		const project = Project.parse({
			name: 'p',
			image: '',
			panelSettings: panel,
			zoom: 100,
			circles: [],
			rectangles: [],
			legs: []
		});
		expect(project.label).toBe('');
	});
});

describe('library schema', () => {
	it('defaults the rotation of rectangle items', () => {
		const item = LibraryItem.parse({
			type: 'rectangle',
			name: 'x',
			width: 1,
			height: 2,
			depth: 3
		});
		expect(item).toMatchObject({ rotation: 0 });
	});

	it('discriminates by type and rejects unknown types', () => {
		expect(LibraryItem.safeParse({ type: 'circle', name: 'c', radius: 1, depth: 2 }).success).toBe(
			true
		);
		expect(LibraryItem.safeParse({ type: 'triangle', name: 't' }).success).toBe(false);
		expect(LibraryItem.safeParse({ type: 'circle', name: 'c', depth: 2 }).success).toBe(false);
	});
});

describe('convertDefaultComponentToLibraryItem', () => {
	it('converts circle diameter to radius and component height to depth', () => {
		const item = convertDefaultComponentToLibraryItem({
			name: 'Cap',
			shape: 'circle',
			width: 5,
			depth: 5,
			height: 11
		});
		expect(item).toEqual({ type: 'circle', name: 'Cap', radius: 2.5, depth: 11 });
	});

	it('maps the footprint to width/height and component height to depth for rectangles', () => {
		const item = convertDefaultComponentToLibraryItem({
			name: 'DIP',
			shape: 'rect',
			width: 7.6,
			depth: 10,
			height: 5
		});
		expect(item).toEqual({
			type: 'rectangle',
			name: 'DIP',
			width: 7.6,
			height: 10,
			depth: 5,
			rotation: 0
		});
	});

	it('produces a valid library from every default component', () => {
		const library = DEFAULT_COMPONENTS.map((component) =>
			convertDefaultComponentToLibraryItem(component)
		);
		expect(Library.safeParse(library).success).toBe(true);
	});

	it('has unique default component names', () => {
		const names = DEFAULT_COMPONENTS.map((component) => component.name);
		expect(new Set(names).size).toBe(names.length);
	});
});
