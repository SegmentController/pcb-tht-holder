import { BoxGeometry, CylinderGeometry, Vector3 } from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

import { MathMax, MathMinMax } from '$lib/Math';
import type { MeshDimensionInfo, MeshInfoTuple } from '$types/MeshInfo';
import type { RenderableProject } from '$types/Project';
import { switchType } from '$types/switchType';

const BOTTOM_THICKNESS = 2;
const EDGE_THICKNESS = 2;
const TEXT_THICKNESS = 1;
const ROUND_CORRECTION = 1;
/*global __BASE_URL__*/
const BASE_URL = __BASE_URL__;

type TextGeometryData = {
	geometry: TextGeometry;
	size: {
		w: number;
		h: number;
	};
};

class MeshGenerator {
	private CYLINDER = (radius: number, height: number) =>
		new CylinderGeometry(radius, radius, height, MathMinMax(radius * 8, 16, 48));

	private BOX = (width: number, height: number, depth: number) =>
		new BoxGeometry(width, height, depth);

	private TEXT = (
		font: Font,
		text: string,
		boundary: { x: number; y: number }
	): TextGeometryData | undefined => {
		let size = 20;
		while (size) {
			const gText = new TextGeometry(text, {
				font,
				size,
				height: TEXT_THICKNESS,
				curveSegments: 4,
				steps: 1,
				bevelEnabled: false
			});
			gText.computeBoundingBox();
			if (gText.boundingBox) {
				const measuredSize = gText.boundingBox.getSize(new Vector3());
				if (measuredSize.x < boundary.x && measuredSize.y < boundary.y)
					return {
						geometry: gText,
						size: {
							w: measuredSize.x,
							h: measuredSize.y
						}
					};
			}
			size--;
		}
	};

	private MESH = (geometry: BoxGeometry | CylinderGeometry | TextGeometry) => {
		const result = new Brush(geometry.translate(0, 0, 0));

		switchType(geometry)
			.case(BoxGeometry, (geometry) => (result.position.z = geometry.parameters.depth / 2))
			.case(CylinderGeometry, (geometry) => {
				result.position.z = geometry.parameters.height / 2;
				result.rotateX(Math.PI / 2);
			})
			.case(TextGeometry, () => {
				result.position.z = 0;
				result.rotateX(Math.PI / 2);
			});

		result.updateMatrixWorld();

		return result;
	};

	private evaluator = new Evaluator();
	private mesh: Brush = this.MESH(this.BOX(0, 0, 0));
	private meshCoverage: Brush = this.MESH(this.BOX(0, 0, 0));
	private meshDimension: MeshDimensionInfo = { width: 0, height: 0, depth: 0 };
	private meshCoverageDimension: MeshDimensionInfo = { width: 0, height: 0, depth: 0 };

	private jobs: (() => void)[] = [];

	constructor(
		private project: RenderableProject,
		private font: Font
	) {}

	public generateJobs = (): void => {
		this.jobs = [];

		// Constant helper values
		const panel = this.project.panelSettings;
		const emptyHeight = panel.pcbThickness + panel.smdHeight;
		const componentHeigh = MathMax([
			panel.smdHeight,
			...this.project.rectangles.map((r) => r.depth),
			...this.project.circles.map((c) => c.depth)
		]);
		const needHeight = panel.pcbThickness + componentHeigh;

		const coverageHeight = panel.pcbThickness + panel.smdHeight;

		// Lets create mesh+meshCoverage...
		this.mesh = this.MESH(
			this.BOX(
				panel.width + 2 * EDGE_THICKNESS,
				panel.height + 2 * EDGE_THICKNESS,
				needHeight + BOTTOM_THICKNESS
			)
		);
		this.mesh.updateMatrixWorld();
		this.meshCoverage = this.MESH(
			this.BOX(
				panel.width + 2 * EDGE_THICKNESS,
				panel.height + 2 * EDGE_THICKNESS,
				coverageHeight + BOTTOM_THICKNESS
			)
		);
		this.meshCoverage.position.z += needHeight - coverageHeight;
		this.meshCoverage.updateMatrixWorld();

		// Go operations
		const emptySpace = this.MESH(
			this.BOX(panel.width, panel.height, emptyHeight + ROUND_CORRECTION)
		);
		{
			emptySpace.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
			emptySpace.updateMatrixWorld();
			this.jobs.push(
				() => (this.mesh = this.evaluator.evaluate(this.mesh, emptySpace, SUBTRACTION)),
				() =>
					(this.meshCoverage = this.evaluator.evaluate(this.meshCoverage, emptySpace, SUBTRACTION))
			);
		}
		const remover = this.MESH(
			this.BOX(panel.width / 3, panel.height / 3, emptyHeight + ROUND_CORRECTION)
		);
		{
			remover.position.z += BOTTOM_THICKNESS + needHeight - emptyHeight;
			remover.updateMatrixWorld();

			const deltas = [
				{ dx: panel.width / 2, dy: 0 },
				{ dx: -panel.width / 2, dy: 0 },
				{ dx: 0, dy: panel.height / 2 },
				{ dx: 0, dy: -panel.height / 2 }
			];
			for (const delta of deltas) {
				remover.position.x += delta.dx;
				remover.position.y += delta.dy;
				try {
					remover.updateMatrixWorld();
					this.jobs.push(
						() => (this.mesh = this.evaluator.evaluate(this.mesh, remover, SUBTRACTION)),
						() =>
							(this.meshCoverage = this.evaluator.evaluate(this.meshCoverage, remover, SUBTRACTION))
					);
				} finally {
					remover.position.x -= delta.dx;
					remover.position.y -= delta.dy;
				}
			}
		}
		for (const rectangle of this.project.rectangles) {
			const box = this.MESH(
				this.BOX(rectangle.width, rectangle.height, rectangle.depth + ROUND_CORRECTION)
			);
			box.position.x += rectangle.x + rectangle.width / 2 - panel.width / 2;
			box.position.y -= rectangle.y + rectangle.height / 2 - panel.height / 2;
			box.position.z += BOTTOM_THICKNESS + (componentHeigh - rectangle.depth);
			box.updateMatrixWorld();
			this.jobs.push(
				() => (this.mesh = this.evaluator.evaluate(this.mesh, box, SUBTRACTION)),
				() => (this.meshCoverage = this.evaluator.evaluate(this.meshCoverage, box, SUBTRACTION))
			);
		}
		for (const circle of this.project.circles) {
			const cylinder = this.MESH(this.CYLINDER(circle.radius, circle.depth + ROUND_CORRECTION));
			cylinder.position.x += circle.x - panel.width / 2;
			cylinder.position.y -= circle.y - panel.height / 2;
			cylinder.position.z += BOTTOM_THICKNESS + (componentHeigh - circle.depth);
			cylinder.updateMatrixWorld();
			this.jobs.push(
				() => (this.mesh = this.evaluator.evaluate(this.mesh, cylinder, SUBTRACTION)),
				() =>
					(this.meshCoverage = this.evaluator.evaluate(this.meshCoverage, cylinder, SUBTRACTION))
			);
		}
		for (const leg of this.project.legs) {
			const box = this.MESH(this.BOX(leg.width, leg.height, panel.smdHeight));
			box.position.x += leg.x + leg.width / 2 - panel.width / 2;
			box.position.y -= leg.y + leg.height / 2 - panel.height / 2;
			box.position.z += BOTTOM_THICKNESS + (componentHeigh - panel.smdHeight);
			box.updateMatrixWorld();
			this.jobs.push(
				() => (this.mesh = this.evaluator.evaluate(this.mesh, box, ADDITION)),
				() => (this.meshCoverage = this.evaluator.evaluate(this.meshCoverage, box, ADDITION))
			);
		}
		if (this.project.label) {
			const textGeometryInfo = this.TEXT(this.font, this.project.label, {
				x: (panel.width + 2 * EDGE_THICKNESS) * 0.75,
				y: (needHeight + BOTTOM_THICKNESS - emptyHeight) * 0.75
			});
			if (textGeometryInfo) {
				const text = this.MESH(textGeometryInfo.geometry);
				{
					text.position.x -= textGeometryInfo.size.w / 2;
					text.position.y -= panel.height / 2 + EDGE_THICKNESS - TEXT_THICKNESS / 2;
					text.position.z += (needHeight + BOTTOM_THICKNESS - textGeometryInfo.size.h) / 2;
					text.updateMatrixWorld();
				}
				this.jobs.push(() => (this.mesh = this.evaluator.evaluate(this.mesh, text, ADDITION)));
			}
		}

		this.meshDimension = {
			width: panel.width + 2 * EDGE_THICKNESS,
			height: panel.height + 2 * EDGE_THICKNESS,
			depth: needHeight + BOTTOM_THICKNESS
		};
		this.meshCoverageDimension = {
			width: panel.width + 2 * EDGE_THICKNESS,
			height: panel.height + 2 * EDGE_THICKNESS,
			depth: coverageHeight + BOTTOM_THICKNESS
		};
	};

	public runAllJobs = (): void => {
		for (const job of this.jobs) job();
	};

	public runNextJob = (): boolean => {
		const first = this.jobs.shift();
		first && first();
		return this.jobs.length > 0;
	};

	public getMesh = (): MeshInfoTuple => ({
		main: {
			vertexArray: new Float32Array(this.mesh.geometry.attributes['position'].array),
			dimensions: this.meshDimension
		},
		coverage: {
			vertexArray: new Float32Array(this.meshCoverage.geometry.attributes['position'].array),
			dimensions: this.meshCoverageDimension
		}
	});
}

export const generateMeshLazy = async (project: RenderableProject): Promise<MeshInfoTuple> =>
	new Promise((resolve, reject) =>
		new FontLoader().load(BASE_URL + '/roboto_regular.json', (font: Font) => {
			try {
				const generator = new MeshGenerator(project, font);
				generator.generateJobs();
				const initRepeater = () => {
					setTimeout(() => {
						if (generator.runNextJob()) initRepeater();
						else resolve(generator.getMesh());
					}, 10);
				};
				initRepeater();
			} catch (error) {
				reject(error instanceof Error ? error.message : error);
			}
		})
	);
