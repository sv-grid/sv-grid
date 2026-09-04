# SvCard

A themed surface container with an optional header, body, and footer - the
building block for dashboards and Studio-generated app screens.

`SvCard` frames content on a `--sg-bg` surface with a bordered header (a `title` /
`subtitle` pair, or a custom `header` snippet), a padded body, and an optional
footer. Every color and radius comes from the grid's `--sg-*` tokens, so cards
match the grid, forms, and charts in light and dark without extra styling.

Related: [SvDivider](sv-divider.md) · [SvScrollArea](sv-scroll-area.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvCard` starter into your app:

<div data-docs-add="add card"></div>

Prefer to see it first? `npx @svgrid/ui try card` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvCard` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  let rows = $state<Person[]>(people)
</script>
```

```ts
import { SvCard } from '@svgrid/grid'
```

## Example

<div data-docs-demo="333-app-feedback" data-height="440" data-code></div>

```svelte {runnable}
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

## Examples

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
  <SvGrid data={rows} {columns} />
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

## Header, body, footer

The three slots are independent: a card with only `title` is fine, and `header`
takes over when you need a control up there. `flush` drops the body padding for
content that brings its own - a table or an image.

```svelte {runnable}
<script lang="ts">
  import { SvCard, SvButton, SvBadge } from '@svgrid/grid'
</script>

<SvCard title="Revenue" subtitle="Last 30 days" hoverable>
  <p>EUR 128,400 across 1,204 orders.</p>
  {#snippet footer()}
    <SvButton size="sm" variant="outline">View report</SvButton>
  {/snippet}
</SvCard>

<SvCard>
  {#snippet header()}
    <span>Deploys</span>
    <SvBadge variant="success">passing</SvBadge>
  {/snippet}
  <p>Last deploy 14 minutes ago.</p>
</SvCard>
```

## See also

- [SvDivider](sv-divider.md) - separate sections inside a card body.
- [SvScrollArea](sv-scroll-area.md) - themed scrollbars for long card content.
- [Layout overview](layout.md) - the whole layout family at a glance.
