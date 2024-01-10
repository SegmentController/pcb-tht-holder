<script lang="ts">
	import { shortcut } from '@svelte-put/shortcut';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		onEscape: undefined;
	}>();
</script>

<div
	use:shortcut={{
		trigger: [
			{
				key: 'Escape',
				callback: () => {
					dispatch('onEscape');
				}
				//preventDefault: true
			}
		]
	}}
>
	<slot />
</div>
