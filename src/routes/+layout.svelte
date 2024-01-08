<script lang="ts">
	import { ModalPortal } from '@svelte-put/modal';

	import { modalStore } from '$stores/modalStore';
</script>

<slot />

<ModalPortal store={modalStore} />
