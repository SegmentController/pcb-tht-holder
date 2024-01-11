<script lang="ts">
	import { shortcut } from '@svelte-put/shortcut';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		escape: undefined;
	}>();
</script>

<div
	use:shortcut={{
		trigger: [
			{
				key: 'Escape',
				callback: () => {
					dispatch('escape');
				},
				preventDefault: true
			}
		]
	}}
>
	<slot />
</div>
