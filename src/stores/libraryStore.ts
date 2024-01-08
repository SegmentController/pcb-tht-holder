import { get } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';

import type { Library } from '$types/Library';

export const libraryStore = persisted<Library>('library', []);

export const getLibraryStoreValue = (): Library => get(libraryStore);
export const updateLibraryStoreValue = (library: Library) => libraryStore.set(library);

