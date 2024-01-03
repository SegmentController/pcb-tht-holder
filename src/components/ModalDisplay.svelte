<script lang="ts">
	import { Canvas } from '@threlte/core';
	import { Button, Modal } from 'flowbite-svelte';

	import Scene from './Scene.svelte';

	let _title: string;
	let isOpen: boolean = false;

	export const open = (title: string = ''): void => {
		_title = title;
		isOpen = true;
	};
</script>

<Modal open={isOpen} size="lg" dismissable={false}>
	<div class="flex justify-end">
		<Button>Download STL</Button>
		<Button class="ml-2" on:click={() => (isOpen = false)} color="alternative">Close</Button>
	</div>
	<div class="canvasContainer">
		<Canvas>
			<Scene />
		</Canvas>
	</div>
</Modal>

<style>
	.canvasContainer {
		width: 100%;
		height: 75vh;
		background: rgb(13, 19, 32);
		background: linear-gradient(180deg, rgba(13, 19, 32, 1) 0%, rgba(8, 12, 21, 1) 100%);
	}
</style>
