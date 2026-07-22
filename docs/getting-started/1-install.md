# 1. Install

> Step 1 of 6 · [Next: First grid →](./2-first-grid.md)

SvGrid is a single npm package. There is no peer dependency on a CSS
framework - bring your own, or use the default theme that ships with
the render component.

![Two install paths side by side: scaffold a ready-wired project with npm create @svgrid@latest, or add the @svgrid/grid package manually and import SvGrid into your markup.](/docs-media/gs-install.svg)

## Fastest start: scaffold a project

Starting fresh? Skip the manual wiring and scaffold a project with the
grid already set up:

```bash
npm create @svgrid@latest                                   # interactive
npm create @svgrid@latest my-admin -- --template admin-dashboard
```

See [Starters & scaffolding](./starters.md) for the templates (minimal
Vite app or a full SvelteKit admin dashboard) and the Deploy-to-Vercel
flow. To add SvGrid to an **existing** app, install it directly:

```bash
# pnpm (recommended)
pnpm add @svgrid/grid

# npm
npm install @svgrid/grid

# yarn
yarn add @svgrid/grid
```

## Requirements

| Tool        | Version           | Why                                   |
| ----------- | ----------------- | ------------------------------------- |
| Svelte      | **5.x**           | Uses runes: `$state`, `$derived`, `$effect`. |
| TypeScript  | **5.4+**          | Optional but strongly recommended. The column-def types pay for themselves. |
| Node        | **18+**           | For tooling (`vite`, `svelte-check`, the example gallery). |

The bundle is tree-shakeable: features you don't import don't ship.
There's no monolithic entry that pulls everything.

## Verify the install

A 5-line smoke test:

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  const rows = [{ name: 'Ada' }, { name: 'Linus' }]
  const columns = [{ field: 'name', header: 'Name' }]
</script>

<SvGrid data={rows} columns={columns} />
```

If you see a styled `<table>` with two rows, you're done.

## Enterprise add-on (optional)

If you need data export (Excel / PDF / CSV), data import, the AI
assistant, or built-in pivot tables, install the paid Enterprise pack
alongside the Community package:

```bash
pnpm add @svgrid/enterprise
```

See [Enterprise features](../enterprise/README.md) for what ships and how to license.

## Where the rest of this guide goes

1. **Install** ← you're here
2. [First grid](./2-first-grid.md) - the minimum runnable example explained
3. [Data and columns](./3-data-and-columns.md) - the two arrays the grid actually reads
4. [Features](./4-features.md) - opt into sort, filter, pagination, grouping, etc.
5. [Theme and density](./5-theme-and-density.md) - `--sg-*` tokens, dark mode, row height
6. [Going to production](./6-going-to-production.md) - server-side data, virtualization, a11y, SSR

The combined "everything in one page" version is at
[../getting-started-full.md](../getting-started-full.md) - useful for
printing or single-tab reading.
