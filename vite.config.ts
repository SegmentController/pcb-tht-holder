import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

import package_ from './package.json';

export default defineConfig({
	clearScreen: true,
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	build: {
		sourcemap: false,
		minify: true,
		cssMinify: true,
		emptyOutDir: true
	},
	ssr: {
		noExternal: ['three']
	},
	define: {
		__PKG_VERSION__: `"${package_.version}"`
	}
});
