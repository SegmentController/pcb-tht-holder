import { createModalStore } from '@svelte-put/modal';

import ModalCircleSettings, {
	type CircleSettings
} from '$components/modal/ModalCircleSettings.svelte';
import ModalConfirm from '$components/modal/ModalConfirm.svelte';
import ModalLibrary from '$components/modal/ModalLibrary.svelte';
import ModalMeshDisplay from '$components/modal/ModalMeshDisplay.svelte';
import ModalNameEdit from '$components/modal/ModalNameEdit.svelte';
import ModalPanelSettings from '$components/modal/ModalPanelSettings.svelte';
import ModalRectangleSettings, {
	type RectangleSettings
} from '$components/modal/ModalRectangleSettings.svelte';
import type { MeshInfos } from '$lib/3d/mesh';
import type { PanelSettings } from '$types/PanelSettings';

export const modalStore = createModalStore();

export const showModalConfirm = async (title: string): Promise<{ confirmed: boolean }> =>
	await modalStore.push({ component: ModalConfirm, props: { title } }).resolve();

export const showModalNameEdit = async (
	name: string
): Promise<{ confirmed: boolean; name: string }> =>
	await modalStore.push({ component: ModalNameEdit, props: { name } }).resolve();

export const showModalPanelSettings = async (
	settings: PanelSettings
): Promise<{ confirmed: boolean; settings: PanelSettings }> =>
	await modalStore.push({ component: ModalPanelSettings, props: { settings } }).resolve();
export const showModalCircleSettings = async (
	settings: CircleSettings
): Promise<{ confirmed: boolean; settings: CircleSettings }> =>
	await modalStore.push({ component: ModalCircleSettings, props: { settings } }).resolve();
export const showModalRectangleSettings = async (
	settings: RectangleSettings
): Promise<{ confirmed: boolean; settings: RectangleSettings }> =>
	await modalStore.push({ component: ModalRectangleSettings, props: { settings } }).resolve();

export const showModalLibrary = async (): Promise<object> =>
	await modalStore.push({ component: ModalLibrary }).resolve();

export const showModalMesh = async (
	filename: string,
	meshInfos: Promise<MeshInfos>
): Promise<object> =>
	await modalStore.push({ component: ModalMeshDisplay, props: { filename, meshInfos } }).resolve();
