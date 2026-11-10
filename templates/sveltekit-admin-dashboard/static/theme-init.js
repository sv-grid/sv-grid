// Settle the theme before the first paint. A file of its own, not a script in app.html:
// SvelteKit's CSP hashes cover only what it renders, so a strict policy blocks that one.
try {
  var t = localStorage.getItem('theme')
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark')
} catch (e) {}
