/** Deterministic project generator and mesh metrics shared by mesh tests */
import type { RenderableProject } from '$types/Project';

// Deterministic pseudo random numbers so projects are reproducible
const random = (seed: number) => () =>
	(seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296) / 4_294_967_296;

export const makeProject = (
	seed: number,
	circleCount: number,
	rectangleCount: number,
	legCount: number,
	label: string,
	printTolerance = 0
): RenderableProject => {
	const next = random(seed);
	const width = 120;
	const height = 90;
	return {
		panelSettings: { width, height, pcbThickness: 1.6, smdHeight: 3, printTolerance },
		zoom: 100,
		label,
		circles: Array.from({ length: circleCount }, (_, index) => ({
			id: `c${index}`,
			x: 10 + next() * (width - 20),
			y: 10 + next() * (height - 20),
			radius: 2 + next() * 4,
			depth: 4 + Math.floor(next() * 8)
		})) as RenderableProject['circles'],
		rectangles: Array.from({ length: rectangleCount }, (_, index) => ({
			id: `r${index}`,
			x: 15 + next() * (width - 30),
			y: 15 + next() * (height - 30),
			width: 4 + next() * 12,
			height: 3 + next() * 8,
			depth: 4 + Math.floor(next() * 8),
			rotation: [0, 0, 30, 45, 90][Math.floor(next() * 5)]!
		})) as RenderableProject['rectangles'],
		legs: Array.from({ length: legCount }, (_, index) => ({
			id: `l${index}`,
			x: 2 + next() * (width - 10),
			y: 2 + next() * (height - 10),
			width: 3 + next() * 3,
			height: 3 + next() * 3
		})) as RenderableProject['legs']
	};
};

export const analyzeVertices = (vertices: Float32Array) => {
	let volume = 0;
	const min = [Infinity, Infinity, Infinity];
	const max = [-Infinity, -Infinity, -Infinity];
	for (let t = 0; t < vertices.length; t += 9) {
		const [ax, ay, az, bx, by, bz, cx, cy, cz] = [
			vertices[t]!,
			vertices[t + 1]!,
			vertices[t + 2]!,
			vertices[t + 3]!,
			vertices[t + 4]!,
			vertices[t + 5]!,
			vertices[t + 6]!,
			vertices[t + 7]!,
			vertices[t + 8]!
		];
		volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
		for (let k = 0; k < 3; k++)
			for (const value of [vertices[t + k]!, vertices[t + 3 + k]!, vertices[t + 6 + k]!]) {
				min[k] = Math.min(min[k]!, value);
				max[k] = Math.max(max[k]!, value);
			}
	}
	return { volume, min, max, size: max.map((value, k) => value - min[k]!) };
};
