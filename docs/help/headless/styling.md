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

## See also

- [Build a table from scratch](./build-a-table.md) - the render loop
- [Headless virtualization](./virtualization.md) - style a virtualized list
- [Tailwind & theming tokens](../tailwind.md) - the `--sg-*` reference
