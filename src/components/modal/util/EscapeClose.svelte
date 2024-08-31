<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import { shortcut } from '$lib/shortcut';

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
