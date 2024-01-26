<script lang="ts">
	import { Toast } from 'flowbite-svelte';

	let visible: boolean = false;
	let _header: string;
	let _text: string;

	export const showError = (header: string, text: string, timeout = 2300) => {
		_header = header;
		_text = text;
		visible = true;
		setTimeout(() => (visible = false), timeout);
	};
	export const hide = () => (visible = false);
</script>

{#if visible}
	<div class="child">
		<Toast dismissable={false}>
			<div class="text-red-500 text-lg font-semibold">
				<svg
					class="inline"
					xmlns="http://www.w3.org/2000/svg"
					width="32"
					height="32"
					viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m8 10V7h-2v6zm0 4v-2h-2v2z"
					/></svg
				>
				{_header}
			</div>
			<div class="text-gray-500">
				{_text}
			</div>
		</Toast>
	</div>
{/if}

<style>
	.child {
		position: absolute;
		left: 50%;
		transform: translate(-50%, 0);
	}
</style>
