<script lang="ts">
	import { Button, Modal } from 'flowbite-svelte';
	import { ExclamationCircleOutline } from 'flowbite-svelte-icons';

	let _title: string;
	let _onOk: () => void;
	let isOpen: boolean = false;

	export const open = (title: string, onOk: () => void): void => {
		_title = title;
		_onOk = onOk;
		isOpen = true;
	};
</script>

<Modal open={isOpen} size="xs" dismissable={false}>
	<div class="text-center">
		<ExclamationCircleOutline class="mx-auto mb-4 text-gray-400 w-12 h-12 dark:text-gray-200" />
		<h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
			{_title}
		</h3>
		<Button
			on:click={() => {
				isOpen = false;
				_onOk && _onOk();
			}}
			color="red"
			class="me-2">Yes</Button
		>
		<Button on:click={() => (isOpen = false)} color="alternative">Cancel</Button>
	</div>
</Modal>
