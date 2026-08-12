# Alerts - Enterprise

Alert rules let your users say "tell me when the data does X" - and then act on
it automatically: raise a toast, tint the row, flash the cell, block the edit,
or just log it. Rules are authored at runtime in a no-code builder, persisted,
and shareable as JSON. No redeploy to add an alert.

Alerts ship in the paid `@svgrid/enterprise` package. They build on the grid's
own engines: predicates reuse the same operators as the filter row
(`applyExcelFilter`), styling paints through the conditional-format pipeline,
and notifications go through the grid's toast store.

<div data-docs-demo="399-alert-rules-engine" data-height="440"></div>

## Setup

Mount `<SvGridAlerts>` next to your grid and spread its `formats` output into the
grid's `conditionalFormats`. The overlay watches your data reactively, runs the
rule engine on every change, and paints matches back through the grid. It diffs
snapshots of the data rather than listening to a single edit event, so it reacts
to streaming feeds and programmatic updates as well as in-grid edits (the grid's
own `onCellValueChange` callback covers only the latter).

Evaluation never runs inside the grid's render frame: a data change schedules one
pass on the next animation frame (post-paint), so the grid always paints first.
On very large or fast-moving datasets, drive it in [push mode](#performance-and-large--live-datasets)
so each pass costs only the rows that actually changed.

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { SvGridAlerts, enableAlerts, setLicenseKey, type ExprColumn } from '@svgrid/enterprise'

  setLicenseKey('YOUR-KEY')
  enableAlerts()

  let rows = $state.raw(data)
  let alertFormats = $state<ConditionalFormat<Row>[]>([])

  // Columns the rule/expression editors offer.
  const exprColumns: ExprColumn[] = [
    { id: 'price', name: 'Price', type: 'number' },
    { id: 'region', name: 'Region', type: 'text' },
  ]
</script>

<SvGridAlerts
  data={rows}
  columns={exprColumns}
  getRowId={(r) => r.id}
  storageKey="app:alerts"
  bind:formats={alertFormats} />

<SvGrid data={rows} {columns} getRowId={(r) => r.id}
        conditionalFormats={alertFormats} />
```

`<SvGridAlerts>` renders a small control group: a bell (opens the fired-alert
log) and an **Alerts** button (opens the rule manager). Set `controls={false}`
to hide them and drive the panels yourself with `bind:panelOpen` /
`bind:managerOpen`.

## The rule model

An `AlertRule` has four moving parts:

| Part | What it is |
| --- | --- |
| **predicate** | A boolean [expression](./expressions-query.md) - when it holds, the rule matches. |
| **trigger** | *When* the rule is checked (see below). |
| **scope** | `row`, `cell`, or `aggregate`. |
| **actions** | What happens when it fires. |

### Triggers

- **`dataChange`** - fires on the true edge: when a row *newly* satisfies the
  predicate after an edit or feed update. It will not re-fire while the row keeps
  matching; it re-arms once the row stops matching.
- **`relativeChange`** - fires when a value *moves*: an absolute delta, a percent
  change, or crossing a threshold. Uses the previous snapshot of the row.
- **`validation`** - evaluated on edit; with a `preventEdit` action it can veto
  the change.
- **`scheduled`** - re-checked on a cron schedule (reuses the enterprise
  scheduler), surfacing rows that currently match.

### Actions

| Kind | Effect |
| --- | --- |
| `toast` | A toast in the rule's severity colour. |
| `highlight` | Tints matching rows/cells (persists while they match). |
| `badge` | Colours the targeted cells. |
| `cellFlash` | A brief flash on the cell that fired. |
| `preventEdit` | Vetoes the edit (validation trigger). |
| `log` | Records the firing in the alert log only. |

Every firing is recorded in the log regardless of action, so the bell badge and
the [alerts panel](#the-fired-alert-log) always reflect activity.

Messages are templates: `{value}`, `{column}`, `{rule}`, `{severity}`, and
`{field}` / `{row.field}` for any row field.

```ts
const rule: AlertRule = {
  id: 'price-spike',
  name: 'Price over 700',
  enabled: true,
  severity: 'warning',
  scope: 'row',
  predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 700 },
  trigger: { type: 'dataChange' },
  actions: [
    { kind: 'toast', message: '{name} crossed 700 -> {value}' },
    { kind: 'highlight', style: { background: '#fef3c7', color: '#92400e' } },
  ],
  createdAt: Date.now(),
}
```

Seed rules with the `rules` prop (used only when storage is empty), or let users
build them in the manager.

## Persistence and sharing

Pass `storageKey` to persist rules in `localStorage`; omit it for in-memory
rules. The manager's **Export** / **Import** buttons round-trip the whole rule
set as JSON, so a team lead can hand a set of alerts to colleagues. Under the
hood this is the same pluggable-storage shape as
[saved views](../recipes/saved-views.md):

```ts
import { createAlertRules, localStorageAlertRules } from '@svgrid/enterprise'

const rules = createAlertRules(localStorageAlertRules('app:alerts'))
rules.save(rule)
const json = rules.export()   // share
rules.import(json)            // load
```

## Headless usage

Not on Svelte, or want to run the engine yourself? `attachAlertEngine` observes
a data source and routes fired events to their side effects, returning the
conditional formats + flash targets to apply:

```ts
import { attachAlertEngine, localStorageAlertRules } from '@svgrid/enterprise'

const attach = attachAlertEngine({
  rules,
  getRowId: (r) => r.id,
  getData: () => currentRows,
  applyFormats: (formats) => setGridFormats(formats),
})
// later
attach.detach()
```

The pure `createAlertEngine` (no DOM, no timers) is exported too if you want full
control over evaluation.

## Performance and large / live datasets

Alerts are built to stay out of the grid's way. Two things make that true:

- **Off-frame evaluation.** Every pass is deferred to a post-paint animation
  frame and coalesced, so a burst of updates costs one pass and the grid never
  waits on alerts to render.
- **Change-scoped work.** Prev-value snapshots are only kept when a rule actually
  needs them (a `relativeChange` trigger). A rule set of pure `dataChange` /
  `aggregate` rules keeps none.

### Watch mode (default)

By default the overlay reactively scans `data` when it changes, diffing the new
array against the previous one to find the changed rows. Because Svelte replaces
changed rows immutably (unchanged rows keep their reference), the diff evaluates
only the rows that moved. This is the zero-config path and is fine for most grids.

### Push mode (streaming / 100k+ rows)

When your app already knows which rows changed - a streaming feed, a transaction,
a tick loop - hand that set straight to the overlay and skip the scan entirely.
Set `watch={false}`, capture the handle with `onReady` (or `bind:this`), and call
`pushChanged` with just the changed rows. Cost is then O(rows that changed),
independent of total row count.

```svelte
<script lang="ts">
  let rows = $state.raw(data)
  let alerts: { pushChanged: (rows: readonly Row[]) => void } | null = null

  function onTick(changed: Row[]) {
    rows = applyChanges(rows, changed) // your immutable update
    alerts?.pushChanged(changed)       // evaluate only these, next frame
  }
</script>

<SvGridAlerts
  data={rows}
  columns={exprColumns}
  getRowId={(r) => r.id}
  watch={false}
  onReady={(h) => (alerts = h)}
  bind:formats={alertFormats} />
```

The handle also exposes `reseed(allRows)` (silently re-arm edges after a full data
reset) and `flush()` (run any pending pass immediately). For big live feeds, prefer
`dataChange` rules (fire once when a row crosses the line) over `relativeChange`
(fires on every move), and keep actions toast-only to avoid conditional-format
churn.

On a busy feed many rows can cross a threshold every second. Evaluation stays cheap,
but a nonstop stream of toasts is disruptive and repaints constantly. Set
`toastCooldownMs` to rate-limit toasts to at most one per rule per interval - every
event is still logged (the bell badge stays accurate), only the visible toast is
throttled:

```svelte
<SvGridAlerts ... watch={false} onReady={(h) => (alerts = h)} toastCooldownMs={6000} />
```

## The fired-alert log

The bell badge shows the unacknowledged count. Clicking it opens
`SvAlertsPanel` - a drawer listing fired alerts newest-first, filterable by
severity, with **Acknowledge**, **Clear**, and **Go to row** (wire `onJump` to
scroll/select the row).

## See also

- [Expression query language](./expressions-query.md) - the predicate language rules are built on.
- [Highlighting changes](./cells/highlighting-changes.md) - the `cellFlash` primitive alerts build on.
- [Conditional formatting](./cells/conditional-formatting.md) - the styling pipeline alerts paint through.
