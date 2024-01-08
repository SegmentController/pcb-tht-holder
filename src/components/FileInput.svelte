<script lang="ts">
	export let accept: string = '';
	export const selectTextFile = (onSelect: (filename: string, data: string) => void) => {
		fileInput.value = '';
		_onSelect = onSelect;
		fileInput.click();
	};

	let _onSelect: (filename: string, data: string) => void;
	let fileInput: HTMLInputElement;
	const importLibrary = async (event: Event) => {
		if (!_onSelect) return;
		const files = (event.target as HTMLInputElement).files;
		if (files && files.length > 0) {
			try {
				const textData = await files[0].text();
				_onSelect(files[0].name, textData);
			} catch (error) {
				error;
			}
		}
	};
</script>

<input type="file" id="textFile" {accept} bind:this={fileInput} on:change={importLibrary} />

<style>
	input {
		display: none;
	}
</style>
