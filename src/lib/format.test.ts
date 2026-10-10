import { describe, expect, it } from 'vitest';

import { formatFileTimestamp } from './format';

describe('formatFileTimestamp', () => {
	it('formats local date and time with zero padding', () => {
		expect(formatFileTimestamp(new Date(2026, 0, 5, 7, 8, 9))).toBe('20260105-070809');
	});

	it('uses the current time by default', () => {
		expect(formatFileTimestamp()).toMatch(/^\d{8}-\d{6}$/);
	});
});
