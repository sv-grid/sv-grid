# SvBadge

A small status pill or count label - the quiet workhorse for statuses, counts,
and tags across tables and cards.

`SvBadge` renders an inline `<span>` tinted from the grid's `--sg-*` semantic
tokens with soft `color-mix` fills, so it reads well on light and dark without
per-badge color choices. Pick a semantic `variant`, optionally show a leading
`dot`, and you have a status marker that matches the rest of the kit.

<div data-docs-demo="333-app-feedback" data-height="420"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvBadge } from '@svgrid/grid'
</script>

<SvBadge variant="success">Active</SvBadge>
<SvBadge variant="warning">Pending</SvBadge>
<SvBadge variant="danger" dot>Failed</SvBadge>
```

## Props

| Prop       | Type                                                                   | Default   | Description                                                       |
| ---------- | ---------------------------------------------------------------------- | --------- | ---------------------------------------------------------------- |
| `variant`  | `neutral` \| `accent` \| `success` \| `warning` \| `danger` \| `info` | `neutral` | Semantic color, tinted from the matching `--sg-*` token.         |
| `size`     | `sm` \| `md`                                                          | `md`      | Font size and padding.                                           |
| `pill`     | `boolean`                                                              | `true`    | Fully rounded pill shape; `false` gives a softer rounded rect.   |
| `dot`      | `boolean`                                                              | `false`   | Shows a leading status dot before the content.                   |
| `children` | `Snippet`                                                              | -         | The badge label. Can be omitted for a dot-only marker.           |

## Patterns

### Status pills

Map a record status to a semantic variant so the color carries meaning:

```svelte
{#if row.status === 'active'}
  <SvBadge variant="success">Active</SvBadge>
{:else if row.status === 'blocked'}
  <SvBadge variant="danger">Blocked</SvBadge>
{:else}
  <SvBadge>Draft</SvBadge>
{/if}
```

### Dot-only indicators

Drop the label and keep `dot` for a compact presence or health marker next to a
name or row:

```svelte
<SvBadge variant="success" dot /> Ada Lovelace
```

### Counts

Badges shine as unread or overflow counts in toolbars and tabs:

```svelte
Notifications <SvBadge variant="accent" size="sm">12</SvBadge>
```

### In a grid cell

Render a status badge inside a column with `renderSnippet`, mapping the value to
a semantic `variant` in one place:

```svelte
<script lang="ts">
  import { SvGrid, SvBadge, renderSnippet, type ColumnDef } from '@svgrid/grid'

  type Order = { id: number; status: 'active' | 'pending' | 'failed' }

  const variantOf = (s: Order['status']) =>
    s === 'active' ? 'success' : s === 'pending' ? 'warning' : 'danger'

  const columns: ColumnDef<{}, Order>[] = [
    { field: 'id', header: 'Order' },
    {
      field: 'status',
      header: 'Status',
      cell: (ctx) => renderSnippet(statusCell, { status: ctx.getValue() as Order['status'] }),
    },
  ]
</script>

{#snippet statusCell(p: { status: Order['status'] })}
  <SvBadge variant={variantOf(p.status)} size="sm" dot>{p.status}</SvBadge>
{/snippet}

<SvGrid {columns} data={orders} />
```

> Tip: `size="sm"` (10.5px, tighter padding) reads better inside grid rows than
> the default `md`, which is tuned for toolbars and headings.

## Accessibility

- Renders a plain inline `<span>`; the visible label is the accessible text.
- The status `dot` is decorative (`aria-hidden`), so pair it with a text label
  when the color alone carries meaning.
- Color is never the only signal in the palette - keep a word or number in the
  badge for users who cannot distinguish the variants by hue.

## See also

- [Feedback overview](feedback.md) - the whole status and display layer at a glance.
- [SvChip](sv-chip.md) - a larger, interactive pill with remove and click.
- [SvAlert](sv-alert.md) - a full inline message when a pill is not enough.
