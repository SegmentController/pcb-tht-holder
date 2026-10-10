/**
 * Topological repair of CSG output (non-indexed triangle soup, 9 floats per triangle).
 *
 * three-bvh-csg clips triangles independently and never re-triangulates their neighbours, so the
 * result has near-duplicate seam vertices that differ by float noise, T-junctions (a vertex of one
 * triangle sits in the middle of a neighbour's edge), zero-area slivers, the odd flipped patch and
 * now and then a small hole. Slicers match edges by vertex identity, so all of that shows up as
 * "open edges" although the solid itself is geometrically fine.
 *
 * Kept free of three/CSG imports so it can be unit-tested in plain Node.
 */

// mm. Float noise of CSG seams is ~1e-5; larger radii merge real (sliver) geometry and make the
// seams worse, not better. The same value is the tolerance for "lies on this edge/line".
const WELD_EPSILON = 2e-4;
const CELL_SIZE = WELD_EPSILON * 2; // a neighbour within epsilon is in this cell or the nearer one
const MAX_SPLIT_ROUNDS = 8; // splitting one side of a seam can expose vertices of the other side
const MAX_HOLE_EDGES = 16;
const MAX_HOLE_DEVIATION = 0.01; // mm: how far a hole's vertices may stray from its plane

const hashCell = (x: number, y: number, z: number) =>
	Math.trunc(Math.imul(x, 73_856_093) ^ Math.imul(y, 19_349_663) ^ Math.imul(z, 83_492_791));

type Vertices = number[]; // flat xyz of the welded vertices
type Triangles = number[]; // flat vertex ids, 3 per triangle

const edgeKeyFor = (vertexCount: number) => (a: number, b: number) =>
	a < b ? a * vertexCount + b : b * vertexCount + a;

/** Undirected edge -> number of triangles using it */
const countEdgeUses = (triangles: Triangles, edgeKey: (a: number, b: number) => number) => {
	const uses = new Map<number, number>();
	for (let index = 0; index < triangles.length; index += 3)
		for (let corner = 0; corner < 3; corner++) {
			const key = edgeKey(triangles[index + corner]!, triangles[index + ((corner + 1) % 3)]!);
			uses.set(key, (uses.get(key) ?? 0) + 1);
		}
	return uses;
};

const countOpen = (triangles: Triangles, vertexCount: number) => {
	let open = 0;
	for (const uses of countEdgeUses(triangles, edgeKeyFor(vertexCount)).values())
		if (uses === 1) open++;
	return open;
};

/** Merges corners closer than WELD_EPSILON; the representative keeps its exact coordinates */
const weld = (vertices: Float32Array) => {
	const coordinates: Vertices = [];
	const buckets = new Map<number, number[]>();
	const corners = new Uint32Array(vertices.length / 3);
	const epsilonSquared = WELD_EPSILON * WELD_EPSILON;

	const findNear = (x: number, y: number, z: number, cells: [number[], number[], number[]]) => {
		for (const cellX of cells[0])
			for (const cellY of cells[1])
				for (const cellZ of cells[2]) {
					const bucket = buckets.get(hashCell(cellX, cellY, cellZ));
					if (bucket)
						for (const id of bucket) {
							const dx = coordinates[id * 3]! - x;
							const dy = coordinates[id * 3 + 1]! - y;
							const dz = coordinates[id * 3 + 2]! - z;
							if (dx * dx + dy * dy + dz * dz <= epsilonSquared) return id;
						}
				}
		return -1;
	};

	for (let corner = 0; corner < corners.length; corner++) {
		const x = vertices[corner * 3]!;
		const y = vertices[corner * 3 + 1]!;
		const z = vertices[corner * 3 + 2]!;
		const scaled = [x / CELL_SIZE, y / CELL_SIZE, z / CELL_SIZE];
		const own = scaled.map((value) => Math.floor(value));
		const [nearX, nearY, nearZ] = scaled.map((value, axis) =>
			value - own[axis]! < 0.5 ? own[axis]! - 1 : own[axis]! + 1
		);

		let id = findNear(x, y, z, [
			[own[0]!, nearX!],
			[own[1]!, nearY!],
			[own[2]!, nearZ!]
		]);
		if (id < 0) {
			id = coordinates.length / 3;
			coordinates.push(x, y, z);
			const key = hashCell(own[0]!, own[1]!, own[2]!);
			const bucket = buckets.get(key);
			if (bucket) bucket.push(id);
			else buckets.set(key, [id]);
		}
		corners[corner] = id;
	}

	return { coordinates, corners };
};

/**
 * Triangles with a repeated vertex, or whose corners are collinear within WELD_EPSILON (zero
 * area, which CSG emits along coplanar seams). They carry no volume but glue edges together in a
 * way that hides T-junctions; their neighbours' edges are re-matched by the T-junction splitting.
 */
const isDegenerate = (coordinates: Vertices, a: number, b: number, c: number) => {
	if (a === b || b === c || c === a) return true;

	const abx = coordinates[b * 3]! - coordinates[a * 3]!;
	const aby = coordinates[b * 3 + 1]! - coordinates[a * 3 + 1]!;
	const abz = coordinates[b * 3 + 2]! - coordinates[a * 3 + 2]!;
	const acx = coordinates[c * 3]! - coordinates[a * 3]!;
	const acy = coordinates[c * 3 + 1]! - coordinates[a * 3 + 1]!;
	const acz = coordinates[c * 3 + 2]! - coordinates[a * 3 + 2]!;
	const bcx = acx - abx;
	const bcy = acy - aby;
	const bcz = acz - abz;

	const crossX = aby * acz - abz * acy;
	const crossY = abz * acx - abx * acz;
	const crossZ = abx * acy - aby * acx;
	const longestSquared = Math.max(
		abx * abx + aby * aby + abz * abz,
		acx * acx + acy * acy + acz * acz,
		bcx * bcx + bcy * bcy + bcz * bcz
	);
	// |cross| / longest edge = height of the triangle over its longest edge
	return (
		crossX * crossX + crossY * crossY + crossZ * crossZ <=
		WELD_EPSILON * WELD_EPSILON * longestSquared
	);
};

/**
 * One round of T-junction splitting: triangles whose open edge has other vertices lying on it are
 * divided so that both sides of the seam end up with the same edges. Orientation is preserved;
 * `triangles` is edited in place.
 *
 * @param strict - Only insert vertices that continue along the edge's line on the other side of the
 *   seam (they have an open edge to another vertex on that line). Without it every vertex touching
 *   the edge is inserted, which also splits the edges of real holes (bow-tie corners).
 * @returns Whether any triangle was split
 */
const splitTJunctions = (coordinates: Vertices, triangles: Triangles, strict: boolean): boolean => {
	const edgeKey = edgeKeyFor(coordinates.length / 3);
	const edgeUses = countEdgeUses(triangles, edgeKey);
	const addUse = (a: number, b: number, delta: number) => {
		const key = edgeKey(a, b);
		const next = (edgeUses.get(key) ?? 0) + delta;
		if (next === 0) edgeUses.delete(key);
		else edgeUses.set(key, next);
	};

	// Only endpoints of open edges can be the vertex that lies on another open edge
	const pending: number[] = [];
	const openNeighbours = new Map<number, number[]>();
	const link = (from: number, to: number) => {
		const list = openNeighbours.get(from);
		if (list) list.push(to);
		else openNeighbours.set(from, [to]);
	};
	for (let index = 0; index < triangles.length; index += 3) {
		let isOpen = false;
		for (let corner = 0; corner < 3; corner++) {
			const a = triangles[index + corner]!;
			const b = triangles[index + ((corner + 1) % 3)]!;
			if (edgeUses.get(edgeKey(a, b)) === 1) {
				isOpen = true;
				link(a, b);
				link(b, a);
			}
		}
		if (isOpen) pending.push(index / 3);
	}
	if (openNeighbours.size === 0) return false;

	// Sorted by X so an edge only scans the vertices inside its X range
	const candidates = [...openNeighbours.keys()].toSorted(
		(a, b) => coordinates[a * 3]! - coordinates[b * 3]!
	);
	const candidateX = candidates.map((id) => coordinates[id * 3]!);
	const epsilonSquared = WELD_EPSILON * WELD_EPSILON;

	const lowerBound = (value: number) => {
		let low = 0;
		let high = candidateX.length;
		while (low < high) {
			const middle = Math.trunc((low + high) / 2);
			if (candidateX[middle]! < value) low = middle + 1;
			else high = middle;
		}
		return low;
	};

	/** The candidate vertices strictly inside the segment u-v, ordered from u to v */
	const findOnEdge = (u: number, v: number): number[] => {
		const ux = coordinates[u * 3]!;
		const uy = coordinates[u * 3 + 1]!;
		const uz = coordinates[u * 3 + 2]!;
		const dx = coordinates[v * 3]! - ux;
		const dy = coordinates[v * 3 + 1]! - uy;
		const dz = coordinates[v * 3 + 2]! - uz;
		const lengthSquared = dx * dx + dy * dy + dz * dz;
		if (lengthSquared === 0) return [];

		const margin = WELD_EPSILON / Math.sqrt(lengthSquared);
		const minX = Math.min(ux, ux + dx) - WELD_EPSILON;
		const maxX = Math.max(ux, ux + dx) + WELD_EPSILON;
		const onEdge: Array<{ id: number; t: number }> = [];
		for (let index = lowerBound(minX); index < candidates.length; index++) {
			if (candidateX[index]! > maxX) break;
			const id = candidates[index]!;
			if (id === u || id === v) continue;

			const px = coordinates[id * 3]! - ux;
			const py = coordinates[id * 3 + 1]! - uy;
			const pz = coordinates[id * 3 + 2]! - uz;
			const t = (px * dx + py * dy + pz * dz) / lengthSquared;
			if (t <= margin || t >= 1 - margin) continue;

			const ox = px - t * dx;
			const oy = py - t * dy;
			const oz = pz - t * dz;
			if (ox * ox + oy * oy + oz * oz <= epsilonSquared) onEdge.push({ id, t });
		}

		const isOnLine = (id: number) => {
			const px = coordinates[id * 3]! - ux;
			const py = coordinates[id * 3 + 1]! - uy;
			const pz = coordinates[id * 3 + 2]! - uz;
			const crossX = py * dz - pz * dy;
			const crossY = pz * dx - px * dz;
			const crossZ = px * dy - py * dx;
			return crossX * crossX + crossY * crossY + crossZ * crossZ <= epsilonSquared * lengthSquared;
		};
		const continues = (id: number) =>
			openNeighbours.get(id)!.some((other) => other === u || other === v || isOnLine(other));

		return onEdge
			.filter(({ id }) => !strict || continues(id))
			.toSorted((a, b) => a.t - b.t)
			.map(({ id }) => id);
	};

	let changed = false;
	while (pending.length > 0) {
		const triangle = pending.pop()!;
		const base = triangle * 3;
		for (let corner = 0; corner < 3; corner++) {
			const v0 = triangles[base + corner]!;
			const v1 = triangles[base + ((corner + 1) % 3)]!;
			const v2 = triangles[base + ((corner + 2) % 3)]!;
			if (edgeUses.get(edgeKey(v0, v1)) !== 1) continue;

			const chain = findOnEdge(v0, v1);
			if (chain.length === 0) continue;

			// (v0, v1, v2) -> fan around v2 over v0 -> chain... -> v1; the orientation is preserved
			const path = [v0, ...chain, v1];
			addUse(v0, v1, -1);
			for (let index = 0; index + 1 < path.length; index++)
				addUse(path[index]!, path[index + 1]!, 1);
			for (const id of chain) addUse(id, v2, 2);

			triangles[base] = path[0]!;
			triangles[base + 1] = path[1]!;
			triangles[base + 2] = v2;
			changed = true;
			pending.push(triangle);
			for (let index = 1; index + 1 < path.length; index++) {
				pending.push(triangles.length / 3);
				triangles.push(path[index]!, path[index + 1]!, v2);
			}
			break;
		}
	}
	return changed;
};

const splitUntilStable = (coordinates: Vertices, triangles: Triangles, strict: boolean) => {
	for (let round = 0; round < MAX_SPLIT_ROUNDS; round++)
		if (!splitTJunctions(coordinates, triangles, strict)) break;
};

/**
 * Makes neighbouring triangles agree on which way is outward: across every edge shared by exactly
 * two triangles the two must traverse it in opposite directions. Orientation is propagated from
 * triangle to triangle; the (usually tiny) flipped patch CSG leaves behind gets flipped back, and
 * if a connected piece would end up mostly flipped, the other side is the odd one out instead.
 */
const orientConsistently = (vertexCount: number, triangles: Triangles) => {
	const edgeKey = edgeKeyFor(vertexCount);
	const count = triangles.length / 3;

	const owners = new Map<number, number[]>();
	for (let triangle = 0; triangle < count; triangle++)
		for (let corner = 0; corner < 3; corner++) {
			const key = edgeKey(
				triangles[triangle * 3 + corner]!,
				triangles[triangle * 3 + ((corner + 1) % 3)]!
			);
			const list = owners.get(key);
			if (list) list.push(triangle);
			else owners.set(key, [triangle]);
		}

	const usesDirected = (triangle: number, from: number, to: number) => {
		for (let corner = 0; corner < 3; corner++)
			if (
				triangles[triangle * 3 + corner] === from &&
				triangles[triangle * 3 + ((corner + 1) % 3)] === to
			)
				return true;
		return false;
	};
	const flip = (triangle: number) => {
		const second = triangles[triangle * 3 + 1]!;
		triangles[triangle * 3 + 1] = triangles[triangle * 3 + 2]!;
		triangles[triangle * 3 + 2] = second;
	};

	const visited = new Uint8Array(count);
	for (let seed = 0; seed < count; seed++) {
		if (visited[seed]) continue;

		const component = [seed];
		const flipped = new Set<number>();
		visited[seed] = 1;
		for (let head = 0; head < component.length; head++) {
			const triangle = component[head]!;
			for (let corner = 0; corner < 3; corner++) {
				const from = triangles[triangle * 3 + corner]!;
				const to = triangles[triangle * 3 + ((corner + 1) % 3)]!;
				const sharing = owners.get(edgeKey(from, to))!;
				if (sharing.length !== 2) continue;

				const other = sharing[0] === triangle ? sharing[1]! : sharing[0]!;
				if (visited[other]) continue;
				visited[other] = 1;
				if (usesDirected(other, from, to)) {
					flip(other);
					flipped.add(other);
				}
				component.push(other);
			}
		}

		if (flipped.size * 2 > component.length) for (const triangle of component) flip(triangle);
	}
};

/** Change in bad edges (uses !== 2) when a triangle stops using an edge with `uses` users */
const badEdgeChange = (uses: number) => {
	if (uses === 1 || uses === 3) return -1;
	return uses === 2 ? 1 : 0;
};

/**
 * Deletes spurious triangles: fins and flaps whose removal strictly reduces the number of edges
 * that are not shared by exactly two triangles (open edges and edges shared by three or more).
 * With `conservative`, only triangles on an over-shared edge, or not attached to the surface by
 * any well-shared edge, qualify; the rim of a genuine hole stays for the hole filling.
 *
 * @returns Whether any triangle was removed (`triangles` is compacted in place)
 */
const removeSpuriousTriangles = (
	vertexCount: number,
	triangles: Triangles,
	conservative: boolean
): boolean => {
	const edgeKey = edgeKeyFor(vertexCount);
	const edgeUses = countEdgeUses(triangles, edgeKey);
	const count = triangles.length / 3;

	const edgesOf = (triangle: number) =>
		[0, 1, 2].map((corner) =>
			edgeKey(triangles[triangle * 3 + corner]!, triangles[triangle * 3 + ((corner + 1) % 3)]!)
		);

	const removed = new Set<number>();
	let progress = true;
	while (progress) {
		progress = false;
		for (let triangle = 0; triangle < count; triangle++) {
			if (removed.has(triangle)) continue;
			const keys = edgesOf(triangle);
			let gain = 0;
			let isOverShared = false;
			let isAttached = false;
			for (const key of keys) {
				const uses = edgeUses.get(key)!;
				gain += badEdgeChange(uses);
				if (uses > 2) isOverShared = true;
				if (uses === 2) isAttached = true;
			}
			// Conservative: a well attached triangle that only borders open edges is the rim of a hole,
			// not a remnant; removing it would just enlarge the hole
			if (gain >= 0 || (conservative && isAttached && !isOverShared)) continue;

			for (const key of keys) edgeUses.set(key, edgeUses.get(key)! - 1);
			removed.add(triangle);
			progress = true;
		}
	}
	if (removed.size === 0) return false;

	let write = 0;
	for (let triangle = 0; triangle < count; triangle++) {
		if (removed.has(triangle)) continue;
		for (let corner = 0; corner < 3; corner++)
			triangles[write * 3 + corner] = triangles[triangle * 3 + corner]!;
		write++;
	}
	triangles.length = write * 3;
	return true;
};

/** Whether triangle a-b-c has a positive area when seen along `normal` */
const facesAlong = (
	coordinates: Vertices,
	normal: [number, number, number],
	a: number,
	b: number,
	c: number
) => {
	const abx = coordinates[b * 3]! - coordinates[a * 3]!;
	const aby = coordinates[b * 3 + 1]! - coordinates[a * 3 + 1]!;
	const abz = coordinates[b * 3 + 2]! - coordinates[a * 3 + 2]!;
	const acx = coordinates[c * 3]! - coordinates[a * 3]!;
	const acy = coordinates[c * 3 + 1]! - coordinates[a * 3 + 1]!;
	const acz = coordinates[c * 3 + 2]! - coordinates[a * 3 + 2]!;
	const crossX = aby * acz - abz * acy;
	const crossY = abz * acx - abx * acz;
	const crossZ = abx * acy - aby * acx;
	return crossX * normal[0] + crossY * normal[1] + crossZ * normal[2] > 0;
};

/**
 * Closes the small planar holes CSG leaves behind when it drops the triangles of a coplanar patch.
 * The open edges are followed into loops (each vertex with exactly one outgoing open edge) and a
 * loop is filled with a triangle fan whose triangles all face the way the loop requires. Large,
 * branching, non-planar or non-fannable loops are left open rather than guessed.
 */
const fillHoles = (coordinates: Vertices, triangles: Triangles) => {
	const edgeKey = edgeKeyFor(coordinates.length / 3);
	const edgeUses = countEdgeUses(triangles, edgeKey);

	// Directed open edges, in the direction the existing triangle uses them
	const outgoing = new Map<number, number[]>();
	for (let index = 0; index < triangles.length; index += 3)
		for (let corner = 0; corner < 3; corner++) {
			const from = triangles[index + corner]!;
			const to = triangles[index + ((corner + 1) % 3)]!;
			if (edgeUses.get(edgeKey(from, to)) !== 1) continue;
			const list = outgoing.get(from);
			if (list) list.push(to);
			else outgoing.set(from, [to]);
		}

	// Shortest cycle through every open edge (BFS), so loops sharing a pinch vertex come out separately
	const vertexCount = coordinates.length / 3;
	const consumed = new Set<number>();
	const directedKey = (from: number, to: number) => from * vertexCount + to;
	const findLoop = (from: number, to: number): number[] | undefined => {
		const parent = new Map<number, number>([[to, from]]);
		let frontier = [to];
		for (let depth = 1; depth < MAX_HOLE_EDGES && frontier.length > 0; depth++) {
			const next: number[] = [];
			for (const vertex of frontier)
				for (const target of outgoing.get(vertex) ?? []) {
					if (consumed.has(directedKey(vertex, target))) continue;
					if (target === from) {
						const loop = [];
						for (let step = vertex; step !== from; step = parent.get(step)!) loop.push(step);
						return [from, ...loop.toReversed()];
					}
					if (parent.has(target)) continue;
					parent.set(target, vertex);
					next.push(target);
				}
			frontier = next;
		}
	};

	for (const [start, targets] of outgoing)
		for (const first of targets) {
			if (consumed.has(directedKey(start, first))) continue;

			const loop = findLoop(start, first);
			if (!loop || loop.length < 3) continue;

			// The patch runs against the existing triangles: reversed loop. Newell normal of that polygon.
			const polygon = loop.toReversed();
			const count = polygon.length;
			let normalX = 0;
			let normalY = 0;
			let normalZ = 0;
			let centroidX = 0;
			let centroidY = 0;
			let centroidZ = 0;
			for (const [index, id] of polygon.entries()) {
				const other = polygon[(index + 1) % count]!;
				const ax = coordinates[id * 3]!;
				const ay = coordinates[id * 3 + 1]!;
				const az = coordinates[id * 3 + 2]!;
				const bx = coordinates[other * 3]!;
				const by = coordinates[other * 3 + 1]!;
				const bz = coordinates[other * 3 + 2]!;
				normalX += (ay - by) * (az + bz);
				normalY += (az - bz) * (ax + bx);
				normalZ += (ax - bx) * (ay + by);
				centroidX += ax;
				centroidY += ay;
				centroidZ += az;
			}
			const normalLength = Math.hypot(normalX, normalY, normalZ);
			if (normalLength === 0) continue;

			const isPlanar = polygon.every((id) => {
				const distance =
					((coordinates[id * 3]! - centroidX / count) * normalX +
						(coordinates[id * 3 + 1]! - centroidY / count) * normalY +
						(coordinates[id * 3 + 2]! - centroidZ / count) * normalZ) /
					normalLength;
				return Math.abs(distance) <= MAX_HOLE_DEVIATION;
			});
			if (!isPlanar) continue;

			// Fan origin whose triangles all keep the polygon's facing (also handles concave outlines)
			for (let origin = 0; origin < count; origin++) {
				const ring = [...polygon.slice(origin), ...polygon.slice(0, origin)];
				let isValid = true;
				for (let index = 1; index + 1 < count && isValid; index++)
					isValid = facesAlong(
						coordinates,
						[normalX, normalY, normalZ],
						ring[0]!,
						ring[index]!,
						ring[index + 1]!
					);
				if (!isValid) continue;

				for (let index = 1; index + 1 < count; index++)
					triangles.push(ring[0]!, ring[index]!, ring[index + 1]!);
				for (const [index, id] of loop.entries())
					consumed.add(directedKey(id, loop[(index + 1) % loop.length]!));
				break;
			}
		}
};

/**
 * The full sequence on already welded triangles. `strict` is the careful variant (see
 * `splitTJunctions` and `removeSpuriousTriangles`); the loose one is only kept if it ends up with
 * fewer open edges.
 */
const settle = (coordinates: Vertices, triangles: Triangles, strict: boolean) => {
	const vertexCount = coordinates.length / 3;

	splitUntilStable(coordinates, triangles, strict);
	orientConsistently(vertexCount, triangles);
	if (removeSpuriousTriangles(vertexCount, triangles, strict))
		splitUntilStable(coordinates, triangles, strict);
	fillHoles(coordinates, triangles);
};

/**
 * Welds near-duplicate vertices and makes the surface watertight and consistently oriented where
 * that is possible without guessing: drops triangles that have no area, splits edges at
 * T-junctions, flips inverted patches, removes fins and closes small planar holes.
 *
 * @param vertices - Non-indexed triangle soup (9 floats per triangle)
 * @returns Repaired triangle soup with exactly shared vertex coordinates along every seam
 */
export const repairMesh = (vertices: Float32Array): Float32Array => {
	if (vertices.length === 0 || vertices.length % 9 !== 0) return vertices;

	const { coordinates, corners } = weld(vertices);
	const vertexCount = coordinates.length / 3;
	let triangles: Triangles = [];
	for (let index = 0; index < corners.length; index += 3) {
		const a = corners[index]!;
		const b = corners[index + 1]!;
		const c = corners[index + 2]!;
		if (!isDegenerate(coordinates, a, b, c)) triangles.push(a, b, c);
	}

	settle(coordinates, triangles, true);

	// Left-overs: retry with every touching vertex allowed to split an edge (bow-tie holes). It is a
	// gamble that only pays off if the result has fewer open edges.
	const open = countOpen(triangles, vertexCount);
	if (open > 0) {
		const attempt = [...triangles];
		settle(coordinates, attempt, false);
		if (countOpen(attempt, vertexCount) < open) triangles = attempt;
	}

	const result = new Float32Array(triangles.length * 3);
	for (const [index, id] of triangles.entries()) {
		result[index * 3] = coordinates[id * 3]!;
		result[index * 3 + 1] = coordinates[id * 3 + 1]!;
		result[index * 3 + 2] = coordinates[id * 3 + 2]!;
	}
	return result;
};

/**
 * Number of edges used by exactly one triangle, with vertices matched by exact coordinates the way
 * a slicer does (this is what Bambu Studio reports as "open edges").
 */
export const countOpenEdges = (vertices: Float32Array): number => {
	const ids = new Map<string, number>();
	const corners: Triangles = [];
	for (let corner = 0; corner < vertices.length / 3; corner++) {
		const key = `${vertices[corner * 3]},${vertices[corner * 3 + 1]},${vertices[corner * 3 + 2]}`;
		let id = ids.get(key);
		if (id === undefined) {
			id = ids.size;
			ids.set(key, id);
		}
		corners.push(id);
	}
	return countOpen(corners, ids.size);
};
