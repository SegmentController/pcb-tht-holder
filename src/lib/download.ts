export const virtualDownload = (filename: string, data: string | Uint8Array) => {
	const a = document.createElement('a');
	try {
		document.body.append(a);
		a.download = filename;
		a.href = URL.createObjectURL(new Blob([data]));
		a.click();
	} finally {
		a.remove();
	}
};
