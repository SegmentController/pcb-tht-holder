import { readFileSync } from 'node:fs';
import path from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import postcss from 'postcss';
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

/**
 * The app has no dark mode (nothing ever sets a `.dark` class), but flowbite-svelte's themes and form
 * base styles emit ~45 KB of `.dark …` rules. They cannot be switched off in Tailwind, so strip them from
 * the emitted CSS: selectors mentioning `.dark` are dropped, rules and at-rules left empty are removed.
 */
const dropDarkCss = (): Plugin => ({
	name: 'drop-dark-css',
	apply: 'build',
	generateBundle(_, bundle) {
		for (const file of Object.values(bundle)) {
			if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;

			const root = postcss.parse(String(file.source));
			root.walkRules((rule) => {
				const selectors = rule.selectors.filter((selector) => !/\.dark\b/.test(selector));
				if (selectors.length === 0) rule.remove();
				else if (selectors.length < rule.selectors.length) rule.selectors = selectors;
			});
			root.walkAtRules((atRule) => {
				if (atRule.nodes?.length === 0) atRule.remove();
			});
			file.source = root.toString();
		}
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
		// A chunk with everything it imports statically (shared chunks, css); dynamic imports stay lazy
		const addChunk = (fileName: string) => {
			const chunk = bundle[fileName];
			if (chunk?.type !== 'chunk' || precache.has(fileName)) return;
			precache.add(fileName);
			for (const css of chunk.viteMetadata?.importedCss ?? []) precache.add(css);
			for (const imported of chunk.imports) addChunk(imported);
		};
		for (const file of Object.values(bundle))
			if (
				file.type === 'chunk' &&
				(file.isEntry || file.facadeModuleId?.endsWith('/AppDesigner.svelte'))
			)
				addChunk(file.fileName);

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
	plugins: [svelte(), tailwindcss(), dropUnusedThrelteAssets(), dropDarkCss(), serviceWorker()],
	worker: { format: 'es' },
	build: {
		target: 'esnext',
		sourcemap: false,
		minify: true,
		cssMinify: true,
		copyPublicDir: true,
		emptyOutDir: true,
		outDir: 'docs',
		chunkSizeWarningLimit: 850,
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
		include: ['src/**/*.test.ts'],
		// Persist transformed modules between runs (three / three-bvh-csg dominate the transform time)
		fsModuleCache: true,
		// three-bvh-csg's UMD `main` would `require('three')`: a deprecated second copy (three.cjs) and a
		// warning. Its `module` entry is what the production build resolves; use it in tests too
		alias: { 'three-bvh-csg': 'three-bvh-csg/src/index.js' },
		// three-bvh-csg 0.0.18 still passes an option three-mesh-bvh deprecated and warns on every
		// boolean operation; nothing the app can fix (the worker filters it the same way)
		onConsoleLog: (log) => (log.includes('"maxLeafSize"') ? false : undefined)
	},
	define: {
		__PKG_VERSION__: `"${package_.version}"`,
		__BASE_URL__: `"${process.env.NODE_ENV === 'production' ? '/pcb-tht-holder' : ''}"`
	}
});
