/* eslint-disable unicorn/prefer-module */
/* eslint-disable unicorn/prefer-node-protocol */
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vite';
import { purgeCss } from 'vite-plugin-tailwind-purgecss';

import package_ from './package.json';

export default defineConfig({
	plugins: [svelte(), purgeCss()],
	build: {
		target: 'modules',
		sourcemap: false,
		minify: true,
		cssMinify: true,
		copyPublicDir: true,
		emptyOutDir: true,
		outDir: 'docs',
		chunkSizeWarningLimit: 1500,
		assetsInlineLimit: 0
	},
	base: process.env.NODE_ENV === 'production' ? '/pcb-tht-holder' : '',
	resolve: {
		alias: {
			$components: path.resolve(__dirname, './src/components'),
			$lib: path.resolve(__dirname, './src/lib'),
			$stores: path.resolve(__dirname, './src/stores'),
			$types: path.resolve(__dirname, './src/types')
		}
	},
	define: {
		__PKG_VERSION__: `"${package_.version}"`,
		__BASE_URL__: `"${process.env.NODE_ENV === 'production' ? '/pcb-tht-holder' : ''}"`
	}
});
