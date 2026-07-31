---
name: svgrid
description: Writes, fixes, and reviews SvGrid data-grid code in Svelte 5 projects — columns, features, inline editing, filtering, theming with --sg-* tokens, server-side data, and the enterprise add-on (export/import/pivot/AI). Provides project context, the ColumnDef and <SvGrid> API surface, and correct-vs-incorrect patterns. Applies when working with @svgrid/grid, @svgrid/enterprise, <SvGrid>, ColumnDef, SvGridApi, or any project that imports from @svgrid/*.
user-invocable: false
allowed-tools: Bash(npm create @svgrid@latest *), Bash(pnpm create @svgrid *), Bash(yarn create @svgrid *), Bash(npx @svgrid/mcp *), Bash(pnpm dlx @svgrid/mcp *)
---

# SvGrid

SvGrid is a modern **Svelte 5** data grid: a headless core engine paired
with a render component (`<SvGrid>`). It scales from a 10-row read-only
table to a virtualized 100k-row editing surface with grouping, filtering,
server-side data, and full keyboard + screen-reader support. Two packages:
`@svgrid/grid` (MIT) and `@svgrid/enterprise` (commercial add-on).

> **This is a library, not a source-copy CLI.** You `import` from
> `@svgrid/grid`; there is no "add component" step. Write correct code
> against the API below and ground uncertain details in the live docs
> (see [Grounding](#grounding-look-it-up-dont-guess)).

## Current project context

Before writing grid code, read the project to learn what it has:

1. **Which packages are installed** — check `package.json` for
   `@svgrid/grid` and `@svgrid/enterprise`. Never use an enterprise
   symbol (`installEnterprise`, `setAIProvider`, pivot, export) in a
   project that only has `@svgrid/grid`.
2. **Svelte version** — SvGrid requires **Svelte 5**. Use runes
   (`$state`, `$derived`, `$effect`), never legacy stores or `export let`.
3. **How the app themes** — grep for `--sg-` in the app's CSS, and for a
   dark-mode attribute (`data-theme`, `.dark`). Match the existing
   convention instead of inventing a new one. See [theming.md](./rules/theming.md).
4. **Existing grids** — if the project already renders `<SvGrid>`, copy
   its column/feature conventions rather than introducing a second style.

## The minimal grid

The smallest correct grid is two arrays and a component. **The shortcut
props inject their own features** — you do *not* need `tableFeatures`
for the common cases:

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from '@svgrid/grid'

  type Row = { id: number; name: string; amount: number }
  const data = $state<Row[]>([/* ...rows... */])

  const columns: ColumnDef<Row>[] = [
    { id: 'id',     field: 'id',     header: 'ID',     width: 80 },
    { id: 'name',   field: 'name',   header: 'Name' },
    { id: 'amount', field: 'amount', header: 'Amount', type: 'number' },
  ]
</script>

<SvGrid {data} {columns} sortable filterable pageable />
```

## Critical rules

These are **always enforced**. Each links to a file with Incorrect/Correct
code pairs.

### Columns & cells → [columns.md](./rules/columns.md)

- **Every column needs a stable `id`.** `field` maps to the data key;
  `id` is the identity used by state, sorting, and the API. They can match.
- **Custom cells are `{#snippet}`s assigned to `cell`**, not raw HTML in
  the column. Snippet params are `{ value, row, column }`.
- **Set widths in `ColumnDef` (`width` / `minWidth` / `flex`)**, never
  with CSS on the grid's internal nodes — the renderer owns those.
- **Use `type: 'number' | 'date' | 'boolean'`** for alignment, parsing,
  and the right default editor, instead of hand-formatting.

### Features & props → [data-and-features.md](./rules/data-and-features.md)

- **Prefer the shortcut props** (`sortable`, `filterable`, `pageable`,
  `editable`, `groupable`) for the common path — each injects the matching
  feature. Reach for `tableFeatures({ ... })` only when you need a feature
  with no shortcut, or want explicit control.
- **Get the imperative API via `onApiReady`**, hold it in `$state`, and
  call methods (`api.setFilter`, `api.exportToCsv`, ...) from handlers.
- **Server-side data uses `createServerDataSource`** implementing the
  `ServerDataSource` contract — the grid emits intent, your source fetches
  the page. Don't filter/sort locally in server mode.

### Theming → [theming.md](./rules/theming.md)

- **Theme with `--sg-*` CSS custom properties**, declared at `:root` or on
  a wrapper — never by targeting Svelte-mangled internal class names.
- **For a design system (shadcn, Tailwind, Material)**, either import a
  shipped preset (`@svgrid/grid/themes/<id>.css`) or bridge `--sg-*` to the
  app's own tokens so dark mode flips for free.
- **Dark mode** = redeclare the same `--sg-*` tokens under the app's dark
  selector. The grid reads tokens at paint time; no JS listener needed.

## Grounding: look it up, don't guess

SvGrid ships machine-readable grounding so you never invent an API. When a
detail is uncertain, **fetch, don't hallucinate**:

| Resource | Use for |
| --- | --- |
| `https://svgrid.com/llms.txt` | Topic map with one-line summaries — the index to fetch first |
| `https://svgrid.com/llms-full.txt` | Every doc page concatenated — deep API detail |
| `https://svgrid.com/schemas/column-def.json` | JSON Schema for `ColumnDef` — validate generated columns against it |
| `https://svgrid.com/schemas/svgrid-options.json` | JSON Schema for `<SvGrid>` props |

If the project uses an MCP client (Claude Desktop, Cursor, Zed, Claude
Code), the **`@svgrid/mcp`** server exposes the same facts as callable
tools (`list_examples`, `get_example_source`, `list_docs`) — prefer it for
version-pinned answers. It needs no API key and runs locally.

## Package boundary

- **`@svgrid/grid`** (MIT) — the grid, all features, theming, server data,
  headless engine. Everything in the rules files is here unless marked.
- **`@svgrid/enterprise`** (commercial) — `installEnterprise(api)` adds
  `api.exportTo*`, import, pivot, and the `api.ai.*` helpers;
  `setAIProvider` registers the model adapter. Runs unlicensed with a
  watermark, so it is safe to scaffold — but only use it when the package
  is actually a dependency.

**Never** import from `@sv-grid/core`, `svelte-grid`, or `sv-grid` — those
are unrelated projects. The only import specifiers are `@svgrid/grid`,
`@svgrid/grid/themes/*.css`, and `@svgrid/enterprise`.

## Scaffolding a new project

To start a fresh app with the grid already wired up:

```bash
npm create @svgrid@latest my-app        # interactive
npm create @svgrid@latest my-app -- --template admin-dashboard
```

Templates: `minimal` (Vite + Svelte 5) and `admin-dashboard` (SvelteKit +
Tailwind). Use the project's package runner (`npm create` / `pnpm create` /
`yarn create`).

## Workflow

1. **Read context** — installed `@svgrid/*` packages, Svelte 5, theming
   convention, any existing grid.
2. **Write against the API** — start from the minimal grid, add shortcut
   props, then columns/cells/editing as needed.
3. **Ground the uncertain bits** — fetch `llms.txt` / a schema, or use the
   `@svgrid/mcp` tools, before inventing a prop or method name.
4. **Match the theme** — reuse the app's `--sg-*` tokens or a preset; wire
   dark mode through the existing selector.
5. **Review** — confirm every column has an `id`, no CSS targets internal
   nodes, and no enterprise symbol leaks into a grid-only project.

## Detailed references

- [rules/columns.md](./rules/columns.md) — ColumnDef, custom cells, widths, types, formatting, editors
- [rules/data-and-features.md](./rules/data-and-features.md) — feature toggles, the SvGridApi, selection, server-side data
- [rules/theming.md](./rules/theming.md) — `--sg-*` tokens, dark mode, design-system presets, the shadcn bridge
