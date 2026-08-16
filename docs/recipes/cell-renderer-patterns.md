# Cell renderer patterns

Every supported shape for the `cell:` slot on a `ColumnDef`, with the
trade-offs for each.

## The four shapes

`cell:` accepts one of:

| Shape                              | When to use                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| `string`                           | A literal placeholder ("TBD"). Rare.                           |
| `(ctx) => string \| number`        | Computed text, no DOM control.                                 |
| `(ctx) => renderSnippet(...)`      | Inline Svelte 5 snippet defined in the same file.              |
| `(ctx) => renderComponent(...)`    | Mount a real Svelte component imported from another file.      |

`ctx` is `{ row: Row<TData>, column, table, getValue }` - the same
context TanStack-style tables emit. Everywhere below `ctx.row.original`
is your `TData` row.

## 1. Literal string

```ts
{ field: 'amount', header: 'Amount', cell: 'TBD' }
```

Used when bootstrapping. The cell renders the literal across every row.

## 2. Computed function

```ts
{
  field: 'amount', header: 'Amount', align: 'right',
  cell: (ctx) => {
    const n = ctx.row.original.amount
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
    return `$${n}`
  },
}
```

Cheapest custom renderer. No DOM control - the grid wraps the return
value in its own `<td>`. Use for formatted text, status acronyms,
computed totals.

For built-in formats (currency, percent, date, units) prefer the
declarative [`format:`](../reference/ColumnDef.md#format) field - it
runs through `Intl.NumberFormat` cached per locale.

## 3. Inline snippet

```svelte
<script lang="ts">
  import { renderSnippet, type ColumnDef } from '@svgrid/grid'

  type Sale = { amount: number; up: boolean }
  const columns: ColumnDef<typeof features, Sale>[] = [
    {
      field: 'amount', header: 'Amount', align: 'right',
      cell: (ctx) => renderSnippet(Pill, { sale: ctx.row.original }),
    },
  ]
</script>

{#snippet Pill(props: { sale: Sale })}
  <span class="pill" class:up={props.sale.up} class:down={!props.sale.up}>
    {props.sale.up ? '▲' : '▼'} ${props.sale.amount.toLocaleString()}
  </span>
{/snippet}

<style>
  :global(.pill.up)   { background: rgba(34,197,94,0.18);  color: #15803d; }
  :global(.pill.down) { background: rgba(239,68,68,0.18);  color: #b91c1c; }
</style>
```

The snippet is local to the component, with access to its scope. Best
for one-off renderers that need DOM control but don't merit their own
file. The styles need `:global` because the snippet renders into the
grid's body, not the consumer's component subtree.

## 4. Imported component

```svelte
<script lang="ts">
  import { renderComponent } from '@svgrid/grid'
  import BadgeCell from './BadgeCell.svelte'

  const columns = [
    {
      field: 'amount', header: 'Amount',
      cell: (ctx) => renderComponent(BadgeCell, {
        label: `$${ctx.row.original.amount.toLocaleString()}`,
        tone:  ctx.row.original.up ? 'good' : 'bad',
      }),
    },
  ]
</script>
```

```svelte
<!-- BadgeCell.svelte -->
<script lang="ts">
  let { label, tone }: { label: string; tone: 'good' | 'bad' } = $props()
</script>
<span class="bc" class:good={tone === 'good'} class:bad={tone === 'bad'}>{label}</span>
```

Use when the renderer is reused across columns or grids, or when it
carries its own non-trivial state.

## Headers, footers, editors - same shapes

The `header:` and `footer:` fields on `ColumnDef` accept the same four
shapes - any function-valued header is rendered via the same path. So
you can plug your own `<HeaderToolbar />` component without forking
`<SvGrid>`.

Custom inline editors use `cellEditor:` and follow the
`(ctx) => renderSnippet(...)` pattern - see the [`84-editor-types`
demo](https://svgrid.com/demos/84-editor-types/).

## See also

- [Sparkline-cells recipe](./sparkline-cells.md) - a non-trivial component cell
- [Heatmap-cells recipe](./heatmap-cells.md) - computed-function cell with conditional formatting
- [Barcode-cells recipe](./barcode-cells.md) - real SVG rendered per row
- [Conditional row coloring](./conditional-row-coloring.md) - styling without a custom renderer
- [`<SvGrid>` reference](../reference/SvGrid.md) - `renderSnippet` / `renderComponent` helpers
