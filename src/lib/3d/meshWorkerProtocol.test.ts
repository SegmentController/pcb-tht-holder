import { describe, expect, it } from 'vitest';

import { makeProject } from './meshTestUtilities';
import { getProjectKey } from './meshWorkerProtocol';

describe('getProjectKey', () => {
	const project = () => makeProject(1, 3, 2, 1, 'label');

	it('is equal for equal content', () => {
		expect(getProjectKey(project())).toBe(getProjectKey(project()));
	});

	it('ignores the canvas zoom, which does not influence the meshes', () => {
		expect(getProjectKey({ ...project(), zoom: 250 })).toBe(getProjectKey(project()));
	});

	it('changes with everything that does influence the meshes', () => {
		const base = getProjectKey(project());
		const moved = project();
		moved.circles[0].x += 1;
		const settings = project();
		settings.panelSettings.printTolerance = 0.2;

		expect(getProjectKey(moved)).not.toBe(base);
		expect(getProjectKey(settings)).not.toBe(base);
		expect(getProjectKey({ ...project(), label: 'other' })).not.toBe(base);
		expect(getProjectKey({ ...project(), legs: [] })).not.toBe(base);
	});
});
