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
			precompress: true,
			polyfill: false
		}),
		alias: {
			$assets: './src/lib/assets',
			$components: './src/components',
			$lib: './src/lib',
			$types: './src/types'
		}
	}
};

export default config;
