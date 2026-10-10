/** One mesh shown in the 3D preview scene */
export type SceneMesh = {
	/** Stable identity: a changed key re-creates the mesh object */
	key: string;
	/** Flat triangle list: [x1, y1, z1, x2, y2, z2, x3, y3, z3, ...] */
	vertices: Float32Array;
	color?: string;
	opacity?: number;
	/** Offset along the scene's up axis */
	positionOffset?: number;
	flipZ?: boolean;
};
