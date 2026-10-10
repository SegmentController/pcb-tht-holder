import { readFileSync } from 'node:fs';
import path from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import package_ from './package.json' with { type: 'json' };

/** @threlte/extras' barrel makes Vite emit ~1.9 MB of draco/basis decoders that no chunk references */
const dropUnusedThrelteAssets = (): Plugin => ({
	name: 'drop-unused-threlte-assets',
	generateBundle(_, bundle) {
		for (const fileName of Object.keys(bundle))
			if (/(draco_|basis_transcoder)/.test(fileName)) delete bundle[fileName];
	}
});

/** Static files copied from public/ that make up the offline app shell */
const SHELL_FILES = [
	'./',
	'index.html',
	'manifest.webmanifest',
	'favicon.png',
	'pcb-board-32.png',
	'pcb-board-128.png',
	'pcb-board-512.png'
];

/** Emits service-worker.js from the template with a precache list of the entry assets (hashed names) */
const serviceWorker = (): Plugin => ({
	name: 'service-worker',
	apply: 'build',
	generateBundle(_, bundle) {
		const precache = new Set(SHELL_FILES);
		for (const file of Object.values(bundle))
			if (file.type === 'chunk' && file.isEntry) {
				precache.add(file.fileName);
				for (const css of file.viteMetadata?.importedCss ?? []) precache.add(css);
			}

		const template = readFileSync(
			path.resolve(import.meta.dirname, 'src/service-worker.template.js'),
			'utf8'
		);
		this.emitFile({
			type: 'asset',
			fileName: 'service-worker.js',
			source: template
				.replaceAll('__VERSION__', `v${package_.version}`)
				.replace('__PRECACHE__', JSON.stringify([...precache]))
		});
	}
});

export default defineConfig({
	plugins: [svelte(), tailwindcss(), dropUnusedThrelteAssets(), serviceWorker()],
	build: {
		target: 'esnext',
		sourcemap: false,
		minify: true,
		cssMinify: true,
		copyPublicDir: true,
		emptyOutDir: true,
		outDir: 'docs',
		chunkSizeWarningLimit: 700,
		assetsInlineLimit: 0,
		rolldownOptions: {
			treeshake: {
				// These libraries are side-effect free but do not declare it (barrel imports would
				// otherwise pull in every component, and threlte extras emits unused draco/basis assets)
				moduleSideEffects: [
					{ test: /node_modules[/\\](flowbite-svelte|@threlte)[/\\]/, sideEffects: false }
				]
			}
		}
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
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	},
	define: {
		__PKG_VERSION__: `"${package_.version}"`,
		__BASE_URL__: `"${process.env.NODE_ENV === 'production' ? '/pcb-tht-holder' : ''}"`
	}
});
