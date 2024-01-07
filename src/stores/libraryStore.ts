import { persisted } from 'svelte-persisted-store';

import type { Library } from '$types/Library';

export const libraryStore = persisted<Library>('library', []);
