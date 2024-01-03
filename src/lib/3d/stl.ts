export type Vertex = [number, number, number];
export type Poligon = Vertex[];
export type Face = Vertex[];

const SOLID_NAME = 'THT-holder';

const poligonToFaces = (poligon: Poligon): Face[] => {
	if (poligon.length < 3) throw new Error(`Poligon error, ${poligon.length} points`);
	if (poligon.length == 3) return [poligon];
	return [
		[poligon[0], poligon[1], poligon[2]],
		...poligonToFaces([poligon[0], ...poligon.slice(2)])
	];
};

export const generateStl = (poligons: Poligon[]): string[] => {
	const faces: Face[] = [];
	for (const poligon of poligons) faces.push(...poligonToFaces(poligon));

	const lines: string[] = [];
	lines.push(`solid ${SOLID_NAME}`);
	for (const face of faces) {
		lines.push('facet normal 0 0 0', '    outer loop');
		for (let index = 0; index < 3; index++)
			lines.push(`        vertex ${face[index][0]} ${face[index][1]} ${face[index][2]}`);
		lines.push('    endloop', 'endfacet');
	}
	lines.push(`endsolid ${SOLID_NAME}`);

	return lines;
};
