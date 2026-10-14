import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeshInfo } from '$types/MeshInfo';

import { makeProject } from './meshTestUtilities';
import { getProjectKey, type MeshWorkerRequest } from './meshWorkerProtocol';

const sessionGenerate = vi.fn();
vi.mock('./mesh', () => ({
	loadFont: vi.fn(async () => ({ font: true })),
	createMeshSession: vi.fn(() => ({ generate: sessionGenerate, hiddenLegsCount: 3 }))
}));

type Listener = (event: { data?: unknown }) => void;

class FakeWorker {
	static instances: FakeWorker[] = [];
	listeners = new Map<string, Listener[]>();
	posted: MeshWorkerRequest[] = [];
	terminated = false;

	constructor() {
		FakeWorker.instances.push(this);
	}
	addEventListener(type: string, listener: Listener) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}
	postMessage(message: MeshWorkerRequest) {
		this.posted.push(message);
	}
	terminate() {
		this.terminated = true;
	}
	emit(type: string, data?: unknown) {
		for (const listener of this.listeners.get(type) ?? []) listener({ data });
	}
	/** Ids of the generate requests, in order */
	get ids() {
		return this.posted.flatMap((message) => (message.type === 'generate' ? [message.id] : []));
	}
}

const mesh = { positions: [1, 2, 3] } as unknown as MeshInfo;
const project = makeProject(1, 2, 1, 1, 'label');

/** A fresh copy of the module: the client keeps its worker and pending requests at module level */
const load = async (withWorker = true) => {
	FakeWorker.instances = [];
	// Node has no global `Worker`: not stubbing it is the "no worker support" case
	if (withWorker) vi.stubGlobal('Worker', FakeWorker);
	vi.resetModules();
	return await import('./meshClient');
};

describe('createMeshClient with a worker', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('posts the request and resolves with the result of the worker', async () => {
		const { createMeshClient } = await load();
		const client = createMeshClient(project);

		const result = client.generate('main');
		const [worker] = FakeWorker.instances;
		const [request] = worker.posted;
		expect(request).toEqual({
			type: 'generate',
			id: worker.ids[0],
			kind: 'main',
			key: getProjectKey(project),
			project
		});

		worker.emit('message', { type: 'result', id: worker.ids[0], mesh, hiddenLegsCount: 2 });

		await expect(result).resolves.toEqual({ mesh, hiddenLegsCount: 2 });
	});

	it('forwards progress to the caller of that request only', async () => {
		const { createMeshClient } = await load();
		const client = createMeshClient(project);
		const first = vi.fn();
		const second = vi.fn();

		const a = client.generate('main', first);
		const b = client.generate('hollow', second);
		const worker = FakeWorker.instances[0];
		worker.emit('message', { type: 'progress', id: worker.ids[1], current: 3, total: 9 });

		expect(second).toHaveBeenCalledWith(3, 9);
		expect(first).not.toHaveBeenCalled();
		for (const id of worker.ids)
			worker.emit('message', { type: 'result', id, mesh, hiddenLegsCount: 0 });
		await Promise.all([a, b]);
	});

	it('shares one worker between clients', async () => {
		const { createMeshClient } = await load();

		void createMeshClient(project).generate('main');
		void createMeshClient(project).generate('positive');

		expect(FakeWorker.instances).toHaveLength(1);
		expect(FakeWorker.instances[0].ids).toHaveLength(2);
		expect(new Set(FakeWorker.instances[0].ids).size).toBe(2);
	});

	it('rejects with the message of a worker error', async () => {
		const { createMeshClient } = await load();
		const result = createMeshClient(project).generate('main');
		const worker = FakeWorker.instances[0];

		worker.emit('message', { type: 'error', id: worker.ids[0], message: 'CSG exploded' });

		await expect(result).rejects.toThrow('CSG exploded');
	});

	it('rejects with the cancelled error when the worker reports a cancellation', async () => {
		const { createMeshClient, MeshClientCancelledError } = await load();
		const result = createMeshClient(project).generate('main');
		const worker = FakeWorker.instances[0];

		worker.emit('message', { type: 'cancelled', id: worker.ids[0] });

		await expect(result).rejects.toBeInstanceOf(MeshClientCancelledError);
	});

	it('ignores messages of requests it does not know', async () => {
		const { createMeshClient } = await load();
		const result = createMeshClient(project).generate('main');
		const worker = FakeWorker.instances[0];

		worker.emit('message', { type: 'result', id: 999, mesh, hiddenLegsCount: 0 });
		worker.emit('message', { type: 'result', id: worker.ids[0], mesh, hiddenLegsCount: 1 });

		await expect(result).resolves.toEqual({ mesh, hiddenLegsCount: 1 });
	});

	describe('dispose', () => {
		it('cancels the running requests in the worker and rejects them', async () => {
			const { createMeshClient, MeshClientCancelledError } = await load();
			const client = createMeshClient(project);
			const result = client.generate('main');
			const worker = FakeWorker.instances[0];
			const [id] = worker.ids;

			client.dispose();

			expect(worker.posted.at(-1)).toEqual({ type: 'cancel', id });
			await expect(result).rejects.toBeInstanceOf(MeshClientCancelledError);
		});

		it('leaves requests of other clients running', async () => {
			const { createMeshClient } = await load();
			const mine = createMeshClient(project);
			const other = createMeshClient(project);
			void mine.generate('main').catch(() => {});
			const kept = other.generate('hollow');
			const worker = FakeWorker.instances[0];

			mine.dispose();
			worker.emit('message', { type: 'result', id: worker.ids[1], mesh, hiddenLegsCount: 0 });

			await expect(kept).resolves.toMatchObject({ mesh });
			expect(worker.posted.filter((message) => message.type === 'cancel')).toHaveLength(1);
		});

		it('refuses further requests', async () => {
			const { createMeshClient, MeshClientCancelledError } = await load();
			const client = createMeshClient(project);
			client.dispose();

			await expect(client.generate('main')).rejects.toBeInstanceOf(MeshClientCancelledError);
			expect(FakeWorker.instances).toHaveLength(0);
		});
	});

	describe('idle worker', () => {
		it('is terminated after two minutes without requests and recreated on demand', async () => {
			const { createMeshClient } = await load();
			const client = createMeshClient(project);
			const first = client.generate('main');
			const [worker] = FakeWorker.instances;
			worker.emit('message', { type: 'result', id: worker.ids[0], mesh, hiddenLegsCount: 0 });
			await first;

			vi.advanceTimersByTime(119_000);
			expect(worker.terminated).toBe(false);
			vi.advanceTimersByTime(1000);
			expect(worker.terminated).toBe(true);

			void client.generate('main');
			expect(FakeWorker.instances).toHaveLength(2);
		});

		it('is kept alive by a request that arrives in time', async () => {
			const { createMeshClient } = await load();
			const client = createMeshClient(project);
			const first = client.generate('main');
			const [worker] = FakeWorker.instances;
			worker.emit('message', { type: 'result', id: worker.ids[0], mesh, hiddenLegsCount: 0 });
			await first;

			vi.advanceTimersByTime(100_000);
			void client.generate('hollow');
			vi.advanceTimersByTime(100_000);

			expect(worker.terminated).toBe(false);
		});
	});
});

describe('createMeshClient on the calling thread', () => {
	beforeEach(() => {
		sessionGenerate.mockReset();
		sessionGenerate.mockImplementation(
			async (_kind, onProgress?: (a: number, b: number) => void) => {
				onProgress?.(1, 2);
				return mesh;
			}
		);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('generates in-process when there is no Worker', async () => {
		const { createMeshClient } = await load(false);
		const progress = vi.fn();

		const result = await createMeshClient(project).generate('main', progress);

		expect(result).toEqual({ mesh, hiddenLegsCount: 3 });
		expect(progress).toHaveBeenCalledWith(1, 2);
	});

	it('creates one session per client and reuses it for every variant', async () => {
		const { createMeshClient } = await load(false);
		const { createMeshSession } = await import('./mesh');
		const client = createMeshClient(project);

		await client.generate('main');
		await client.generate('hollow');

		expect(createMeshSession).toHaveBeenCalledOnce();
		expect(sessionGenerate.mock.calls.map(([kind]) => kind)).toEqual(['main', 'hollow']);
	});

	it('turns an aborted generation into the cancelled error after dispose', async () => {
		const { createMeshClient, MeshClientCancelledError } = await load(false);
		let release!: () => void;
		sessionGenerate.mockImplementation(async (_kind, _progress, isCancelled: () => boolean) => {
			await new Promise<void>((resolve) => (release = resolve));
			if (isCancelled()) throw new Error('stopped');
			return mesh;
		});
		const client = createMeshClient(project);

		const result = client.generate('main');
		await vi.waitFor(() => expect(release).toBeTypeOf('function'));
		client.dispose();
		release();

		await expect(result).rejects.toBeInstanceOf(MeshClientCancelledError);
	});

	it('passes other errors through', async () => {
		const { createMeshClient } = await load(false);
		sessionGenerate.mockRejectedValue(new Error('bad geometry'));

		await expect(createMeshClient(project).generate('main')).rejects.toThrow('bad geometry');
	});

	it('falls back to the thread when the worker fails to start', async () => {
		const { createMeshClient } = await load();
		const client = createMeshClient(project);

		const result = client.generate('main');
		const [worker] = FakeWorker.instances;
		worker.emit('error');

		await expect(result).resolves.toEqual({ mesh, hiddenLegsCount: 3 });
		expect(worker.terminated).toBe(true);
	});

	it('does not try the broken worker again', async () => {
		const { createMeshClient } = await load();
		const first = createMeshClient(project).generate('main');
		FakeWorker.instances[0].emit('error');
		await first;

		await createMeshClient(project).generate('hollow');

		expect(FakeWorker.instances).toHaveLength(1);
	});

	it('falls back when constructing the worker throws', async () => {
		FakeWorker.instances = [];
		vi.stubGlobal(
			'Worker',
			class {
				constructor() {
					throw new Error('blocked');
				}
			}
		);
		vi.resetModules();
		const { createMeshClient } = await import('./meshClient');

		await expect(createMeshClient(project).generate('main')).resolves.toMatchObject({ mesh });
	});
});
