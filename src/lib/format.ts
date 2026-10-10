const pad = (value: number) => String(value).padStart(2, '0');

/** Local date and time as `YYYYMMDD-HHmmss`, for use in file names */
export const formatFileTimestamp = (date = new Date()) =>
	`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
	`${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
