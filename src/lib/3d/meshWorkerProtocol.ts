import type { MeshInfo } from '$types/MeshInfo';
import type { RenderableProject } from '$types/Project';

import type { MeshKind } from './mesh';

/** Messages sent from the UI thread to the mesh worker */
export type MeshWorkerRequest =
	| {
			type: 'generate';
			id: number;
			kind: MeshKind;
			/** Identifies the project content: the worker reuses its session for an equal key */
			key: string;
			project: RenderableProject;
	  }
	| { type: 'cancel'; id: number };

/** Messages sent from the mesh worker back to the UI thread */
export type MeshWorkerResponse =
	| { type: 'progress'; id: number; current: number; total: number }
	| { type: 'result'; id: number; mesh: MeshInfo; hiddenLegsCount: number }
	| { type: 'cancelled'; id: number }
	| { type: 'error'; id: number; message: string };

/** Everything that influences the generated meshes (the canvas zoom does not) */
export const getProjectKey = (project: RenderableProject): string =>
	JSON.stringify({ ...project, zoom: 0 });
