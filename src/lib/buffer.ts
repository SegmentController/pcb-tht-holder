export const writeInt16LE = (buffer: Uint8Array, value: number, offset: number) => {
	const view = new DataView(buffer.buffer);
	view.setInt16(offset, value, true);
	return offset + 2;
};

export const writeInt32LE = (buffer: Uint8Array, value: number, offset: number) => {
	const view = new DataView(buffer.buffer);
	view.setInt32(offset, value, true);
	return offset + 4;
};

export const writeFloatLE = (buffer: Uint8Array, value: number, offset: number) => {
	const view = new DataView(buffer.buffer);
	view.setFloat32(offset, value, true);
	return offset + 4;
};
