# 1. Install

> Step 1 of 6 · [Next: First grid →](./2-first-grid.md)

SvGrid is a single npm package. There is no peer dependency on a CSS
framework - bring your own, or import one of the 20 themes that ship
with it. Each theme carries a light and a dark palette, so dark mode is
an attribute, not a second stylesheet.

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
flow. Building with **SvelteKit**? [SvGrid with SvelteKit](./sveltekit.md) is the
end-to-end path: `sv add`, server loads, URL-driven sort, form actions and SSR.

To add SvGrid to an **existing** app, install it directly:

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

## Pick a theme

The render component ships its own styles, so the grid is readable the
moment it mounts. It is deliberately plain, though: no preset is applied
until you ask for one. Import a theme to change that.

```ts
import '@svgrid/grid/themes/shadcn.css'
```

Twenty are available: `ember` (SvGrid's own look), `shadcn`, `tailwind`,
`material`, `fluent`, `carbon`, `antd`, `bootstrap`, `atlassian`,
`salesforce`, `sap`, `github`, `linear`, `notion`, `vercel`, `excel`,
`nord`, `dracula`, `catppuccin`, `ag-alpine`.

Each one declares the whole `--sg-*` token set twice: once on `:root` and
once under `:root[data-theme='dark']`. So dark mode is one attribute on
the document, and the grid follows:

```ts
document.documentElement.dataset.theme = 'dark'
```

Two things worth knowing before you wire this into an existing app:

- **Set `color-scheme` too.** Without it the browser keeps painting native
  scrollbars, form controls and the page canvas light, so a dark grid sits
  in a light frame. `:root { color-scheme: light }` plus
  `:root[data-theme='dark'] { color-scheme: dark }` is the whole fix.
- **Apply the attribute before the first paint.** Setting it from a
  component means the page renders in the wrong palette for a frame. An
  inline script in `index.html` (or `app.html` in SvelteKit) that reads
  `localStorage` avoids the flash.

The scaffolded starters do both already. [Step 5](./5-theme-and-density.md)
covers overriding individual tokens, per-instance theming and density.

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
