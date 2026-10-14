export const MathMax = (values: ArrayLike<number>): number => {
	if (values.length === 0) return 0;
	let max = values[0]!;
	for (let index = 1; index < values.length; index++)
		if (values[index]! > max) max = values[index]!;
	return max;
};

export const MathMinMax = (value: number, min: number, max: number) =>
	Math.max(Math.min(value, max), min);
