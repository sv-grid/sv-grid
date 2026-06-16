# SvGrid app

A minimal [Vite](https://vite.dev) + [Svelte 5](https://svelte.dev) app wired
to [SvGrid](https://www.svgrid.com), the Svelte data grid.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Open `src/App.svelte` and edit the `rows` / `columns` to use your own data.

## Next steps

- Add more features: `rowExpandingFeature`, `columnGroupingFeature`, pagination, pinned rows. See the [docs](https://www.svgrid.com/docs).
- Need Excel/PDF export, import, print, pivot, or AI helpers? Add [`@svgrid/enterprise`](https://www.svgrid.com/pricing).
- Want a full app shell with routing? Scaffold the admin starter instead:
  `npm create sv-grid@latest my-admin -- --template admin-dashboard`

SvGrid(TM) is a trademark of jQWidgets Ltd. This template is MIT-licensed.
