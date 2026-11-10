// The base reads /api/base from the browser.
// On the layout, not the page: with only the root page off, SvelteKit (2.70) answers an
// unknown URL with a 500 ("Missing +page.svelte component for route null") instead of a 404.
export const ssr = false
