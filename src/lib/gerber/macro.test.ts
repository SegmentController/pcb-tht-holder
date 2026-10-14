import { describe, expect, it } from 'vitest';

import { circlePath, compileMacro, evaluate, regularPolygonPoints } from './macro';

const variables = (...values: number[]) =>
	new Map(values.map((value, index) => [index + 1, value] as const));

describe('evaluate', () => {
	it('reads numbers in every spelling', () => {
		expect(evaluate('3', variables())).toBe(3);
		expect(evaluate('0.25', variables())).toBe(0.25);
		expect(evaluate('.5', variables())).toBe(0.5);
		expect(evaluate('2.', variables())).toBe(2);
	});

	it('multiplies and divides before it adds and subtracts (spec 4.5.4)', () => {
		expect(evaluate('2+3x4', variables())).toBe(14);
		expect(evaluate('10-6/2', variables())).toBe(7);
		expect(evaluate('(2+3)x4', variables())).toBe(20);
		expect(evaluate('2x(3+4)x2', variables())).toBe(28);
	});

	it('accepts the multiplication sign in both cases', () => {
		expect(evaluate('3X4', variables())).toBe(12);
		expect(evaluate('3x4', variables())).toBe(12);
	});

	it('is left associative', () => {
		expect(evaluate('10-3-2', variables())).toBe(5);
		expect(evaluate('8/2/2', variables())).toBe(2);
	});

	it('handles unary signs', () => {
		expect(evaluate('-3', variables())).toBe(-3);
		expect(evaluate('+3', variables())).toBe(3);
		expect(evaluate('--3', variables())).toBe(3);
		expect(evaluate('2x-3', variables())).toBe(-6);
		expect(evaluate('-(1+2)', variables())).toBe(-3);
	});

	it('substitutes variables, unknown ones are zero', () => {
		expect(evaluate('$1x2+$2', variables(1.5, 4))).toBe(7);
		expect(evaluate('$3', variables(1))).toBe(0);
		expect(evaluate('$10+1', new Map([[10, 4]]))).toBe(5);
	});

	it('never returns a non-finite number', () => {
		expect(evaluate('1/0', variables())).toBe(0);
		expect(evaluate('0/0', variables())).toBe(0);
		expect(evaluate('', variables())).toBe(0);
		expect(evaluate('   ', variables())).toBe(0);
	});
});

describe('regularPolygonPoints', () => {
	it('places the first vertex at the rotation angle on the circumscribed circle', () => {
		const points = regularPolygonPoints(4, 2, 0);
		expect(points).toHaveLength(4);
		const expected = [
			[1, 0],
			[0, 1],
			[-1, 0],
			[0, -1]
		];
		for (const [index, [x, y]] of expected.entries()) {
			expect(points[index][0]).toBeCloseTo(x, 9);
			expect(points[index][1]).toBeCloseTo(y, 9);
		}
	});

	it('rotates counterclockwise and moves to the centre', () => {
		const [first] = regularPolygonPoints(3, 4, 90, 10, 20);
		expect(first[0]).toBeCloseTo(10, 9);
		expect(first[1]).toBeCloseTo(22, 9);
	});

	it('never produces fewer than three vertices and rounds fractional counts', () => {
		expect(regularPolygonPoints(1, 2, 0)).toHaveLength(3);
		expect(regularPolygonPoints(0, 2, 0)).toHaveLength(3);
		expect(regularPolygonPoints(5.4, 2, 0)).toHaveLength(5);
	});
});

describe('circlePath', () => {
	it('draws a circle as two arcs starting on the left', () => {
		expect(circlePath(0, 0, 1)).toBe('M-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z');
		expect(circlePath(5, 2, 0.5)).toBe('M4.5 2a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0Z');
	});
});

describe('compileMacro', () => {
	const compile = (lines: string[], parameters: number[] = []) => {
		const warnings = new Set<string>();
		return { ...compileMacro(lines, parameters, warnings), warnings: [...warnings] };
	};

	it('substitutes the parameters of the aperture definition', () => {
		const { shapes, extent } = compile(['1,1,$1,0,0'], [2]);
		expect(shapes).toEqual([{ exposure: true, svg: '<circle cx="0" cy="0" r="1"/>' }]);
		expect(extent).toBe(1);
	});

	it('reaches the far side of an off-centre circle', () => {
		expect(compile(['1,1,2,3,4'], []).extent).toBe(6);
	});

	it('reads exposure off as a cutout', () => {
		const { shapes } = compile(['1,1,4,0,0', '1,0,2,0,0']);
		expect(shapes.map((shape) => shape.exposure)).toEqual([true, false]);
	});

	it('wraps rotated primitives and leaves unrotated ones bare', () => {
		const [rotated] = compile(['1,1,2,3,0,90']).shapes;
		expect(rotated.svg).toBe('<g transform="rotate(90)"><circle cx="3" cy="0" r="1"/></g>');
		const [bare] = compile(['1,1,2,3,0,0']).shapes;
		expect(bare.svg).not.toContain('<g');
	});

	it('skips comments and applies variable assignments in order', () => {
		const { shapes } = compile(['0 a comment', '0', '$2=$1x2', '$3=$2+1', '1,1,$3,0,0'], [1]);
		expect(shapes).toHaveLength(1);
		expect(shapes[0].svg).toBe('<circle cx="0" cy="0" r="1.5"/>');
	});

	it('expands the vector line (code 20) around its centre line', () => {
		const { shapes, extent } = compile(['20,1,0.2,0,0,2,0,0']);
		expect(shapes[0].svg).toBe('<polygon points="0,0.1 2,0.1 2,-0.1 0,-0.1"/>');
		expect(extent).toBeCloseTo(Math.hypot(2, 0.1), 9);
	});

	it('expands the centre rectangle (code 21)', () => {
		const { shapes, extent } = compile(['21,1,4,2,0,0,0']);
		expect(shapes[0].svg).toBe('<polygon points="-2,-1 2,-1 2,1 -2,1"/>');
		expect(extent).toBeCloseTo(Math.hypot(2, 1), 9);
	});

	it('expands the lower-left rectangle (code 22) and the deprecated vector line (code 2)', () => {
		expect(compile(['22,1,2,1,-1,-0.5,0']).shapes[0].svg).toBe(
			'<polygon points="-1,-0.5 1,-0.5 1,0.5 -1,0.5"/>'
		);
		expect(compile(['2,1,0.2,0,0,2,0,0']).shapes[0].svg).toBe(
			compile(['20,1,0.2,0,0,2,0,0']).shapes[0].svg
		);
	});

	it('expands an outline with the rotation after the last point (code 4)', () => {
		const { shapes, extent } = compile(['4,1,3,0,0,1,0,0,1,0,0,0']);
		expect(shapes[0].svg).toBe('<polygon points="0,0 1,0 0,1 0,0"/>');
		expect(extent).toBe(1);
	});

	it('expands a regular polygon (code 5)', () => {
		const { shapes, extent } = compile(['5,1,6,0,0,4,0']);
		expect(shapes[0].svg.match(/,/g)).toHaveLength(6);
		expect(extent).toBe(2);
	});

	it('expands the moire into rings and a crosshair, always exposed (code 6)', () => {
		const { shapes, extent } = compile(['6,0,0,5,0.5,0.5,2,0.1,6,0']);
		expect(shapes).toHaveLength(1);
		expect(shapes[0].exposure).toBe(true);
		expect(shapes[0].svg.match(/<path fill-rule="evenodd"/g)).toHaveLength(2);
		expect(shapes[0].svg.match(/<polygon/g)).toHaveLength(2);
		expect(extent).toBe(3);
	});

	it('stops the moire at the maximum number of rings and when the diameter runs out', () => {
		const rings = (maxRings: number) =>
			compile([`6,0,0,5,0.5,0.5,${maxRings},0,0,0`]).shapes[0].svg.match(/<path|<circle/g)
				?.length ?? 0;
		expect(rings(1)).toBe(1);
		expect(rings(0)).toBe(0);
		// 5 mm outer diameter fits three rings of 0.5 mm with 0.5 mm gaps (5, 3, 1), then it is used up
		expect(rings(10)).toBe(3);
	});

	it('draws the last ring of a moire filled when no inner diameter is left', () => {
		const { shapes } = compile(['6,0,0,1,0.6,0.5,1,0,0,0']);
		expect(shapes[0].svg).toContain('<circle');
		expect(shapes[0].svg).not.toContain('<path');
	});

	it('expands the thermal into four pieces (code 7)', () => {
		const { shapes, extent } = compile(['7,0,0,2,1.5,0.2,0']);
		expect(shapes).toHaveLength(1);
		expect(shapes[0].exposure).toBe(true);
		expect(shapes[0].svg.match(/<polygon/g)).toHaveLength(4);
		expect(extent).toBe(1);
	});

	it('closes a thermal whose inner circle is hidden by the gap with a single corner', () => {
		const { shapes } = compile(['7,0,0,2,0.5,0.4,0']);
		const polygon = /points="([^"]+)"/.exec(shapes[0].svg)![1];
		expect(polygon.endsWith('0.2,0.2')).toBe(true);
	});

	it('draws no thermal when the gap swallows the outer circle', () => {
		expect(compile(['7,0,0,0.2,0.1,0.5,0']).shapes).toEqual([]);
	});

	it('warns once per unsupported primitive and keeps compiling', () => {
		const { shapes, warnings } = compile(['3,1,1,2', '3,1,1,2', '1,1,2,0,0']);
		expect(warnings).toEqual(['Aperture macro primitive 3 is not supported']);
		expect(shapes).toHaveLength(1);
	});

	it('ignores lines without a primitive number or parameters', () => {
		const { shapes, warnings } = compile(['', 'abc,1,2', '1']);
		expect(shapes).toEqual([]);
		expect(warnings).toEqual([]);
	});
});
