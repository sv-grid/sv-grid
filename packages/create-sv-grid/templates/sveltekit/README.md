# SvGrid + SvelteKit sample

A grid whose rows are loaded on the server, sorted from the URL, and edited
through a form action - the three things that are different about running a grid
in SvelteKit rather than a plain Vite SPA.

```bash
npm install
npm run dev     # http://localhost:5173/people
```

## What to try

1. **Click the `Year` header.** The URL becomes `?sort=year&dir=asc`. Copy that
   link into a new tab - it opens already sorted, because the server did it.
2. **Double-click a name, change it, press Enter, then reload.** The edit went
   through the form action in `+page.server.ts` and survived.
3. **Switch the theme** with the picker in the header. All 20 built-in presets,
   light and dark, applied live.
4. **`curl localhost:5173/people`.** The rows are in the HTML, not injected by
   JS afterwards. That is what a crawler sees.

## Where things are

| File | Does |
| --- | --- |
| `src/lib/people.ts` | Stands in for your database. Swap for real queries. |
| `src/routes/people/+page.server.ts` | `load` sorts from the query string; the `rename` action takes the edit. |
| `src/routes/people/+page.svelte` | The grid. `externalSort` because the server owns the ordering. |
| `src/lib/theme.svelte.ts` | Runtime theme switching via `resolveThemeTokens`. |
| `src/app.css` | Imports one preset so the first paint is themed before JS runs. |

## Themes

Pick a starting theme when you scaffold:

```bash
npm create @svgrid@latest my-app -- --template sveltekit --theme dracula --dark
```

Or change it at runtime with the header picker. The picker writes the preset's
`--sg-*` custom properties onto `<html>`; nothing rebuilds.

Full guide: https://svgrid.com/docs/getting-started/sveltekit/
