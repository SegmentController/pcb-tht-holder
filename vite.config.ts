import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
	clearScreen: true
});
