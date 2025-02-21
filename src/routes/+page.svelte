<script>
	let g = 'pictext';
		$: localStorage.setItem('filename', g);
	let loading = false;

	async function downloadData() {
		loading = true;
		const formData = new FormData();

		const files = document.getElementById('files').files;
		if (!files) {
			alert('no files selected');
			return;
		}
		for (let i = 0; i < files.length; i++) {
			formData.append('files', files[i]);
		}

		const response = await fetch(`/t`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			console.error('Network response was not ok');
			loading = false;
			return;
		}

		const blob = await response.blob();
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${g}.txt`;
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
		loading = false;
	}
</script>

<div class="bg-gray-900 p-4 text-white shadow-lg">
	<input type="text" bind:value={g} class="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
	<input type="file" id="files" multiple />
	<button
		on:click={downloadData}
		class="mt-4 rounded-lg bg-purple-600 px-4 py-2 font-bold text-white hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:outline-none"
		disabled={loading}
	>
		{#if loading}
			Loading...
		{:else}
			Download
		{/if}
	</button>
</div>
```
