import type { MeshInfo } from '$types/MeshInfo';
import type { RenderableProject } from '$types/Project';

import type { MeshKind, MeshSession } from './mesh';
import {
	getProjectKey,
	type MeshWorkerRequest,
	type MeshWorkerResponse
} from './meshWorkerProtocol';

export type MeshResult = { mesh: MeshInfo; hiddenLegsCount: number };
export type MeshProgress = (current: number, total: number) => void;

export type MeshClient = {
	/** Generates one variant; rejects with a `MeshClientCancelledError` once the client is disposed */
	generate: (kind: MeshKind, onProgress?: MeshProgress) => Promise<MeshResult>;
	/** Cancels everything still running; the client must not be used afterwards */
	dispose: () => void;
};

export class MeshClientCancelledError extends Error {
	constructor() {
		super('Mesh generation cancelled');
		this.name = 'MeshClientCancelledError';
	}
}

const WORKER_IDLE_TERMINATE_MS = 120_000;

type Pending = {
	resolve: (result: MeshResult) => void;
	reject: (error: Error) => void;
	onProgress?: MeshProgress;
};

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, Pending>();
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let isWorkerBroken = typeof Worker === 'undefined';

const failAll = (error: Error) => {
	for (const request of pending.values()) request.reject(error);
	pending.clear();
};

const handleMessage = (event: MessageEvent<MeshWorkerResponse>) => {
	const message = event.data;
	const request = pending.get(message.id);
	if (!request) return;

	switch (message.type) {
		case 'progress': {
			request.onProgress?.(message.current, message.total);
			return;
		}
		case 'result': {
			request.resolve({ mesh: message.mesh, hiddenLegsCount: message.hiddenLegsCount });
			break;
		}
		case 'cancelled': {
			request.reject(new MeshClientCancelledError());
			break;
		}
		case 'error': {
			request.reject(new Error(message.message));
			break;
		}
	}
	pending.delete(message.id);
};

const getWorker = (): Worker | undefined => {
	if (isWorkerBroken) return undefined;
	if (!worker)
		try {
			// Vite only recognizes this exact `new URL('./...', import.meta.url)` form as a worker entry
			// eslint-disable-next-line unicorn/relative-url-style
			worker = new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' });
			worker.addEventListener('message', handleMessage);
			worker.addEventListener('error', () => {
				// Worker could not start (blocked, unsupported): fall back to the UI thread
				isWorkerBroken = true;
				worker?.terminate();
				worker = undefined;
				failAll(new MeshWorkerUnavailableError());
			});
		} catch {
			isWorkerBroken = true;
			return undefined;
		}
	return worker;
};

class MeshWorkerUnavailableError extends Error {
	constructor() {
		super('Mesh worker unavailable');
		this.name = 'MeshWorkerUnavailableError';
	}
}

/** Frees the worker (and the cached solids) after a while without any use */
const scheduleIdleTermination = () => {
	clearTimeout(idleTimer);
	if (pending.size > 0) return;
	idleTimer = setTimeout(() => {
		if (pending.size > 0) return;
		worker?.terminate();
		worker = undefined;
	}, WORKER_IDLE_TERMINATE_MS);
};

/** Same generation on the calling thread, used when no worker can be started */
const createThreadClient = (project: RenderableProject): MeshClient => {
	let isDisposed = false;
	let session: Promise<MeshSession> | undefined;

	return {
		generate: async (kind, onProgress) => {
			// Only loaded when no worker can be used: keeps CSG out of the UI-thread bundle
			session ??= import('./mesh').then(async ({ createMeshSession, loadFont }) =>
				createMeshSession(project, await loadFont())
			);
			const meshSession = await session;
			try {
				const mesh = await meshSession.generate(kind, onProgress, () => isDisposed);
				return { mesh, hiddenLegsCount: meshSession.hiddenLegsCount };
			} catch (error) {
				if (isDisposed) throw new MeshClientCancelledError();
				throw error;
			}
		},
		dispose: () => {
			isDisposed = true;
		}
	};
};

/**
 * Creates a client generating the meshes of a project in a Web Worker (shared by all clients, it
 * keeps the CSG state of the most recent project), falling back to the calling thread.
 */
export const createMeshClient = (project: RenderableProject): MeshClient => {
	const key = getProjectKey(project);
	const ownIds = new Set<number>();
	let isDisposed = false;
	let threadClient: MeshClient | undefined;

	const generateOnThread: MeshClient['generate'] = (kind, onProgress) => {
		threadClient ??= createThreadClient(project);
		return threadClient.generate(kind, onProgress);
	};

	return {
		generate: (kind, onProgress) => {
			if (isDisposed) return Promise.reject(new MeshClientCancelledError());

			const activeWorker = getWorker();
			if (!activeWorker) return generateOnThread(kind, onProgress);

			clearTimeout(idleTimer);
			const id = nextId++;
			ownIds.add(id);

			return new Promise<MeshResult>((resolve, reject) => {
				pending.set(id, { resolve, reject, onProgress });
				const request: MeshWorkerRequest = { type: 'generate', id, kind, key, project };
				// eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker has no origin
				activeWorker.postMessage(request);
			})
				.catch((error) => {
					if (error instanceof MeshWorkerUnavailableError)
						return generateOnThread(kind, onProgress);
					throw error;
				})
				.finally(() => {
					ownIds.delete(id);
					scheduleIdleTermination();
				});
		},
		dispose: () => {
			isDisposed = true;
			threadClient?.dispose();
			for (const id of ownIds) {
				const request: MeshWorkerRequest = { type: 'cancel', id };
				// eslint-disable-next-line unicorn/require-post-message-target-origin -- Worker has no origin
				worker?.postMessage(request);
				pending.get(id)?.reject(new MeshClientCancelledError());
				pending.delete(id);
			}
			ownIds.clear();
			scheduleIdleTermination();
		}
	};
};
