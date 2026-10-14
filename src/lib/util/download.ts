export const virtualDownload = (filename: string, data: string | Uint8Array) => {
	const a = document.createElement('a');
	let blobUrl: string | undefined;
	try {
		document.body.append(a);
		a.download = filename;
		blobUrl = URL.createObjectURL(new Blob([data as BlobPart]));
		a.href = blobUrl;
		a.click();
	} finally {
		a.remove();
		// Revoke blob URL to prevent memory leak
		if (blobUrl) {
			// Delay revocation slightly to ensure download completes
			const urlToRevoke = blobUrl;
			setTimeout(() => URL.revokeObjectURL(urlToRevoke), 100);
		}
	}
};
