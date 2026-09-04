# Styling a headless table

With the headless engine you render your own markup, so **you own every pixel of
styling** - there is no grid stylesheet to fight. The same `createSvGrid` engine
can drive a minimal underlined table, a fully bordered grid, or floating row
cards. Flip the controls in the demo; the engine and rows are identical, only
the CSS changes.

<div data-docs-demo="188-headless-styled" data-height="540"></div>

## The mindset

The engine hands you `getHeaderGroups()` and `getRowModel().rows`; how you turn
them into DOM - `<table>`, CSS grid, flexbox, divs - and how you style them is
entirely yours. Nothing below is prescribed; it's just what the demo does.

## Track the site theme with `--sg-*` tokens

The grid's theming is a set of CSS custom properties (`--sg-bg`, `--sg-fg`,
`--sg-border`, `--sg-header-bg`, `--sg-muted`, `--sg-accent`, …). Use the same
tokens in your headless CSS and your table automatically follows the app's
light / dark theme and any per-instance overrides - no extra work.

```css
.my-table { color: var(--sg-fg, #0f172a); font-size: 13px; }
.my-table th {
  background: var(--sg-header-bg, #f1f5f9);
  border-bottom: 2px solid var(--sg-border, #e2e8f0);
}
.my-table td { border-bottom: 1px solid var(--sg-border, #eef2f7); }
```

Always keep a literal fallback (`var(--sg-fg, #0f172a)`) so the table is styled
even outside a themed container. See [Tailwind & theming](../tailwind.md) for the
full token list.

## The usual affordances

These are one CSS rule each - the engine doesn't need to know about them.

```css
/* Zebra striping */
.my-table tbody tr:nth-child(even) td {
  background: color-mix(in oklab, var(--sg-muted) 8%, transparent);
}
/* Hover */
.my-table tbody tr:hover td {
  background: color-mix(in oklab, var(--sg-accent, #6366f1) 8%, transparent);
}
/* Sticky header inside a scroll container */
.my-table thead th { position: sticky; top: 0; z-index: 1; }
/* Right-align numbers */
.my-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
/* Density: swap a class */
.dense th, .dense td { padding: 5px 10px; }
```

## Sort affordance

Sorting is engine state, but the **indicator** is your markup - render it off the
`sorting` state you already control:

```svelte
<th onclick={() => toggleSort(h.column.id)}>
  {h.column.columnDef.header}
  {#if sorting[0]?.id === h.column.id}
    <span class="ind">{sorting[0].desc ? '▼' : '▲'}</span>
  {/if}
</th>
```

## Prefer Tailwind? Use classes instead of CSS

Because it's your markup, utility classes work exactly as they would on any
`<table>` - no wrapper, no `:global`:

```svelte
<table class="w-full text-sm">
  <thead>
    <tr class="border-b-2 border-slate-200">
      {#each headers as h}
        <th class="px-3 py-2 text-left font-semibold cursor-pointer hover:text-indigo-500">
          {h.column.columnDef.header}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each rows as r}
      <tr class="border-b border-slate-100 even:bg-slate-50 hover:bg-indigo-50">
        <!-- cells -->
      </tr>
    {/each}
  </tbody>
</table>
```


## A styled table, end to end

Everything above, applied at once: tokens with literal fallbacks, zebra
striping, a sticky header, right-aligned numerals. The engine below is the same
five lines as the unstyled version.

```svelte {runnable}
<script lang="ts">
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }

  const data: Repo[] = [
    { name: 'svelte',   lang: 'JavaScript', stars: 78000 },
    { name: 'vite',     lang: 'TypeScript', stars: 68000 },
    { name: 'sv-grid',  lang: 'TypeScript', stars: 172 },
    { name: 'rollup',   lang: 'JavaScript', stars: 25000 },
    { name: 'esbuild',  lang: 'Go',         stars: 38000 },
    { name: 'tinygo',   lang: 'Go',         stars: 15000 },
    { name: 'bun',      lang: 'Zig',        stars: 74000 },
    { name: 'zig',      lang: 'Zig',        stars: 35000 },
  ]

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name',  header: 'Repo' },
    { field: 'lang',  header: 'Language' },
    { field: 'stars', header: 'Stars' },
  ]

  let sorting = $state([{ id: 'stars', desc: true }])

  const table = createSvGrid({
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel<Repo>(),
      sortedRowModel: createSortedRowModel<Repo>(),
    },
    data,
    columns,
    state: { sorting },
    onSortingChange: (u) => (sorting = typeof u === 'function' ? u(sorting) : u),
  })

  const rows = $derived(table.getRowModel().rows)
</script>

<div class="scroller">
  <table class="my-table">
    <thead>
      {#each table.getHeaderGroups() as hg (hg.id)}
        <tr>
          {#each hg.headers as h (h.id)}
            <th
              class:num={h.column.id === 'stars'}
              onclick={h.column.getToggleSortingHandler()}
            >
              {h.column.columnDef.header}
              {#if sorting[0]?.id === h.column.id}
                <span class="ind">{sorting[0].desc ? 'v' : '^'}</span>
              {/if}
            </th>
          {/each}
        </tr>
      {/each}
    </thead>
    <tbody>
      {#each rows as r (r.id)}
        {@const repo = r.original as Repo}
        <tr>
          <td>{repo.name}</td>
          <td>{repo.lang}</td>
          <td class="num">{repo.stars.toLocaleString()}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroller { max-height: 220px; overflow: auto; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; }
  .my-table { width: 100%; border-collapse: collapse; color: var(--sg-fg, #0f172a); font-size: 13px; }
  .my-table th {
    position: sticky; top: 0; z-index: 1; text-align: left; cursor: pointer;
    padding: 8px 12px; background: var(--sg-header-bg, #f1f5f9);
    border-bottom: 2px solid var(--sg-border, #e2e8f0);
  }
  .my-table td { padding: 7px 12px; border-bottom: 1px solid var(--sg-border, #eef2f7); }
  .my-table tbody tr:nth-child(even) td { background: color-mix(in oklab, var(--sg-muted, #64748b) 8%, transparent); }
  .my-table tbody tr:hover td { background: color-mix(in oklab, var(--sg-accent, #6366f1) 8%, transparent); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .ind { font-size: 10px; opacity: 0.65; }
</style>
```

## Same engine, no table at all

The strongest argument for headless is that the row model does not care what
you render. Identical `createSvGrid` call, identical rows - cards instead of a
`<table>`. A grid component cannot do this without a card mode; here it is just
different markup.

```svelte {runnable}
<script lang="ts">
  import {
    createSvGrid,
    createCoreRowModel,
    createSortedRowModel,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Repo = { name: string; lang: string; stars: number }

  const data: Repo[] = [
    { name: 'svelte',   lang: 'JavaScript', stars: 78000 },
    { name: 'vite',     lang: 'TypeScript', stars: 68000 },
    { name: 'sv-grid',  lang: 'TypeScript', stars: 172 },
    { name: 'rollup',   lang: 'JavaScript', stars: 25000 },
    { name: 'esbuild',  lang: 'Go',         stars: 38000 },
    { name: 'tinygo',   lang: 'Go',         stars: 15000 },
    { name: 'bun',      lang: 'Zig',        stars: 74000 },
    { name: 'zig',      lang: 'Zig',        stars: 35000 },
  ]

  const features = tableFeatures({ rowSortingFeature })

  const columns: ColumnDef<typeof features, Repo>[] = [
    { field: 'name',  header: 'Repo' },
    { field: 'stars', header: 'Stars' },
  ]

  let sorting = $state([{ id: 'stars', desc: true }])

  const table = createSvGrid({
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel<Repo>(),
      sortedRowModel: createSortedRowModel<Repo>(),
    },
    data,
    columns,
    state: { sorting },
    onSortingChange: (u) => (sorting = typeof u === 'function' ? u(sorting) : u),
  })

  const rows = $derived(table.getRowModel().rows)
</script>

<button type="button" onclick={() => (sorting = [{ id: 'name', desc: false }])}>
  Sort by name
</button>

<div class="cards">
  {#each rows as r (r.id)}
    {@const repo = r.original as Repo}
    <article class="card">
      <h4>{repo.name}</h4>
      <p class="lang">{repo.lang}</p>
      <p class="stars">{repo.stars.toLocaleString()} stars</p>
    </article>
  {/each}
</div>

<style>
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; }
  .card {
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; padding: 10px 12px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .card h4 { margin: 0 0 4px; font-size: 13px; }
  .lang { margin: 0; font-size: 11px; color: var(--sg-muted, #64748b); }
  .stars { margin: 6px 0 0; font-size: 12px; font-variant-numeric: tabular-nums; }
</style>
```

## See also

- [Build a table from scratch](./build-a-table.md) - the render loop
- [Headless virtualization](./virtualization.md) - style a virtualized list
- [Tailwind & theming tokens](../tailwind.md) - the `--sg-*` reference
