export const MathMax = (values: number[]): number => {
	return values.length === 0 ? 0 : Math.max(...values);
};

export const MathMinMax = (value: number, min: number, max: number) =>
	Math.max(Math.min(value, max), min);
