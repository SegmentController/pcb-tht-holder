/// <reference lib="webworker" />
import { createMeshSession, loadFont, MeshCancelledError, type MeshSession } from '$lib/3d/mesh';

import type { MeshWorkerRequest, MeshWorkerResponse } from './meshWorkerProtocol';

/**
 * Runs CSG mesh generation off the UI thread. The latest session (project) is kept so that
 * switching between main/hollow/positive, or reopening the 3D view of an unchanged project,
 * reuses the already computed solids.
 */

// three-bvh-csg 0.0.18 still passes the option three-mesh-bvh deprecated and warns on every boolean
// operation; nothing the app can fix, so keep the console readable.
/* eslint-disable no-console */
const originalWarn = console.warn;
console.warn = (...arguments_: unknown[]) => {
	if (typeof arguments_[0] === 'string' && arguments_[0].includes('"maxLeafSize"')) return;
	originalWarn(...arguments_);
};
/* eslint-enable no-console */

let current: { key: string; session: MeshSession } | undefined;
const cancelled = new Set<number>();

// eslint-disable-next-line unicorn/require-post-message-target-origin -- worker scope has no origin
const post = (message: MeshWorkerResponse) => self.postMessage(message);

self.addEventListener('message', async (event: MessageEvent<MeshWorkerRequest>) => {
	const message = event.data;
	if (message.type === 'cancel') {
		cancelled.add(message.id);
		return;
	}

	const { id, kind, key, project } = message;
	try {
		if (current?.key !== key)
			current = { key, session: createMeshSession(project, await loadFont()) };
		const { session } = current;

		const mesh = await session.generate(
			kind,
			(done, total) => post({ type: 'progress', id, current: done, total }),
			() => cancelled.has(id)
		);
		post({ type: 'result', id, mesh, hiddenLegsCount: session.hiddenLegsCount });
	} catch (error) {
		if (error instanceof MeshCancelledError) post({ type: 'cancelled', id });
		else
			post({
				type: 'error',
				id,
				message: error instanceof Error ? error.message : String(error)
			});
	} finally {
		cancelled.delete(id);
	}
});
