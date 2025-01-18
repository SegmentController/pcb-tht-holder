<script lang="ts">
	import type { ComponentEvents } from 'svelte';

	import type { createModalStore } from './modal';
	import type {
		ModalComponentBase,
		ModalComponentBaseResolved,
		ModalPushOutput
	} from './modal.types';

	export let store: ReturnType<typeof createModalStore>;

	function onResolve<
		Component extends ModalComponentBase,
		Resolved extends ModalComponentBaseResolved = ComponentEvents<Component>['resolve']['detail']
	>(modal: ModalPushOutput<Component, Resolved>, event: CustomEvent<Resolved>) {
		store.pop(modal, event.detail);
	}
</script>

{#each $store as modal (modal.id)}
	<svelte:component
		this={modal.component}
		{...modal.props}
		on:resolve={(event) => onResolve(modal, event)}
	/>
{/each}
