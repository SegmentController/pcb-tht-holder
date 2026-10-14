import type { FabFile } from './types';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;

/**
 * Extracts the text files of a zipped fabrication package (the zip is untrusted input, so the
 * declared uncompressed sizes are limited before anything is inflated).
 * `fflate` is loaded on demand and ends up in its own chunk.
 */
export const unzipFabFiles = async (data: Uint8Array): Promise<FabFile[]> => {
	const { strFromU8, unzipSync } = await import('fflate');

	let total = 0;
	const entries = unzipSync(data, {
		filter: ({ name, originalSize }) => {
			if (
				name.endsWith('/') ||
				name.startsWith('__MACOSX') ||
				name.split('/').pop()?.startsWith('.')
			)
				return false;
			if (originalSize > MAX_FILE_BYTES || total + originalSize > MAX_TOTAL_BYTES) return false;
			total += originalSize;
			return true;
		}
	});

	return Object.entries(entries).map(([name, bytes]) => ({
		name: name.split('/').pop() ?? name,
		text: strFromU8(bytes)
	}));
};
