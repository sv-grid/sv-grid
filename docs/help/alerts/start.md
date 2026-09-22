---
seoTitle: Svelte grid alerts - rules on live data, guardrails, a schedule
seoDescription: Alert rules on a Svelte data grid: a rule on a crossed line, one that watches a move, a KPI, a guardrail that vetoes an edit, the log, a feed, a schedule.
keywords: svelte grid alerts, alert rules data grid, threshold alert svelte, validation guardrail grid, streaming grid alerts
---

# Alerts: rules over live data

A rule the user writes, or you ship, that watches the rows and does
something when one crosses a line: a toast, a highlight, a badge, a
vetoed edit, a line in a log. This page builds the pieces up over one
grid of prices that moves when you tell it to: one rule, the three ways
a rule fires, what it does when it does, a guardrail on an edit, the
bell and its log, saving the rules, a feed that pushes its own changes,
and a rule on a clock. [Alerts](../alerts.md) is the reference behind
it; [Scheduling](../scheduling.md) the clock.

The engine ships in `@svgrid/enterprise`; `enableAlerts()` once
registers it. The examples share a watch list and a `tick` that moves
the prices the way a feed would, replacing changed rows immutably so the
overlay can tell which ones moved.

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { SvGridAlerts, enableAlerts, createAlertEngine, type AlertRule, type ExprColumn } from '@svgrid/enterprise'

  enableAlerts()

  type Quote = { symbol: string; name: string; sector: string; price: number; changePct: number; volume: number }
  const seed: Quote[] = [
    { symbol: 'ATO', name: 'Atomic Foods', sector: 'Consumer', price: 182, changePct: 0, volume: 12400 },
    { symbol: 'NVX', name: 'Novax Labs', sector: 'Health', price: 645, changePct: 0, volume: 8800 },
    { symbol: 'ORB', name: 'Orbital Systems', sector: 'Industrial', price: 712, changePct: 0, volume: 15200 },
    { symbol: 'QLM', name: 'Quantum Loom', sector: 'Tech', price: 388, changePct: 0, volume: 22100 },
    { symbol: 'VRD', name: 'Verdant Energy', sector: 'Energy', price: 96, changePct: 0, volume: 30500 },
    { symbol: 'BYT', name: 'Byte Dynamics', sector: 'Tech', price: 934, changePct: 0, volume: 41200 },
    { symbol: 'CRS', name: 'Crestline Bank', sector: 'Finance', price: 118, changePct: 0, volume: 18700 },
    { symbol: 'PLR', name: 'Polaris Freight', sector: 'Logistics', price: 61, changePct: 0, volume: 27800 },
  ]

  // One step of a feed: a few symbols move, by up to 6% either way.
  let step = 1
  function moved(rows: Quote[]): Quote[] {
    step += 1
    return rows.map((q, i) => {
      if ((i + step) % 3 !== 0) return q
      const pct = ((((i + 1) * step * 7919) % 120) - 60) / 10
      const price = Math.round(q.price * (1 + pct / 100) * 100) / 100
      return { ...q, price, changePct: Math.round(((price - seed[i]!.price) / seed[i]!.price) * 10000) / 100 }
    })
  }

  // The columns the rule editor offers, with the type each one compares as.
  const exprColumns: ExprColumn[] = [
    { id: 'symbol', name: 'Symbol', type: 'text' },
    { id: 'sector', name: 'Sector', type: 'text' },
    { id: 'price', name: 'Price', type: 'number' },
    { id: 'changePct', name: 'Change %', type: 'number' },
    { id: 'volume', name: 'Volume', type: 'number' },
  ]
  const columns: GridColumns<Quote> = [
    { field: 'symbol', header: 'Symbol', width: 90 },
    { field: 'name', header: 'Name', width: 160 },
    { field: 'sector', header: 'Sector', width: 110 },
    { field: 'price', header: 'Price', width: 100, align: 'right', format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } } },
    { field: 'changePct', header: 'Change %', width: 100, align: 'right', format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } } },
    { field: 'volume', header: 'Volume', width: 100, align: 'right', format: { type: 'number' } },
  ]
</script>
```

## One rule

`<SvGridAlerts>` sits beside the grid and watches the same `data`. It
runs the rules on every change and hands back `formats`, the
conditional formats the matching rows should wear, which you spread
into the grid's `conditionalFormats`. A rule is plain data: a predicate,
a trigger, a scope, and the actions.

```svelte {runnable}
<script lang="ts">
  let rows = $state.raw<Quote[]>(seed)
  let formats = $state<ConditionalFormat<Quote>[]>([])
  const rules: AlertRule[] = [
    {
      id: 'over-700', name: 'Price over 700', enabled: true, severity: 'warning', scope: 'row',
      predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 700 },
      trigger: { type: 'dataChange' },
      actions: [
        { kind: 'toast', message: '{symbol} crossed 700: {value}' },
        { kind: 'highlight', style: { background: '#fef3c7', color: '#92400e' } },
      ],
      createdAt: 0,
    },
  ]
</script>

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
  <button type="button" onclick={() => (rows = moved(rows))}>Tick the feed</button>
  <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.symbol} {rules} bind:formats />
</div>
<SvGrid data={rows} {columns} getRowId={(r) => r.symbol} conditionalFormats={formats} containerHeight={320} />
```

Two rows are amber from the start: ORB and BYT are over 700 in the seed,
and a rule seeds silently, matching rows highlighted and no toast, so a
page does not open with a burst. Tick the feed until a third price
passes 700 (NVX, on the fourth tick): a toast names the symbol, the row
turns amber, and the bell counts one. Tick again and the row stays amber
while it stays over 700 but the toast does not repeat: `dataChange` fires
on the true edge, when a row newly matches, and re-arms once it stops
matching. The two buttons the overlay renders are the bell (the log) and
Manage alerts (the rule manager, where the user writes rules of their
own with the same shape). The log is one per page, shared by every
overlay on it, so on this page the bell also counts the firings of the
examples and demos below.

The overlay diffs snapshots rather than listening to an edit event, so a
feed, a transaction and a typed edit all count. Evaluation runs on the
next animation frame after the grid painted, never inside its render.

## Three ways a rule fires

`dataChange` is the edge. `relativeChange` fires when a value moves: a
`delta` of at least so much, a `percentChange`, or `crossed` a threshold
in a direction; it reads the previous snapshot of the row. A rule with
`scope: 'aggregate'` watches a number over the whole dataset, written as
a `scalarCmp` between an aggregate and a literal. `validation` is the
fourth, on an edit, and gets its own section below.

```svelte {runnable}
<script lang="ts">
  let rows = $state.raw<Quote[]>(seed)
  let formats = $state<ConditionalFormat<Quote>[]>([])
  const rules: AlertRule[] = [
    {
      id: 'big-move', name: 'Moved more than 4%', enabled: true, severity: 'info', scope: 'cell', columns: ['changePct'],
      predicate: { kind: 'const', value: true },
      trigger: { type: 'relativeChange', expr: { kind: 'percentChange', column: 'price', op: '>=', value: 4, abs: true } },
      actions: [{ kind: 'cellFlash' }],
      createdAt: 0,
    },
    {
      id: 'under-100', name: 'Fell under 100', enabled: true, severity: 'error', scope: 'row',
      predicate: { kind: 'cmp', column: 'price', op: 'lessThan', value: 100 },
      trigger: { type: 'relativeChange', expr: { kind: 'crossed', column: 'price', threshold: 100, direction: 'below' } },
      actions: [{ kind: 'toast', message: '{symbol} fell under 100 ({value})' }, { kind: 'highlight', style: { background: '#fee2e2', color: '#991b1b' } }],
      createdAt: 0,
    },
    {
      id: 'board-average', name: 'Average price over 400', enabled: true, severity: 'success', scope: 'aggregate',
      predicate: { kind: 'scalarCmp', left: { kind: 'agg', fn: 'avg', column: 'price' }, op: '>', right: { kind: 'lit', value: 400 } },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'toast', message: 'The board averages over 400' }],
      createdAt: 0,
    },
  ]
</script>

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
  <button type="button" onclick={() => (rows = moved(rows))}>Tick the feed</button>
  <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.symbol} {rules} bind:formats />
</div>
<SvGrid data={rows} {columns} getRowId={(r) => r.symbol} conditionalFormats={formats} containerHeight={320} />
```

A `relativeChange` rule fires on every move that qualifies, which is
the point of it and the reason to keep its actions quiet: a flash here,
not a toast. A `highlight` or a `badge` is painted from the predicate,
not from the firing, so a rule that carries one needs a predicate that
says which rows to paint: `under-100` is highlighted while the price is
under 100 and toasts on the crossing. The aggregate rule has no row; its
event has no `rowId` and its toast names nothing.

A predicate is the same expression the [advanced filter](../expressions-query.md)
uses: `cmp` with a column, an operator and a value; `and`, `or` and
`not` over parts; `scalarCmp` for arithmetic across columns
(`[amount] / [budget] >= 0.9`). The rule manager writes them from a
builder, so a user never sees the JSON.

## What a rule does

Every firing is recorded in the log whatever its actions, so the bell is
always right. The actions are what else happens:

| `kind` | Effect |
| --- | --- |
| `toast` | A toast in the rule's severity colour, with the `message`. |
| `highlight` | Tints the matching row, or the rule's `columns`, while it matches. |
| `badge` | Colours the targeted cells and draws its `icon` before the value. |
| `cellFlash` | A brief flash on the cell that fired. |
| `preventEdit` | Marks a `validation` rule as a veto: `validateEdit` answers `vetoed`, and a column with `rejectInvalid` refuses the write. |
| `log` | Nothing visible: the log alone. |

A `message` is a template: `{value}`, `{column}`, `{rule}`, `{severity}`,
and any field of the row as `{symbol}` or `{row.symbol}`. `severity` is
`info`, `success`, `warning` or `error`, and picks the toast colour and
the log's filter.

## A guardrail on an edit

A `validation` rule is checked on the edit, before it lands, and a
`preventEdit` action marks it as a veto. The overlay is not in that
path; the pure engine is. `createAlertEngine` takes the rules, and
`validateEdit(row, column, candidate)` says whether the value would trip
one. The column's `validate` hook hands that message to the grid, which
paints the cell red with it, and `rejectInvalid: true` turns the flag
into a refusal: an edit the rule vetoes is not written, the cell keeps
its old value and `onCellValueChange` does not fire. Without
`rejectInvalid`, `validate` only flags.

```svelte {runnable}
<script lang="ts">
  type Expense = { id: string; item: string; amount: number; budget: number }
  let rows = $state<Expense[]>([
    { id: 'e1', item: 'Cloud hosting', amount: 4200, budget: 5000 },
    { id: 'e2', item: 'Conference travel', amount: 3100, budget: 3000 },
    { id: 'e3', item: 'Design tools', amount: 900, budget: 1200 },
  ])
  const guardrails: AlertRule[] = [
    {
      id: 'no-negative', name: 'No negative amounts', enabled: true, severity: 'error', scope: 'cell', columns: ['amount'],
      predicate: { kind: 'cmp', column: 'amount', op: 'lessThan', value: 0 },
      trigger: { type: 'validation' },
      actions: [{ kind: 'preventEdit', message: 'Amount cannot be negative' }],
      createdAt: 0,
    },
    {
      id: 'over-budget', name: 'Over budget', enabled: true, severity: 'error', scope: 'cell', columns: ['amount'],
      predicate: { kind: 'scalarCmp', left: { kind: 'col', id: 'amount' }, op: '>', right: { kind: 'col', id: 'budget' } },
      trigger: { type: 'validation' },
      actions: [{ kind: 'preventEdit', message: '{item}: {value} is over the {budget} budget' }],
      createdAt: 0,
    },
  ]
  const engine = createAlertEngine<Expense>({ rules: guardrails, getRowId: (r) => r.id })
  // Pure: the grid calls it inside a reactive computation to show validity.
  const validateAmount = (value: unknown, row: Expense): string | null => {
    const result = engine.validateEdit(row, 'amount', Number(value))
    return result.vetoed ? (result.events[0]?.message ?? 'Edit blocked') : null
  }
  const money = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const expenseColumns: GridColumns<Expense> = [
    { field: 'item', header: 'Item', width: 180 },
    { field: 'amount', header: 'Amount', width: 130, align: 'right', format: money, editorType: 'number',
      validate: ({ value, row }) => validateAmount(value, row), rejectInvalid: true },
    { field: 'budget', header: 'Budget', width: 130, align: 'right', format: money, editorType: 'number' },
  ]
</script>

<SvGrid data={rows} columns={expenseColumns} getRowId={(r) => r.id} editable containerHeight={220} />
```

Double-click an Amount and type `-5`, or `9000` on the first line: the
cell turns red with the rule's message as you type, and on Enter it
keeps its old value. Raise the Budget first and the same amount goes
through, because the second rule compares two columns of the row.

<div data-docs-demo="402-alert-validation-guardrails" data-height="520"></div>

## The bell and the log

The bell's badge is the unacknowledged count; clicking it opens
`SvAlertsPanel`, a drawer of fired alerts newest first, filterable by
severity, with Acknowledge, Clear and Go to row. `onJump` gets the
event so the app can scroll to and select the row. `controls={false}`
hides the two buttons, and `bind:panelOpen` and `bind:managerOpen` drive
the drawers from chrome of your own:

```svelte {runnable}
<script lang="ts">
  let rows = $state.raw<Quote[]>(seed)
  let formats = $state<ConditionalFormat<Quote>[]>([])
  let panelOpen = $state(false)
  let managerOpen = $state(false)
  let lastJump = $state('')
  const rules: AlertRule[] = [{
    id: 'over-700', name: 'Price over 700', enabled: true, severity: 'warning', scope: 'row',
    predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 700 },
    trigger: { type: 'dataChange' },
    actions: [{ kind: 'log' }, { kind: 'highlight', style: { background: '#fef3c7' } }],
    createdAt: 0,
  }]
</script>

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
  <button type="button" onclick={() => (rows = moved(rows))}>Tick the feed</button>
  <button type="button" onclick={() => (panelOpen = true)}>Open the log</button>
  <button type="button" onclick={() => (managerOpen = true)}>Edit the rules</button>
  <span style="font-size: 12px">{lastJump}</span>
  <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.symbol} {rules} controls={false}
    bind:formats bind:panelOpen bind:managerOpen onJump={(e) => (lastJump = `jump to ${e.rowId}`)} />
</div>
<SvGrid data={rows} {columns} getRowId={(r) => r.symbol} conditionalFormats={formats} containerHeight={320} />
```

The rule here logs and highlights but never toasts, which is the right
setting for a rule that fires often on a busy screen: the bell keeps
count, the drawer has the history, nothing interrupts.

## Saving and sharing the rules

Pass `storageKey` and the rules persist in `localStorage` under it; the
`rules` prop then seeds storage only when it is empty, so a user's edits
win over the shipped set on the next visit. The manager's Export and
Import buttons round-trip the whole set as JSON, which is how one
person hands a set of alerts to a team. Under it is the same pluggable
store as saved views:

```ts
import { createAlertRules, localStorageAlertRules } from '@svgrid/enterprise'

const store = createAlertRules(localStorageAlertRules('app:alerts'))
store.save(rule)
const json = store.export() // share it
store.import(json)          // load it
```

`memoryAlertRules()` is the same store without persistence, for a test
or a rule set the server owns.

## A feed that pushes its own changes

By default the overlay diffs `data` when it changes and evaluates the
rows whose reference moved, which is fine for most grids. A feed that
already knows which rows changed can skip the scan: `watch={false}`,
take the handle from `onReady`, and call `pushChanged` with the changed
rows alone, so a pass costs those rows whatever the total. Many rows
crossing a line in a second means many toasts; `toastCooldownMs` keeps
it to one per rule per interval while every event still reaches the
log.

```svelte {runnable}
<script lang="ts">
  let rows = $state.raw<Quote[]>(seed)
  let formats = $state<ConditionalFormat<Quote>[]>([])
  let alerts: { pushChanged: (rows: readonly Quote[]) => void } | null = null
  let running = $state(false)
  let timer: ReturnType<typeof setInterval> | undefined
  const rules: AlertRule[] = [{
    id: 'over-700', name: 'Price over 700', enabled: true, severity: 'warning', scope: 'row',
    predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 700 },
    trigger: { type: 'dataChange' },
    actions: [{ kind: 'toast', message: '{symbol} over 700' }, { kind: 'highlight', style: { background: '#fef3c7' } }],
    createdAt: 0,
  }]
  function tick() {
    const next = moved(rows)
    const changed = next.filter((q, i) => q !== rows[i])
    rows = next
    alerts?.pushChanged(changed)
  }
  function toggle() {
    running = !running
    clearInterval(timer)
    if (running) timer = setInterval(tick, 700)
  }
  $effect(() => () => clearInterval(timer))
</script>

<div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
  <button type="button" onclick={toggle}>{running ? 'Stop the feed' : 'Start the feed'}</button>
  <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.symbol} {rules} watch={false} onReady={(h) => (alerts = h)} toastCooldownMs={5000} bind:formats />
</div>
<SvGrid data={rows} {columns} getRowId={(r) => r.symbol} conditionalFormats={formats} containerHeight={320} />
```

The handle also has `reseed(allRows)`, to re-arm the edges quietly after
a full reload of the data, and `flush()`, to run a pending pass now. On
a big feed prefer `dataChange` rules to `relativeChange` ones, and keep
the actions to a toast or a log: a highlight on thousands of rows is a
conditional-format change per pass.

## A rule on a clock

`trigger: { type: 'scheduled', schedule }` is re-checked on a cron
expression or once at a time rather than on a change: the overlay runs
the enterprise scheduler for it, and on each fire the rule lists every
row its predicate matches at that moment, whether or not anything moved,
which is what a Friday review wants. The schedule is the scheduler's own
shape, so the same expression drives a report:

```ts
const rule: AlertRule = {
  id: 'friday-review', name: 'Positions over 700 at Friday close', enabled: true, severity: 'info', scope: 'row',
  predicate: { kind: 'cmp', column: 'price', op: 'greaterThan', value: 700 },
  trigger: { type: 'scheduled', schedule: { id: 'friday', name: 'Friday close', cron: '30 17 * * 5' } },
  actions: [{ kind: 'toast', message: '{symbol} is still over 700' }],
  createdAt: Date.now(),
}
```

The scheduler ticks twice a minute and fires a schedule at most once per
due minute, while the tab is open. [Scheduling](../scheduling.md) has the
cron reference, the time-zone rule, what happens to a run missed while
the tab was closed, and a scheduled export next to a scheduled alert.

<div data-docs-demo="399-alert-rules-engine" data-height="600"></div>

<div data-docs-demo="401-alert-aggregate-kpi" data-height="520"></div>

## See also

- [Alerts](../alerts.md) - the reference: every prop, the headless `attachAlertEngine`, and the four demos.
- [Expressions](../expressions-query.md) - the predicate language the rules and the advanced filter share.
- [Conditional formatting](../cells/conditional-formatting.md) - what `formats` is made of.
- [Scheduling](../scheduling.md) - cron and one-off schedules, for reports as well as alerts.
- [Real-time and streaming](../real-time.md) - feeding the grid the rows that `pushChanged` reports.
