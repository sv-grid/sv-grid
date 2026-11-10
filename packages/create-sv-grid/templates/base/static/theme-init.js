// Settle the theme before the first paint. Without this the server-rendered HTML
// shows one palette and the picker in +layout.svelte swaps it a frame later. With
// nothing saved yet we follow the OS. A file of its own, not a script in app.html:
// SvelteKit's CSP hashes cover only what it renders, so a strict policy blocks that one.
try {
	var saved = JSON.parse(localStorage.getItem('svgrid-theme') || 'null')
	var fallback = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
	document.documentElement.dataset.theme = (saved && saved.mode) || fallback
} catch (e) {}
