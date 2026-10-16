import { describe, expect, it } from 'vitest';

import { copperTop, maskTop, silkTop } from './fixtures';
import { KEEP_NONE, plotLayer } from './plotter';
import { resolveColors } from './types';

const header = '%FSLAX24Y24*%\n%MOMM*%\nG75*\n';
const plot = (text: string) => {
	const result = plotLayer(text, 'x');
	return { ...result, objects: resolveColors(result.objects), defs: resolveColors(result.defs) };
};

describe('plotLayer: sample layers', () => {
	it('flashes every pad of the copper layer with its aperture', () => {
		const { defs, objects, warnings, records } = plot(copperTop);
		expect(warnings).toEqual([]);
		expect(defs).toContain(
			'<g id="x12"><path fill-rule="evenodd" d="M-0.75 -0.75h1.5v1.5h-1.5Z"/></g>'
		);
		expect(defs).toContain('<g id="x13"><circle r="0.75"/></g>');
		// consecutive flashes of one polarity share a group
		expect(objects).toContain('<use href="#x12" x="-6.35" y="-1.27"/>');
		expect(objects).toContain('<use href="#x13" x="-6.35" y="1.27"/>');
		expect(objects.startsWith('<g fill="#fff"><use href="#x12"')).toBe(true);
		expect(objects.match(/<use /g)).toHaveLength(35);
		expect(records.filter((record) => record.type === 'flash')).toHaveLength(35);
	});

	it('reads the file attributes', () => {
		const result = plotLayer(copperTop, 'x');
		expect(result.attributes.FileFunction).toEqual(['Copper', 'L1', 'Top']);
		expect(result.polarity).toBe('Positive');
		expect(plotLayer(maskTop, 'x').polarity).toBe('Negative');
	});

	it('plots mask openings and silkscreen strokes', () => {
		expect(plot(maskTop).objects.match(/<use /g)?.length).toBe(28);
		const silk = plot(silkTop);
		expect(silk.objects).toContain('<path d="M');
		expect(silk.objects).toContain('stroke-linecap="round"');
	});
});

describe('plotLayer: apertures', () => {
	it('expands aperture macros (ROUNDRECT) into polygons and circles', () => {
		const text = `${header}%AMROUNDRECT*0 comment $1*4,1,4,$2,$3,$4,$5,$6,$7,$8,$9,$2,$3,0*1,1,$1+$1,$2,$3*%
%ADD10ROUNDRECT,0.1X-1X-0.5X1X-0.5X1X0.5X-1X0.5*%
D10*
X0Y0D03*
M02*`;
		const { defs, objects, warnings } = plot(text);
		expect(warnings).toEqual([]);
		expect(defs).toContain('<polygon points="-1,-0.5 1,-0.5 1,0.5 -1,0.5 -1,-0.5"/>');
		expect(defs).toContain('<circle cx="-1" cy="-0.5" r="0.1"/>');
		expect(objects).toContain('<use href="#x10"');
	});

	it('keeps holes of standard apertures as holes in the shape (they do not clear anything)', () => {
		const text = `${header}%ADD10C,1X0.4*%
%ADD11R,2X1X0.5*%
D10*
X0Y0D03*
D11*
X10000Y0D03*
M02*`;
		const { defs } = plot(text);
		expect(defs).toContain(
			'd="M-0.5 0a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0ZM-0.2 0a0.2 0.2 0 1 0 0.4 0a0.2 0.2 0 1 0 -0.4 0Z"'
		);
		expect(defs).toContain('M-1 -0.5h2v1h-2Z');
	});

	it('cuts exposure-off primitives out of the macro with a mask', () => {
		const text = `${header}%AMDONUT*1,1,$1,0,0*1,0,$2,0,0*%
%ADD10DONUT,2X1*%
D10*
X0Y0D03*
M02*`;
		const { defs, objects } = plot(text);
		expect(defs).toContain('<mask id="x10k"');
		expect(defs).toContain('<g fill="#000"><circle cx="0" cy="0" r="0.5"/></g>');
		expect(defs).toContain('mask="url(#x10k)"');
		expect(objects).toContain('<use href="#x10"');
	});

	it('draws the thermal and moire primitives without failing', () => {
		const text = `${header}%AMTH*7,0,0,2,1.5,0.2,0*%
%AMMO*6,0,0,5,0.5,0.5,2,0.1,6,0*%
%ADD10TH*%
%ADD11MO*%
D10*
X0Y0D03*
D11*
X10000Y0D03*
M02*`;
		const { defs, warnings } = plot(text);
		expect(warnings).toEqual([]);
		// four thermal pieces and two moire crosshair bars
		expect(defs.match(/<polygon/g)?.length).toBe(6);
		expect(defs).toContain('fill-rule="evenodd"');
	});

	it('supports polygons, obrounds and the deprecated lower-left and vector line primitives', () => {
		const text = `${header}%AMOLD*22,1,2,1,-1,-0.5,0*2,1,0.2,0,0,1,1,0*%
%ADD10P,2X6X30*%
%ADD11O,3X1*%
%ADD12OLD*%
D10*
X0Y0D03*
D11*
X1000Y0D03*
D12*
X2000Y0D03*
M02*`;
		const { defs, warnings } = plot(text);
		expect(warnings).toEqual([]);
		expect(defs).toContain('<g id="x10">');
		expect(defs).toContain('A0.5 0.5 0 0 1');
		expect(defs).toContain('<polygon points="-1,-0.5 1,-0.5 1,0.5 -1,0.5"/>');
	});
});

describe('plotLayer: plotting', () => {
	it('draws strokes with arcs and joins consecutive segments in one path', () => {
		const text = `${header}%ADD10C,0.5*%
D10*
G01*
X0Y0D02*
X100000Y0D01*
G03*
X150000Y50000I0J50000D01*
M02*`;
		const { objects, records } = plot(text);
		expect(objects).toBe(
			'<path d="M0 0L10 0A5 5 0 0 1 15 5" fill="none" stroke="#fff" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"/>'
		);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ type: 'draw', width: 0.5 });
		const last = (records[0] as { points: { x: number; y: number }[] }).points.at(-1);
		expect(last).toEqual({ x: 15, y: 5 });
	});

	it('uses the clockwise sweep flag for G02 and splits full circles', () => {
		const clockwise = `${header}%ADD10C,0.2*%
D10*
X100000Y0D02*
G02*
X0Y0I-50000J0D01*
M02*`;
		expect(plot(clockwise).objects).toContain('A5 5 0 0 0 0 0');
		const circle = `${header}%ADD10C,0.2*%
D10*
X100000Y0D02*
G03*
X100000Y0I-50000J0D01*
M02*`;
		expect(plot(circle).objects).toContain('A5 5 0 0 1 0 0A5 5 0 0 1 10 0');
	});

	it('picks the centre of single quadrant arcs (G74) from the unsigned offsets', () => {
		const text = `%FSLAX24Y24*%
%MOMM*%
%ADD10C,0.1*%
G74*
D10*
X110000Y60000D02*
G03*
X70000Y100000I40000J0D01*
M02*`;
		const { records } = plot(text);
		// quarter arc, radius 4, centre (7, 6): ends at (7, 10)
		const points = (records[0] as { points: { x: number; y: number }[] }).points;
		expect(points.at(-1)).toEqual({ x: 7, y: 10 });
		const mid = points[Math.floor(points.length / 2)];
		expect(Math.hypot(mid.x - 7, mid.y - 6)).toBeCloseTo(4, 3);
	});

	it('fills regions and keeps clear polarity as black objects', () => {
		const text = `${header}%ADD10C,0.1*%
%LPD*%
G36*
X0Y0D02*
G01*
X100000Y0D01*
X100000Y100000D01*
X0Y100000D01*
X0Y0D01*
G37*
%LPC*%
D10*
X50000Y50000D03*
M02*`;
		const { objects, records } = plot(text);
		expect(objects).toContain('<path d="M0 0L10 0L10 10L0 10L0 0Z" fill="#fff"/>');
		expect(objects).toContain('<g fill="#000"><use href="#x10" x="5" y="5"/></g>');
		// clear objects are not part of the data
		expect(records.map((record) => record.type)).toEqual(['region']);
	});

	it('converts inches and reports unsupported content without throwing', () => {
		const text = `%FSLAX24Y24*%
%MOIN*%
%ADD10C,0.1*%
D10*
X10000Y0D03*
M02*`;
		const { defs, objects } = plot(text);
		expect(defs).toContain('r="1.27"');
		expect(objects).toContain('x="25.4"');
		expect(() => plotLayer('\u0000%%**garbage', 'x')).not.toThrow();
		expect(() => plotLayer('', 'x')).not.toThrow();
	});
});

describe('plotLayer: transformations, blocks and repeats', () => {
	it('applies mirroring, rotation and scaling to flashes', () => {
		const text = `${header}%ADD10R,2X1*%
D10*
%LMX*%
%LR90*%
%LS2*%
X10000Y10000D03*
%LMN*%
%LR0*%
%LS1*%
X20000Y0D03*
M02*`;
		const { objects, records } = plot(text);
		expect(objects).toContain('transform="translate(1 1) rotate(90) scale(-2 2)"');
		expect(objects).toContain('x="2" y="0"');
		expect(records[0]).toMatchObject({ type: 'flash', width: 4, height: 2 });
	});

	it('replays block apertures at every flash, toggling polarity when flashed clear', () => {
		const text = `${header}%ADD10C,1*%
%ABD12*%
D10*
X0Y0D03*
%AB*%
D12*
X100000Y0D03*
%LPC*%
X200000Y0D03*
%LPD*%
M02*`;
		const { defs, objects, records } = plot(text);
		expect(defs).toContain('<g id="xb12"><g fill="#fff"><use href="#x10" x="0" y="0"/></g></g>');
		// the clear flash uses a copy with dark and clear swapped
		expect(defs).toContain('<g id="xb12t"><g fill="#000"><use href="#x10" x="0" y="0"/></g></g>');
		expect(objects).toContain('<use href="#xb12" x="10" y="0"/>');
		expect(objects).toContain('<use href="#xb12t" x="20" y="0"/>');
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ type: 'flash', x: 10, y: 0 });
	});

	it('repeats step and repeat blocks on a grid', () => {
		const text = `${header}%ADD10C,1*%
%SRX2Y3I5.0J4.0*%
D10*
X0Y0D03*
%SR*%
M02*`;
		const { objects, records } = plot(text);
		expect(objects.match(/<use href="#xs0"/g)).toHaveLength(6);
		expect(records).toHaveLength(6);
		const xs = records.map((record) => (record as { x: number }).x);
		expect(new Set(xs)).toEqual(new Set([0, 5]));
	});

	it('treats SR X1Y1 as a harmless header and closes an unterminated repeat at the end', () => {
		const text = `${header}%SRX1Y1I0J0*%
%ADD10C,1*%
D10*
X0Y0D03*
%SRX2Y1I3J0*%
X0Y0D03*
M02*`;
		const { records } = plot(text);
		expect(records).toHaveLength(3);
	});
});

describe('plotLayer: legacy and deprecated syntax', () => {
	it('accepts G54, G70, G90, modal D01 and style variations', () => {
		const text = `%FSLAX24Y24*%
%ADD10C,0.01*%
G70*
G90*
G54D10*
G1X0Y0D2*
X10000Y0D1*
X10000Y10000*
g01x0y0d03*
M02*`;
		const { records } = plot(text);
		const draw = records[0] as { points: { x: number; y: number }[] };
		expect(draw.points).toEqual([
			{ x: 0, y: 0 },
			{ x: 25.4, y: 0 },
			{ x: 25.4, y: 25.4 }
		]);
	});

	it('reads trailing zero omission, incremental notation and decimal coordinates', () => {
		const trailing = `%FSTAX24Y24*%\n%MOMM*%\n%ADD10C,1*%\nD10*\nX1Y25D03*\nM02*`;
		expect(plot(trailing).records[0]).toMatchObject({ x: 10, y: 25 });
		const incremental = `%FSLIX24Y24*%\n%MOMM*%\n%ADD10C,1*%\nD10*\nX10000Y10000D03*\nX10000Y0D03*\nM02*`;
		expect(plot(incremental).records.map((record) => (record as { x: number }).x)).toEqual([1, 2]);
		const decimal = `%FSLAX24Y24*%\n%MOMM*%\n%ADD10C,1*%\nD10*\nX1.5Y-2.25D03*\nM02*`;
		expect(plot(decimal).records[0]).toMatchObject({ x: 1.5, y: -2.25 });
	});

	it('stops at M02 and ignores data after it', () => {
		const text = `${header}%ADD10C,1*%\nD10*\nX0Y0D03*\nM02*\nX10000Y0D03*\n`;
		expect(plot(text).records).toHaveLength(1);
	});

	it('applies IPNEG as a complemented image and the deprecated image transformations', () => {
		const negative = plotLayer(`${header}%IPNEG*%\n%ADD10C,1*%\nD10*\nX0Y0D03*\nM02*`, 'x');
		expect(negative.complement).toBe(true);
		const mirrored = `%FSLAX24Y24*%\n%MOMM*%\n%MIA1B0*%\n%OFA2B0*%\n%ADD10C,1*%\nD10*\nX30000Y10000D03*\nM02*`;
		// mirrored x: -3, then offset +2
		expect(plot(mirrored).records[0]).toMatchObject({ x: -1, y: 1 });
	});

	it('limits the number of objects of a malicious file', () => {
		const text = `${header}%ADD10C,1*%\n%SRX1000Y1000I1J1*%\nD10*\nX0Y0D03*\n%SR*%\nM02*`;
		const result = plotLayer(text, 'x');
		expect(result.warnings.join(',')).toContain('Too many objects');
		expect(result.records.length).toBeLessThan(1_000_000);
	});
});

describe('plotLayer: options', () => {
	const text = `${header}%ADD10C,1*%\n%ADD11R,2X1*%\nD10*\nX10000Y10000D02*\nX30000Y10000D01*\nD11*\nX50000Y20000D03*\nM02*`;

	it('keeps only the records the caller asks for, and still measures all of them', () => {
		const all = plotLayer(text, 'x');
		const flashes = plotLayer(text, 'x', { keep: (record) => record.type === 'flash' });
		const none = plotLayer(text, 'x', { keep: KEEP_NONE });

		expect(all.records.map((record) => record.type)).toEqual(['draw', 'flash']);
		expect(flashes.records.map((record) => record.type)).toEqual(['flash']);
		expect(none.records).toEqual([]);
		for (const result of [flashes, none])
			// Strokes count by their points, flashes by their aperture size (as the copper-extent fallback did)
			expect(result.extent).toEqual({ minX: 1, minY: 1, maxX: 6, maxY: 2.5 });
		expect(none.objects).toBe(all.objects);
	});

	it('leaves the markup out when asked, keeping records and extent', () => {
		const result = plotLayer(text, 'x', { svg: false });
		expect(result.objects).toBe('');
		expect(result.defs).toBe('');
		expect(result.records).toHaveLength(2);
		expect(result.extent).toEqual(plotLayer(text, 'x').extent);
	});

	it('has no extent without objects', () => {
		expect(plotLayer(header, 'x').extent).toBeUndefined();
	});

	it('copies large step and repeat groups without spreading them into push', () => {
		const flashes = 'X0Y0D03*\n'.repeat(120_000);
		const result = plotLayer(
			`${header}%ADD10C,1*%\nD10*\n%SRX2Y1I10J0*%\n${flashes}%SR*%\nM02*`,
			'x'
		);
		expect(result.warnings.join(',')).not.toContain('stopped');
		expect(result.records).toHaveLength(240_000);
		expect(result.records.at(-1)).toMatchObject({ type: 'flash', x: 10 });
	});
});
