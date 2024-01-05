import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [
		vitePreprocess(),
		preprocess({
			postcss: true,
			sourceMap: false
		})
	],
	kit: {
		adapter: adapter({
			precompress: false,
			polyfill: false,
			pages: 'docs',
			fallback: 'index.html'
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/pcb-tht-holder' : ''
		},
		alias: {
			$assets: './src/lib/assets',
			$components: './src/components',
			$lib: './src/lib',
			$stores: './src/stores',
			$types: './src/types'
		}
	}
};

export default config;
