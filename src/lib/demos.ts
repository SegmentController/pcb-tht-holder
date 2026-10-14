/**
 * Demo projects offered under the dropzone when no project is loaded.
 *
 * A demo is either a regular `.tht3d` project file (PCB image embedded as a data URL) served from
 * `public/demo/`, which the browser fetches and feeds through the normal project loader, or a Gerber
 * package (`gerbers`) that goes through the import dialog like a dropped `gerbers.zip`.
 * Most boards are open-source KiCad designs started from a photo. Credits and licence texts live in
 * `public/demo/` (`CREDITS.md`, `licenses/`).
 */
export interface Demo {
	id: string;
	title: string;
	/** One line about what the board teaches (parts that end up as holes) */
	description: string;
	/** Board size in mm, as shown on the card */
	size: string;
	/** Project file name inside `public/demo/` (not for Gerber demos) */
	file?: string;
	/** Small preview image inside `public/demo/` */
	thumbnail: string;
	author: string;
	/** Licence of the design; its text is in `licenses/<id>-LICENSE.txt` */
	licence?: string;
	/** Upstream repository of the board design */
	sourceUrl?: string;
	/** Gerber demo: the package inside `public/demo/`, imported with the dialog (and offered for download) */
	gerbers?: string;
}

export const DEMOS: readonly Demo[] = [
	{
		id: 'ne555-gerbers',
		title: 'NE555 from Gerbers',
		description:
			'Imports a gerbers.zip instead of a photo: exact board size, copper and silkscreen picture, header and support legs placed automatically.',
		size: '23.6 × 16.2 mm',
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
