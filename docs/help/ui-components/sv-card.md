# SvCard

A themed surface container with an optional header, body, and footer - the
building block for dashboards and Studio-generated app screens.

`SvCard` frames content on a `--sg-bg` surface with a bordered header (a `title` /
`subtitle` pair, or a custom `header` snippet), a padded body, and an optional
footer. Every color and radius comes from the grid's `--sg-*` tokens, so cards
match the grid, forms, and charts in light and dark without extra styling.

<div data-docs-demo="333-app-feedback" data-height="440"></div>

## Basic usage

```svelte
<script lang="ts">
  import { SvCard } from '@svgrid/grid'
</script>

<SvCard title="Revenue" subtitle="Last 30 days">
  <p>$42,180</p>
  {#snippet footer()}<a href="/reports">View report</a>{/snippet}
</SvCard>
```

## Props

| Prop        | Type      | Default | Description                                                              |
| ----------- | --------- | ------- | ----------------------------------------------------------------------- |
| `title`     | `string`  | -       | Header title. Renders the header row when set.                          |
| `subtitle`  | `string`  | -       | Muted subtitle under the title.                                         |
| `hoverable` | `boolean` | `false` | Lift and accent the border on hover (for clickable cards).              |
| `flush`     | `boolean` | `false` | Remove body padding, e.g. a card wrapping a full-bleed grid or table.   |
| `header`    | `Snippet` | -       | Custom header content; overrides `title` / `subtitle` when provided.    |
| `children`  | `Snippet` | -       | The card body.                                                          |
| `footer`    | `Snippet` | -       | Footer row, separated by a top border.                                  |

The header row renders when any of `header`, `title`, or `subtitle` is set.

## Patterns

### KPI tile

Pair a `title` / `subtitle` with a bold value in the body for a dashboard metric.
Add `hoverable` when the whole card is a link:

```svelte
<a href="/orders">
  <SvCard title="Open orders" subtitle="Today" hoverable>
    <strong style="font-size: 28px">128</strong>
  </SvCard>
</a>
```

### Full-bleed grid

Use `flush` so a grid or chart sits edge to edge with no double padding, while the
header keeps its own inset:

```svelte
<SvCard title="Transactions" flush>
  <SvGrid {columns} {rows} />
</SvCard>
```

### Custom header

Pass a `header` snippet to place actions or a badge alongside the title - it
replaces the default `title` / `subtitle` layout entirely.

### Chart tile

Frame a chart on a dashboard: a titled header, the chart in a `flush` body so it
sits edge to edge, and a footer link:

```svelte
<script lang="ts">
  import { SvCard, SvGridChart, rowsToChartSpec } from '@svgrid/grid'
  const spec = $derived(
    rowsToChartSpec(rows, { type: 'bar', category: 'region', value: 'revenue', reduce: 'sum' }),
  )
</script>

<SvCard title="Revenue by region" subtitle="This quarter" flush>
  <SvGridChart {spec} />
  {#snippet footer()}<a href="/reports/revenue">Full report</a>{/snippet}
</SvCard>
```

**Tip:** the header keeps its own inset even under `flush`, so only the body goes
edge to edge - exactly what a full-bleed grid or chart under a normal title row
needs.

## Accessibility

- `SvCard` is a presentational surface with no imposed role, so it never traps
  focus or adds semantics you did not ask for.
- When the whole card is clickable, wrap it in a real `<a>` or `<button>` so
  keyboard and screen-reader users get proper activation.
- `hoverable` lift is suppressed under `prefers-reduced-motion`.

## See also

- [SvDivider](sv-divider.md) - separate sections inside a card body.
- [SvScrollArea](sv-scroll-area.md) - themed scrollbars for long card content.
- [Layout overview](layout.md) - the whole layout family at a glance.
