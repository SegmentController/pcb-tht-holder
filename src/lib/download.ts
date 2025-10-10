export const virtualDownload = (filename: string, data: string | Uint8Array) => {
	const a = document.createElement('a');
	const url = URL.createObjectURL(new Blob([data]));
	try {
		document.body.append(a);
		a.download = filename;
		a.href = url;
		a.click();
	} finally {
		URL.revokeObjectURL(url);
		a.remove();
	}
};
