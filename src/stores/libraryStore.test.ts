import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_COMPONENTS } from '$lib/libraryDefaults';
import type { Library } from '$types/Library';

import { getLibraryStoreValue, loadDefaultsToLibrary, setLibraryStoreValue } from './libraryStore';

const custom: Library = [{ type: 'circle', name: 'My part', radius: 3, depth: 7 }];

describe('loadDefaultsToLibrary', () => {
	beforeEach(() => {
		setLibraryStoreValue([]);
	});

	it('fills an empty library with every default component', () => {
		loadDefaultsToLibrary();

		const names = getLibraryStoreValue().map((item) => item.name);
		expect(names).toEqual(DEFAULT_COMPONENTS.map((component) => component.name));
	});

	it('keeps existing custom items in front of the defaults', () => {
		setLibraryStoreValue(custom);

		loadDefaultsToLibrary();

		const library = getLibraryStoreValue();
		expect(library[0]).toEqual(custom[0]);
		expect(library).toHaveLength(custom.length + DEFAULT_COMPONENTS.length);
	});

	it('is idempotent', () => {
		loadDefaultsToLibrary();
		const once = getLibraryStoreValue();

		loadDefaultsToLibrary();

		expect(getLibraryStoreValue()).toEqual(once);
	});

	it('only adds the defaults that are missing', () => {
		const [first] = DEFAULT_COMPONENTS;
		setLibraryStoreValue([{ type: 'circle', name: first!.name, radius: 1, depth: 1 }]);

		loadDefaultsToLibrary();

		const library = getLibraryStoreValue();
		expect(library).toHaveLength(DEFAULT_COMPONENTS.length);
		// the user's version of that name is preserved, not replaced by the default
		expect(library[0]).toMatchObject({ radius: 1, depth: 1 });
	});
});
