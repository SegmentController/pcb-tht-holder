import { afterEach, describe, expect, it } from 'vitest';

import { CircleData } from '$types/CircleData';
import { LegData } from '$types/LegData';
import { Project } from '$types/Project';
import { RectangleData } from '$types/RectangleData';

import {
	getProjectStoreLegCount,
	getProjectStoreValue,
	projectJsonSerializer,
	setProjectStoreValue
} from './projectStore';

const sampleProject = (): Project =>
	Project.parse({
		name: 'Sample',
		image: 'data:image/png;base64,AAAA',
		label: 'v1',
		zoom: 150,
		panelSettings: { width: 80, height: 60, pcbThickness: 1.6, smdHeight: 4, printTolerance: 0.2 },
		circles: [CircleData.parse({ id: 'c1', x: 10, y: 10, radius: 2.5, depth: 11 })],
		rectangles: [
			RectangleData.parse({ id: 'r1', x: 30, y: 20, width: 8, height: 4, depth: 6, rotation: 45 })
		],
		legs: [LegData.parse({ id: 'l1', x: 1, y: 1, width: 2, height: 2 })]
	});

describe('projectJsonSerializer.parse', () => {
	it('round-trips a project through stringify and parse', () => {
		const project = sampleProject();

		const restored = projectJsonSerializer.parse(projectJsonSerializer.stringify(project));

		expect(restored).toEqual(project);
	});

	it('falls back to the default empty project on invalid JSON', () => {
		expect(projectJsonSerializer.parse('not json')).toMatchObject({
			name: '',
			image: '',
			zoom: 100,
			panelSettings: {
				width: 100,
				height: 100,
				pcbThickness: 1.6,
				smdHeight: 3,
				printTolerance: 0
			},
			circles: [],
			rectangles: [],
			legs: []
		});
	});

	it('falls back to the empty project when the shape is invalid', () => {
		expect(projectJsonSerializer.parse('{"name":"x"}')).toMatchObject({ name: '', circles: [] });
	});

	it('falls back to the empty project when any element field is invalid', () => {
		const project = JSON.parse(projectJsonSerializer.stringify(sampleProject()));
		project.rectangles[0].rotation = 360;

		const parsed = projectJsonSerializer.parse(JSON.stringify(project));

		expect(parsed.name).toBe('');
		expect(parsed.rectangles).toEqual([]);
	});

	it('returns an independent copy of the empty project each time', () => {
		const first = projectJsonSerializer.parse('garbage');
		first.circles.push(CircleData.parse({ id: 'x', x: 0, y: 0, radius: 1, depth: 1 }));

		expect(projectJsonSerializer.parse('garbage').circles).toEqual([]);
	});
});

describe('projectJsonSerializer.stringify', () => {
	it('omits Konva rendering properties at every depth', () => {
		const text = projectJsonSerializer.stringify(sampleProject());

		expect(text).not.toMatch(/"(fill|draggable|opacity)"/);
		expect(JSON.parse(text).circles[0]).toEqual({ id: 'c1', x: 10, y: 10, radius: 2.5, depth: 11 });
	});

	it('pretty-prints with two-space indentation', () => {
		expect(projectJsonSerializer.stringify(sampleProject())).toContain('\n  "name": "Sample"');
	});

	it('keeps the image and panel settings', () => {
		const parsed = JSON.parse(projectJsonSerializer.stringify(sampleProject()));

		expect(parsed.image).toBe('data:image/png;base64,AAAA');
		expect(parsed.panelSettings.printTolerance).toBe(0.2);
	});
});

describe('project store helpers', () => {
	const original = getProjectStoreValue();

	afterEach(() => {
		setProjectStoreValue(original);
	});

	it('counts legs from the current project', () => {
		setProjectStoreValue(sampleProject());

		expect(getProjectStoreLegCount()).toBe(1);
	});

	it('returns what was set', () => {
		const project = sampleProject();

		setProjectStoreValue(project);

		expect(getProjectStoreValue()).toBe(project);
	});
});
