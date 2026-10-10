import path from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import package_ from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	build: {
		target: 'esnext',
		sourcemap: false,
		minify: true,
		cssMinify: true,
		copyPublicDir: true,
		emptyOutDir: true,
		outDir: 'docs',
		chunkSizeWarningLimit: 2000,
		assetsInlineLimit: 0
	},
	base: process.env.NODE_ENV === 'production' ? '/pcb-tht-holder' : '',
	resolve: {
		alias: {
			$components: path.resolve(import.meta.dirname, './src/components'),
			$lib: path.resolve(import.meta.dirname, './src/lib'),
			$stores: path.resolve(import.meta.dirname, './src/stores'),
			$types: path.resolve(import.meta.dirname, './src/types')
		}
	},
	define: {
		__PKG_VERSION__: `"${package_.version}"`,
		__BASE_URL__: `"${process.env.NODE_ENV === 'production' ? '/pcb-tht-holder' : ''}"`
	}
});
