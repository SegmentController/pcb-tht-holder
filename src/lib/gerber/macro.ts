/** Evaluates a macro arithmetic expression: numbers, `$n`, `+ - x / ( )` (Gerber spec 4.5.4) */
export const evaluate = (expression: string, variables: ReadonlyMap<number, number>) => {
	const tokens = expression.match(/\$\d+|\d+\.?\d*|\.\d+|[()+/Xx-]/g) ?? [];
	let position = 0;

	const parseFactor = (): number => {
		const token = tokens[position++];
		if (token === undefined) return 0;
		if (token === '(') {
			const value = parseExpression();
			position++;
			return value;
		}
		if (token === '-') return -parseFactor();
		if (token === '+') return parseFactor();
		if (token.startsWith('$')) return variables.get(Number(token.slice(1))) ?? 0;
		return Number(token);
	};
	const parseTerm = (): number => {
		let value = parseFactor();
		while (['x', 'X', '/'].includes(tokens[position])) {
			const operator = tokens[position++];
			const right = parseFactor();
			value = operator === '/' ? value / right : value * right;
		}
		return value;
	};
	const parseExpression = (): number => {
		let value = parseTerm();
		while (['+', '-'].includes(tokens[position])) {
			const operator = tokens[position++];
			const right = parseTerm();
			value = operator === '+' ? value + right : value - right;
		}
		return value;
	};

	const value = parseExpression();
	return Number.isFinite(value) ? value : 0;
};

const number = (value: number) => String(Math.round(value * 1e4) / 1e4);

type Pair = readonly [number, number];

export const polygonSvg = (points: readonly Pair[]) =>
	`<polygon points="${points.map(([x, y]) => `${number(x)},${number(y)}`).join(' ')}"/>`;

export const rectangleSvg = (left: number, bottom: number, right: number, top: number) =>
	polygonSvg([
		[left, bottom],
		[right, bottom],
		[right, top],
		[left, top]
	]);

/** Vertices of a regular polygon, first vertex at `rotation` degrees counterclockwise from +X */
export const regularPolygonPoints = (
	vertices: number,
	diameter: number,
	rotation: number,
	centerX = 0,
	centerY = 0
): Pair[] => {
	const count = Math.max(3, Math.round(vertices));
	return Array.from({ length: count }, (_, index) => {
		const angle = ((rotation + (360 * index) / count) * Math.PI) / 180;
		return [
			centerX + (diameter / 2) * Math.cos(angle),
			centerY + (diameter / 2) * Math.sin(angle)
		] as const;
	});
};

/** SVG path data of a circle (two arcs), centred anywhere */
export const circlePath = (cx: number, cy: number, radius: number) =>
	`M${number(cx - radius)} ${number(cy)}a${number(radius)} ${number(radius)} 0 1 0 ${number(2 * radius)} 0a${number(radius)} ${number(radius)} 0 1 0 ${number(-2 * radius)} 0Z`;

export interface MacroShape {
	/** Exposure on adds to the aperture, exposure off cuts a hole in what was drawn before */
	exposure: boolean;
	/** Geometry markup without fill, around the macro origin */
	svg: string;
}

export interface CompiledMacro {
	shapes: MacroShape[];
	/** Largest distance of any point from the origin: bounds of the aperture */
	extent: number;
}

const rotated = (svg: string, rotation: number) =>
	rotation ? `<g transform="rotate(${number(rotation)})">${svg}</g>` : svg;

/**
 * Expands the primitives of an aperture macro (`AM`) with the parameters of an `AD` call.
 * Supports codes 0, 1, 4, 5, 7, 20, 21 and the deprecated 2, 6 and 22.
 */
export const compileMacro = (
	lines: readonly string[],
	parameters: readonly number[],
	warnings: Set<string>
): CompiledMacro => {
	const variables = new Map(parameters.map((value, index) => [index + 1, value] as const));
	const shapes: MacroShape[] = [];
	let extent = 0;

	const reach = (x: number, y: number, extra = 0) => {
		extent = Math.max(extent, Math.hypot(x, y) + extra);
	};
	const add = (exposure: boolean, svg: string) => shapes.push({ exposure, svg });

	for (const line of lines) {
		if (/^0(\s|$)/.test(line)) continue;
		const assignment = /^\$(\d+)\s*=(.*)$/.exec(line);
		if (assignment) {
			variables.set(Number(assignment[1]), evaluate(assignment[2], variables));
			continue;
		}

		const [code, ...rest] = line.split(',');
		const primitive = Number(code.trim());
		const a = rest.map((expression) => evaluate(expression, variables));
		if (a.length === 0 || !Number.isFinite(primitive)) continue;
		const on = a[0] !== 0;

		switch (primitive) {
			case 1: {
				// exposure, diameter, centre x, centre y, [rotation]
				reach(a[2], a[3], a[1] / 2);
				add(
					on,
					rotated(
						`<circle cx="${number(a[2])}" cy="${number(a[3])}" r="${number(a[1] / 2)}"/>`,
						a[4] ?? 0
					)
				);
				break;
			}
			case 2:
			case 20: {
				// exposure, width, start x, start y, end x, end y, [rotation]
				const length = Math.hypot(a[4] - a[2], a[5] - a[3]) || 1;
				const nx = (-(a[5] - a[3]) / length) * (a[1] / 2);
				const ny = ((a[4] - a[2]) / length) * (a[1] / 2);
				const corners: Pair[] = [
					[a[2] + nx, a[3] + ny],
					[a[4] + nx, a[5] + ny],
					[a[4] - nx, a[5] - ny],
					[a[2] - nx, a[3] - ny]
				];
				for (const [x, y] of corners) reach(x, y);
				add(on, rotated(polygonSvg(corners), a[6] ?? 0));
				break;
			}
			case 21: {
				// exposure, width, height, centre x, centre y, [rotation]
				const [, width, height, cx, cy] = a;
				reach(Math.abs(cx) + width / 2, Math.abs(cy) + height / 2);
				add(
					on,
					rotated(
						rectangleSvg(cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2),
						a[5] ?? 0
					)
				);
				break;
			}
			case 22: {
				// exposure, width, height, lower left x, lower left y, [rotation]
				const [, width, height, x, y] = a;
				reach(
					Math.max(Math.abs(x), Math.abs(x + width)),
					Math.max(Math.abs(y), Math.abs(y + height))
				);
				add(on, rotated(rectangleSvg(x, y, x + width, y + height), a[5] ?? 0));
				break;
			}
			case 4: {
				// exposure, number of points after the start, x0, y0, ..., xn, yn, [rotation]
				const count = Math.round(a[1]) + 1;
				const points = Array.from(
					{ length: count },
					(_, index) => [a[2 + index * 2] ?? 0, a[3 + index * 2] ?? 0] as const
				);
				for (const [x, y] of points) reach(x, y);
				add(on, rotated(polygonSvg(points), a[2 + count * 2] ?? 0));
				break;
			}
			case 5: {
				// exposure, vertices, centre x, centre y, diameter, [rotation]
				reach(a[2], a[3], a[4] / 2);
				add(on, polygonSvg(regularPolygonPoints(a[1], a[4], a[5] ?? 0, a[2], a[3])));
				break;
			}
			case 6: {
				// moire: centre x, y, outer diameter, ring thickness, gap, max rings, crosshair thickness, length, [rotation]
				const [cx, cy, outer, thickness, gap, maxRings, crossThickness, crossLength] = a;
				const rotation = a[8] ?? 0;
				reach(cx, cy, Math.max(outer / 2, crossLength / 2));
				let diameter = outer;
				const parts: string[] = [];
				for (let ring = 0; ring < Math.max(0, Math.round(maxRings)) && diameter > 0; ring++) {
					const inner = diameter - 2 * thickness;
					parts.push(
						inner > 0
							? `<path fill-rule="evenodd" d="${circlePath(cx, cy, diameter / 2)}${circlePath(cx, cy, inner / 2)}"/>`
							: `<circle cx="${number(cx)}" cy="${number(cy)}" r="${number(diameter / 2)}"/>`
					);
					diameter = inner - 2 * gap;
				}
				if (crossThickness > 0 && crossLength > 0)
					parts.push(
						rectangleSvg(
							cx - crossLength / 2,
							cy - crossThickness / 2,
							cx + crossLength / 2,
							cy + crossThickness / 2
						),
						rectangleSvg(
							cx - crossThickness / 2,
							cy - crossLength / 2,
							cx + crossThickness / 2,
							cy + crossLength / 2
						)
					);
				add(true, rotated(parts.join(''), rotation));
				break;
			}
			case 7: {
				// thermal (always exposed): centre x, y, outer diameter, inner diameter, gap, [rotation]
				const [cx, cy, outer, inner, gap] = a;
				const rotation = a[5] ?? 0;
				reach(cx, cy, outer / 2);
				const half = gap / 2;
				const outerRadius = outer / 2;
				const innerRadius = inner / 2;
				if (outerRadius > half) {
					const arc = (radius: number, from: number, to: number, steps = 12) =>
						Array.from({ length: steps + 1 }, (_, index) => {
							const angle = from + ((to - from) * index) / steps;
							return [radius * Math.cos(angle), radius * Math.sin(angle)] as const;
						});
					const outerStart = Math.asin(Math.min(1, half / outerRadius));
					const quadrant: Pair[] = arc(outerRadius, outerStart, Math.PI / 2 - outerStart);
					if (innerRadius > half * Math.SQRT2) {
						const innerStart = Math.asin(Math.min(1, half / innerRadius));
						quadrant.push(...arc(innerRadius, Math.PI / 2 - innerStart, innerStart));
					} else quadrant.push([half, half]);
					const pieces = [0, 90, 180, 270].map(
						(turn) => `<g transform="rotate(${turn})">${polygonSvg(quadrant)}</g>`
					);
					add(
						true,
						rotated(
							`<g transform="translate(${number(cx)} ${number(cy)})">${pieces.join('')}</g>`,
							rotation
						)
					);
				}
				break;
			}
			default: {
				warnings.add(`Aperture macro primitive ${primitive} is not supported`);
			}
		}
	}
	return { shapes, extent };
};
