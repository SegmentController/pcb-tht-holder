import ModalCircleSettings, {
	type CircleSettings
} from '$components/modal/ModalCircleSettings.svelte';
import ModalConfirm from '$components/modal/ModalConfirm.svelte';
import ModalLibrary from '$components/modal/ModalLibrary.svelte';
import ModalMeshDisplay from '$components/modal/ModalMeshDisplay.svelte';
import ModalNameEdit from '$components/modal/ModalNameEdit.svelte';
import ModalProjectSettings from '$components/modal/ModalProjectSettings.svelte';
import ModalRectangleSettings, {
	type RectangleSettings
} from '$components/modal/ModalRectangleSettings.svelte';
import { createModalStore } from '$lib/svelteModal/modal';
import type { MeshInfoTuple } from '$types/MeshInfo';
import type { PanelSettings } from '$types/PanelSettings';

export const modalStore = createModalStore();

export const showModalConfirm = async (title: string): Promise<{ confirmed: boolean }> =>
	await modalStore
		.push({
			component: ModalConfirm,
			props: {
				title
			}
		})
		.resolve();

export const showModalNameEdit = async (
	name: string
): Promise<{ confirmed: boolean; name: string }> =>
	await modalStore
		.push({
			component: ModalNameEdit,
			props: {
				name
			}
		})
		.resolve();

export const showModalProjectSettings = async (
	panelSettings: PanelSettings,
	name: string,
	label: string
): Promise<{ confirmed: boolean; panelSettings: PanelSettings; name: string; label: string }> =>
	await modalStore
		.push({
			component: ModalProjectSettings,
			props: {
				panelSettings: structuredClone(panelSettings),
				name,
				label
			}
		})
		.resolve();
export const showModalCircleSettings = async (
	settings: CircleSettings
): Promise<{ confirmed: boolean; settings: CircleSettings }> =>
	await modalStore
		.push({
			component: ModalCircleSettings,
			props: {
				settings: structuredClone(settings)
			}
		})
		.resolve();
export const showModalRectangleSettings = async (
	settings: RectangleSettings
): Promise<{ confirmed: boolean; settings: RectangleSettings }> =>
	await modalStore
		.push({
			component: ModalRectangleSettings,
			props: {
				settings: structuredClone(settings)
			}
		})
		.resolve();

export const showModalLibrary = async (): Promise<object> =>
	await modalStore.push({ component: ModalLibrary }).resolve();

export const showModalMesh = async (
	filename: string,
	meshInfoTuple: Promise<MeshInfoTuple>
): Promise<object> =>
	await modalStore
		.push({
			component: ModalMeshDisplay,
			props: {
				name: filename,
				meshInfoTuple
			}
		})
		.resolve();
