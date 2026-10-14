import { describe, expect, it } from 'vitest';

import { isLegOverlappingCircle, isLegOverlappingRectangle } from '$lib/3d/legOverlap';
import { suggestLegs } from '$lib/gerber/legs';
import { readFabPackage } from '$lib/gerber/package';
import { defaultToolKeys, planElements } from '$lib/gerber/plan';
import { unzipFabFiles } from '$lib/gerber/unzip';
import { rotatedHalfExtents } from '$lib/util/geometry';
import { LegData } from '$types/LegData';
import { Project } from '$types/Project';

import { DEMOS, demoUrl } from './demos';

const projectFiles = import.meta.glob<string>('../../public/demo/*.tht3d', {
	eager: true,
	import: 'default',
	query: '?raw'
});
/** Only the keys are used: they tell which files exist next to the demo projects */
const otherFiles = Object.keys({
	...import.meta.glob('../../public/demo/*.{jpg,md}', { query: '?url' }),
	...import.meta.glob('../../public/demo/licenses/*.txt', { query: '?url' }),
	...import.meta.glob('../../public/demo/*.zip', { query: '?url' })
});

const loadProject = (file: string) => {
	const raw = projectFiles[`../../public/demo/${file}`];
	if (raw === undefined) throw new Error(`Missing demo file ${file}`);
	return Project.parse(JSON.parse(raw));
};
const hasFile = (file: string) => otherFiles.includes(`../../public/demo/${file}`);

// JPEG start-of-frame markers (SOF0..SOF15), excluding DHT (196), JPG (200) and DAC (204)
const isStartOfFrame = (marker: number) =>
	marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker);

/** Pixel size of the embedded JPEG, read from its start-of-frame marker */
const jpegSize = (dataUrl: string) => {
	const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
	const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
	const view = new DataView(bytes.buffer);
	let offset = 2;
	while (offset < bytes.length) {
		const marker = bytes[offset + 1];
		if (isStartOfFrame(marker))
			return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
		offset += 2 + view.getUint16(offset + 2);
	}
	throw new Error('No JPEG frame header');
};

describe('demoUrl', () => {
	it('puts files under the demo folder of the base path', () => {
		expect(demoUrl('/pcb-tht-holder', 'a.tht3d')).toBe('/pcb-tht-holder/demo/a.tht3d');
		expect(demoUrl('', 'a.tht3d')).toBe('/demo/a.tht3d');
	});
});

describe('demo catalogue', () => {
	it('lists three demos with unique ids and files', () => {
		expect(DEMOS).toHaveLength(3);
		expect(new Set(DEMOS.map((demo) => demo.id)).size).toBe(DEMOS.length);
		const files = DEMOS.map((demo) => demo.file ?? demo.gerbers);
		expect(files.every((file) => file !== undefined)).toBe(true);
		expect(new Set(files).size).toBe(DEMOS.length);
	});

	it('ships the credits and the licence text of every board that declares a licence', () => {
		expect(hasFile('CREDITS.md')).toBe(true);
		for (const demo of DEMOS)
			if (demo.licence) expect(hasFile(`licenses/${demo.id}-LICENSE.txt`)).toBe(true);
	});

	it('has one demo that is a Gerber package and the others projects', () => {
		const fromGerbers = DEMOS.filter((demo) => demo.gerbers);
		expect(fromGerbers).toHaveLength(1);
		for (const demo of fromGerbers) {
			expect(demo.file).toBeUndefined();
			expect(hasFile(demo.gerbers!)).toBe(true);
			expect(hasFile(demo.thumbnail)).toBe(true);
		}
		for (const demo of DEMOS.filter((candidate) => !candidate.gerbers))
			expect(demo.file).toMatch(/\.tht3d$/);
	});
});

describe.each(DEMOS.filter((demo) => demo.file))('demo $id', (demo) => {
	const project = loadProject(demo.file!);
	const { width, height } = project.panelSettings;

	it('has its thumbnail', () => {
		expect(hasFile(demo.thumbnail)).toBe(true);
	});

	it('has an ASCII project name, the same label and elements', () => {
		expect(project.name).toBe(demo.title);
		expect(project.label).toBe(demo.title);
		expect(project.zoom).toBe(70);
		expect(project.name).toMatch(/^[ -~]+$/);
		expect(project.circles.length + project.rectangles.length).toBeGreaterThan(0);
		expect(project.legs.length).toBeGreaterThan(0);
	});

	it('embeds a picture whose aspect ratio matches the panel', () => {
		const generated = project.image.startsWith('data:image/svg+xml;base64,');
		if (generated) {
			// Rendered from Gerber files: the SVG declares its pixel size
			const svg = atob(project.image.slice(project.image.indexOf(',') + 1));
			const size = /width="(\d+)" height="(\d+)"/.exec(svg);
			expect(size).not.toBeNull();
			expect(Number(size![1]) / Number(size![2]) / (width / height)).toBeCloseTo(1, 1);
			return;
		}
		expect(project.image.startsWith('data:image/jpeg;base64,')).toBe(true);
		const size = jpegSize(project.image);
		expect(size.width / size.height / (width / height)).toBeCloseTo(1, 1);
		expect(size.width).toBeLessThanOrEqual(1280);
		expect(size.height).toBeLessThanOrEqual(1024);
	});

	it('keeps every element inside the panel', () => {
		for (const circle of project.circles) {
			expect(circle.x - circle.radius).toBeGreaterThanOrEqual(0);
			expect(circle.x + circle.radius).toBeLessThanOrEqual(width);
			expect(circle.y - circle.radius).toBeGreaterThanOrEqual(0);
			expect(circle.y + circle.radius).toBeLessThanOrEqual(height);
		}
		for (const rectangle of project.rectangles) {
			const half = rotatedHalfExtents(rectangle.width, rectangle.height, rectangle.rotation);
			expect(rectangle.x - half.x).toBeGreaterThanOrEqual(0);
			expect(rectangle.x + half.x).toBeLessThanOrEqual(width);
			expect(rectangle.y - half.y).toBeGreaterThanOrEqual(0);
			expect(rectangle.y + half.y).toBeLessThanOrEqual(height);
		}
		for (const leg of project.legs) {
			expect(leg.x).toBeGreaterThanOrEqual(0);
			expect(leg.x + leg.width).toBeLessThanOrEqual(width);
			expect(leg.y).toBeGreaterThanOrEqual(0);
			expect(leg.y + leg.height).toBeLessThanOrEqual(height);
		}
	});

	it('has unique element ids', () => {
		const ids = [...project.circles, ...project.rectangles, ...project.legs].map(({ id }) => id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('has no leg that the mesh generator would hide', () => {
		for (const leg of project.legs) {
			for (const circle of project.circles) expect(isLegOverlappingCircle(leg, circle)).toBe(false);
			for (const rectangle of project.rectangles)
				expect(isLegOverlappingRectangle(leg, rectangle)).toBe(false);
		}
	});

	it('has no overlapping component holes', () => {
		const boxes = project.rectangles.map((rectangle) => {
			const half = rotatedHalfExtents(rectangle.width, rectangle.height, rectangle.rotation);
			return {
				id: rectangle.id,
				left: rectangle.x - half.x,
				right: rectangle.x + half.x,
				top: rectangle.y - half.y,
				bottom: rectangle.y + half.y
			};
		});
		for (const [index, a] of boxes.entries())
			for (const b of boxes.slice(index + 1))
				expect(
					a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
					`${a.id} overlaps ${b.id}`
				).toBe(true);

		for (const [index, a] of project.circles.entries())
			for (const b of project.circles.slice(index + 1))
				expect(
					Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius,
					`${a.id} overlaps ${b.id}`
				).toBe(true);

		for (const circle of project.circles)
			for (const box of boxes) {
				const dx = Math.max(box.left - circle.x, 0, circle.x - box.right);
				const dy = Math.max(box.top - circle.y, 0, circle.y - box.bottom);
				expect(Math.hypot(dx, dy) >= circle.radius, `${circle.id} overlaps ${box.id}`).toBe(true);
			}
	});
});

describe('Gerber demo import', () => {
	const demo = DEMOS.find((candidate) => candidate.gerbers)!;

	it('imports into elements and support legs like a dropped package', async () => {
		// Binary file: read it with Node (tests run in Node; the module name is built to keep it out of the browser types)
		const nodeFs = 'node:fs';
		const { readFileSync } = (await import(/* @vite-ignore */ nodeFs)) as {
			readFileSync: (path: URL) => Uint8Array;
		};
		const bytes = readFileSync(new URL(`../../public/demo/${demo.gerbers}`, import.meta.url));
		const pkg = readFabPackage(await unzipFabFiles(new Uint8Array(bytes)));
		const plan = planElements(pkg.holes, pkg.outline, {
			toolKeys: defaultToolKeys(pkg.tools),
			groupDistance: 2.6,
			minMargin: 0.3,
			circleDepth: 5,
			rectangleDepth: 5
		});
		expect(plan.panel).toEqual({ width: 23.6, height: 16.2 });
		expect(plan.circles.length + plan.rectangles.length).toBeGreaterThan(0);
		expect(pkg.layout).toBeDefined();

		const legs = suggestLegs(plan, pkg.holes, pkg.partKeepouts ?? []);
		expect(legs.length).toBeGreaterThanOrEqual(3);
		for (const leg of legs)
			expect(
				[
					...plan.circles.map((circle) =>
						isLegOverlappingCircle(LegData.parse({ id: 'l', ...leg, width: 2, height: 2 }), circle)
					),
					...plan.rectangles.map((rectangle) =>
						isLegOverlappingRectangle(
							LegData.parse({ id: 'l', ...leg, width: 2, height: 2 }),
							rectangle
						)
					)
				].some(Boolean)
			).toBe(false);
	});
});
