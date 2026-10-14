/**
 * Demo projects offered under the dropzone when no project is loaded.
 *
 * Each demo is a regular `.tht3d` project file (PCB image embedded as a data URL) served from
 * `public/demo/`, so the browser just fetches it and feeds it through the normal project loader.
 * Most boards are open-source KiCad designs started from a photo; one is started straight from Gerber
 * files (`gerbers` is its package, which can be dropped on the dropzone to try the import). Credits and
 * licence texts live in `public/demo/` (`CREDITS.md`, `licenses/`).
 */
export interface Demo {
	id: string;
	title: string;
	/** One line about what the board teaches (parts that end up as holes) */
	description: string;
	/** Board size in mm, as shown on the card */
	size: string;
	/** Project file name inside `public/demo/` */
	file: string;
	/** Small preview image inside `public/demo/` */
	thumbnail: string;
	author: string;
	/** Licence of the design; its text is in `licenses/<id>-LICENSE.txt` */
	licence?: string;
	/** Upstream repository of the board design */
	sourceUrl?: string;
	/** Demo started straight from Gerber files: the package inside `public/demo/` */
	gerbers?: string;
}

export const DEMOS: readonly Demo[] = [
	{
		id: 'ne555-gerbers',
		title: 'NE555 from Gerbers',
		description:
			'Started from a gerbers.zip instead of a photo: exact board size, copper and silkscreen picture, header hole placed automatically.',
		size: '23.6 × 16.2 mm',
		file: 'ne555.tht3d',
		thumbnail: 'ne555-thumb.jpg',
		author: 'the project author (tscircuit example)',
		gerbers: 'ne555-gerbers.zip'
	},
	{
		id: 'servo-controller-555',
		title: 'Servo Controller 555',
		description: 'DIP-8 chip, terminal block, trimmer, LED and axial parts, plus mounting holes.',
		size: '60 × 50 mm',
		file: 'servo-controller-555.tht3d',
		thumbnail: 'servo-controller-555-thumb.jpg',
		author: 'Shlok Chorge',
		licence: 'CERN-OHL-S-2.0',
		sourceUrl: 'https://github.com/shlok-ac/Servo-Controller-555'
	},
	{
		id: 'arduino-icsp-shield',
		title: 'Arduino ICSP Shield',
		description: 'Arduino Uno shield with LEDs and pin headers, mixed with SMD parts.',
		size: '53.3 × 68.6 mm',
		file: 'arduino-icsp-shield.tht3d',
		thumbnail: 'arduino-icsp-shield-thumb.jpg',
		author: 'mprosk',
		licence: 'MIT',
		sourceUrl: 'https://github.com/mprosk/arduino_icsp_shield'
	}
];

/** URL of a file in `public/demo/`; `base` is the build-time base path without trailing slash */
export const demoUrl = (base: string, file: string) => `${base}/demo/${file}`;
