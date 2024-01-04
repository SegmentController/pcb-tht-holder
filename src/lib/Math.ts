export const MathMax = (values: number[]): number => {
	if (values.length === 0) return 0;
	let result = values[0];
	for (const value of values) if (result < value) result = value;
	return result;
};
