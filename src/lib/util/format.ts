const pad = (value: number) => String(value).padStart(2, '0');

/** Local date and time as `YYYYMMDD-HHmmss`, for use in file names */
export const formatFileTimestamp = (date = new Date()) =>
	`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
	`${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

/** Millimetres for display: at most two decimals, no trailing zeros (floating point noise like 96.19999999999999 becomes 96.2) */
export const formatMm = (value: number) => String(Number(value.toFixed(2)));
