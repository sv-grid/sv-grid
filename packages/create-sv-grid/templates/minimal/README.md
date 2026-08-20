# SvGrid app

A minimal [Vite](https://vite.dev) + [Svelte 5](https://svelte.dev) app wired
to [SvGrid](https://svgrid.com), the Svelte 5 data grid and data table.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Open `src/App.svelte` and edit the `rows` / `columns` to use your own data.

## Theme

`src/app.css` imports one of the 20 presets that ship with `@svgrid/grid`.
Swap the id to re-theme the grid and the page around it together:

```css
@import '@svgrid/grid/themes/nord.css';
```

Pick from `ember`, `shadcn`, `tailwind`, `material`, `fluent`, `carbon`,
`antd`, `bootstrap`, `atlassian`, `salesforce`, `sap`, `github`, `linear`,
`notion`, `vercel`, `excel`, `nord`, `dracula`, `catppuccin`, `ag-alpine`.

Every preset carries a light and a dark palette. Dark hangs off
`<html data-theme="dark">`, which the toggle in the header writes and
`index.html` restores before the first paint. To drop the presets and write
your own `--sg-*` values instead, see
[Theme and density](https://svgrid.com/docs/getting-started/5-theme-and-density).

## Next steps

- Add more features: `rowExpandingFeature`, `columnGroupingFeature`, pagination, pinned rows. See the [docs](https://svgrid.com/docs/).
- Browse [370+ live demos](https://svgrid.com/demos/) for copy-paste recipes.
- Need Excel/PDF export, import, print, or pivot tables? Add [`@svgrid/enterprise`](https://svgrid.com/pricing/).
- Want a full app shell with routing? Scaffold the admin starter instead:
  `npm create @svgrid@latest my-admin -- --template admin-dashboard`

## Working with an AI assistant

Point it at the SvGrid MCP server so it writes against the real API instead of
guessing:

```bash
claude mcp add svgrid -- npx -y @svgrid/mcp
```

Built with [SvGrid](https://svgrid.com). SvGrid(TM) is a trademark of
jQWidgets Ltd. This template is MIT-licensed.
