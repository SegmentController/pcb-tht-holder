import { describe, expect, it } from 'vitest';

import { Library } from '$types/Library';

import { convertDefaultComponentToLibraryItem, DEFAULT_COMPONENTS } from './libraryDefaults';

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
