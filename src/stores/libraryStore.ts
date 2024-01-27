import { get, type Updater } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';

import type { Library } from '$types/Library';

export const libraryStore = persisted<Library>('library', []);

export const getLibraryStoreValue = (): Library => get(libraryStore);
export const setLibraryStoreValue = (library: Library) => libraryStore.set(library);
export const updateLibraryStoreValue = (updater: Updater<Library>) => libraryStore.update(updater);
