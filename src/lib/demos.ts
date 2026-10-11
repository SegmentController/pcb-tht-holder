/**
 * Demo projects offered under the dropzone when no project is loaded.
 *
 * Each demo is a regular `.tht3d` project file (PCB image embedded as a data URL) served from
 * `public/demo/`, so the browser just fetches it and feeds it through the normal project loader.
 * The boards are open-source KiCad designs; credits and licence texts live in `public/demo/`
 * (`CREDITS.md`, `licenses/`).
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
	licence: string;
	/** Upstream repository of the board design */
	sourceUrl: string;
}

export const DEMOS: readonly Demo[] = [
	{
		id: 'open555',
		title: 'Open555',
		description:
			'A 555 timer built from discrete transistors: lots of round and rectangular parts.',
		size: '92.6 × 46.8 mm',
		file: 'open555.tht3d',
		thumbnail: 'open555-thumb.jpg',
		author: 'cheyao',
		licence: 'Zlib',
		sourceUrl: 'https://github.com/cheyao/Open555'
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
