import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { virtualDownload } from './download';

describe('virtualDownload', () => {
	const anchor = { download: '', href: '', click: vi.fn(), remove: vi.fn() };
	const append = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
		anchor.download = '';
		anchor.href = '';
		vi.stubGlobal('document', { createElement: vi.fn(() => anchor), body: { append } });
		vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('clicks a temporary link to the data under the given name', () => {
		virtualDownload('holder.stl', new Uint8Array([1, 2, 3]));

		expect(append).toHaveBeenCalledWith(anchor);
		expect(anchor).toMatchObject({ download: 'holder.stl', href: 'blob:fake' });
		expect(anchor.click).toHaveBeenCalledOnce();
		expect(anchor.remove).toHaveBeenCalledOnce();
		const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob];
		expect(blob.size).toBe(3);
	});

	it('accepts text data', () => {
		virtualDownload('project.tht3d', '{"name":"x"}');

		const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob];
		expect(blob.size).toBe(12);
	});

	it('revokes the object URL only after the download had time to start', () => {
		virtualDownload('a.stl', 'x');

		expect(URL.revokeObjectURL).not.toHaveBeenCalled();
		vi.advanceTimersByTime(100);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
	});

	it('cleans up the link even when the click fails', () => {
		anchor.click.mockImplementationOnce(() => {
			throw new Error('blocked');
		});

		expect(() => virtualDownload('a.stl', 'x')).toThrow('blocked');

		expect(anchor.remove).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(100);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
	});
});
