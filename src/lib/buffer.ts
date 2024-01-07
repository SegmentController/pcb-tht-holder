import ieee754 from 'ieee754';

export const writeInt16LE = (buffer: Uint8Array, value: number, offset: number) => {
	value = +value;
	offset = offset >>> 0;

	buffer[offset] = value & 0xff;
	buffer[offset + 1] = value >>> 8;

	return offset + 2;
};

export const writeInt32LE = (buffer: Uint8Array, value: number, offset: number) => {
	value = +value;
	offset = offset >>> 0;

	buffer[offset] = value & 0xff;
	buffer[offset + 1] = value >>> 8;
	buffer[offset + 2] = value >>> 16;
	buffer[offset + 3] = value >>> 24;

	return offset + 4;
};

export const writeFloatLE = (buffer: Uint8Array, value: number, offset: number) => {
	value = +value;
	offset = offset >>> 0;

	ieee754.write(buffer, value, offset, true, 23, 4);

	return offset + 4;
};
