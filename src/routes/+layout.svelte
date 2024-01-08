<script lang="ts">
	import { modalStore } from '$stores/modalStore';
	import { ModalPortal } from '@svelte-put/modal';
</script>

<slot />

<ModalPortal store={modalStore} />
