import { describe, expect, it } from 'vitest';

import { formatFileTimestamp, formatMm } from './format';

describe('formatFileTimestamp', () => {
	it('formats local date and time with zero padding', () => {
		expect(formatFileTimestamp(new Date(2026, 0, 5, 7, 8, 9))).toBe('20260105-070809');
	});

	it('uses the current time by default', () => {
		expect(formatFileTimestamp()).toMatch(/^\d{8}-\d{6}$/);
	});
});

describe('formatMm', () => {
	it('removes floating point noise', () => {
		expect(formatMm(96.199_999_999_999_99)).toBe('96.2');
		expect(formatMm(72.199_999_999_999_99)).toBe('72.2');
	});

	it('keeps at most two decimals and no trailing zeros', () => {
		expect(formatMm(15.6)).toBe('15.6');
		expect(formatMm(50)).toBe('50');
		expect(formatMm(12.346)).toBe('12.35');
	});
});
