# Change review - Enterprise

An AI helper fills 900 empty cells, an agent cleans up a CRM export, an import
updates 2,000 rows. None of those writes was typed by the person who owns the
data, and none of them should land before someone has looked. Change review
holds such writes as **proposals**, apart from the data, groups them by what
they do, and lets a person accept or reject a group at a time. Only accepted
values are written, and each decision is one Ctrl+Z.

```ts
import { createReview, reviewSmartFill, SvReviewPanel } from '@svgrid/enterprise/review'
```

<div data-docs-demo="702-change-review" data-height="620"></div>

In the demo, **Run cleanup agent** proposes fixes to a customer table. Nothing
is written until you accept a group in the panel. Edit a cell that has a
proposal before accepting it and the proposal is marked stale. **Import
crm-update.csv** proposes a different region for two customers the agent also
filled, and the panel asks which one to keep.

## A grid with a review

```svelte
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'
  import { createReview, SvReviewPanel } from '@svgrid/enterprise/review'

  let rows = $state(customers)
  let api = $state<SvGridApi<any, Customer> | null>(null)

  const review = createReview<Customer>({
    api: () => api,
    setRows: (next) => (rows = next),
    onCommit: async (accepted) => {
      await fetch('/api/customers/bulk', { method: 'PATCH', body: JSON.stringify(accepted) })
    },
  })
</script>

<div class="layout">
  <SvGrid
    data={rows}
    columns={review.columns(columns)}
    getRowId={(r) => r.id}
    conditionalFormats={review.formats}
    onApiReady={(a) => (api = a)}
  />
  <SvReviewPanel {review} />
</div>
```

Three things are required:

- **`getRowId` on the grid.** Proposals are keyed by row id, because row
  positions move on sort, filter and insert. `createReview` reads the function
  from the grid and throws a clear error when it is missing.
- **The app owns the rows.** `setRows` replaces the array the grid is given,
  and it must apply synchronously. Reads go through `api.getData()`, which
  includes the grid's own writes (a paste, a fill, `addRows`), so building the
  next array from it carries those forward.
- **The grid api**, passed as a getter, because `onApiReady` fires after mount.

## Adding proposals

Anything can add a set of proposals. Each one names the row, the field, the
value it saw (`before`) and the value it proposes (`after`):

```ts
review.add({
  source: { kind: 'agent', id: 'crm-cleanup', label: 'Cleanup agent' },
  proposals: [
    { rowId: 'c-104', field: 'company', before: 'Acme Inc.', after: 'Acme Inc' },
    { rowId: 'c-221', field: 'phone', before: '(555) 123-4567', after: '555-123-4567', reason: 'one phone format' },
  ],
})
```

`confidence` (0 to 1) and `reason` are optional and show in the panel.
Proposals whose `after` equals `before` are skipped. A newer proposal from the
same source for the same cell replaces the older one. Two sources proposing
different values for one cell is a **conflict**: neither can be accepted by a
group action until a person keeps one.

### From the AI helpers

The AI helpers in `@svgrid/grid` return predictions keyed by data index.
`reviewSmartFill` and `reviewClassify` snapshot the data before the call,
resolve each index to its row id, drop indices the helper was not asked about,
and add the result:

```ts
const result = await reviewSmartFill(review, api, {
  field: 'region',
  examples: [{ input: { country: 'Germany' }, output: 'EMEA' }],
})
result.dropped   // predictions that pointed at rows outside the request
```

`fromSmartFill(result, snapshot, { api })` and `fromClassify` do the same for a
result you already have; pass the snapshot you took before calling the helper.

### From an import or a sync

`fromRows` diffs incoming rows against the grid's data by a key field and
proposes one change per field that differs:

```ts
const set = fromRows(imported.rows, {
  api,
  key: 'id',
  source: { kind: 'import', id: file.name, label: file.name },
})
review.add(set)
set.unmatched   // incoming rows with no match; adding rows is not proposed yet
```

## How proposals are grouped

The panel never shows 2,000 cells in a list. `review.groups()` puts every
pending proposal in one group by the change it makes. The first four kinds are
**rule groups**: every member is proven to follow the rule. The rest are
**judgment groups**, where a person has to look.

| Kind | Rule | Label in the panel |
|---|---|---|
| `whitespace` | `after` is `before` trimmed or with spaces collapsed | Trim spaces in Company |
| `case` | same letters, different case | Change Email to lower case |
| `format` | same characters apart from punctuation, the same unambiguous date, or text that parses to the number | Reformat Phone as 999-999-9999 |
| `scale` | `after / before` is one number, 5 or more members | Divide Revenue by 100 |
| `same-mapping` | several `before` values each mapped to one `after` at least twice | Country: 6 values → "United States" |
| `fill-empty` | blank `before`, one group per proposed value | Fill empty Region with "EMEA" |
| `constant-target` | many different `before` values, one `after` | Set Status to "Closed" |
| `unpatterned` | everything else, per field | Notes: no shared pattern |

A few cases are kept out of the rule groups on purpose. `"3.5"` to `"35"` keeps
every digit but changes the number, so it is not a format change. `03/05/2024`
could be March or May, so a reformat of it is never proven. A rule group proves
that every member follows its rule, not that the rule is right: an agent that
divides by 10 where it should divide by 100 shows up as its own "Divide Revenue
by 10" group, labelled for what it does.

The panel lists the risky groups first: unpatterned, then one target from many
values, then groups with low confidence, then the rest by size. Each group
carries a sample to check: every member below 60% confidence (up to ten), then
members spread across the group. An unpatterned group lists every member.
`same-mapping` and `constant-target` groups show which `before` values they
map, so "everything became Canada" is visible at a glance.

## What the grid shows

`review.formats` tints every cell with a pending proposal and draws a dot before
its value, so the mark is never colour alone. Pass it as `conditionalFormats`,
concatenated with your own formats if you have them. Theme the tint with
`--sg-review-pending-bg`.

`review.columns(columns)` draws the proposal inside the cell: the proposed
value, then the current value struck through. It does this by wrapping the
column's `cell`, and only for columns where that leaves the rest of the column
as it was: columns with a `cell` of their own, and plain text columns.
Checkbox, list, chips, sparkline, boolean and field-type columns keep the tint
and the dot, and the panel shows their values.

## Deciding

```ts
const outcome = await review.acceptGroup(group.key, group.ids)
// { accepted: [...], rejected: [], stale: [...], skipped: [...], error? }
```

On accept, for each proposal:

1. An open cell editor is committed first, so a value someone just typed wins.
   Under `fullRowEditing`, the row being edited is left pending instead.
2. If the cell no longer holds `before`, the proposal becomes **stale** and is
   not written.
3. `onCommit` receives the remaining proposals. Throw or reject to keep them
   pending; nothing is written.
4. The cells are checked again, because a person could edit one while
   `onCommit` was saving.
5. One `setRows` call writes every accepted value.
6. One undo step is recorded. Ctrl+Z in the grid writes the old values back,
   by row id, so it works with paging and filters on, and returns the proposals
   to pending. A cell edited after the accept is left as it is.

`acceptGroup` and `rejectGroup` take the ids that were shown, so a proposal
that arrived after the panel rendered is never decided unseen.

### Server row model

With the server row model there is no app array to replace. Pass the
controller instead of `setRows`; `onCommit` is then required:

```ts
const review = createReview({
  api: () => api,
  server: controller,
  onCommit: (accepted) => saveToServer(accepted),
})
```

Accept saves through `onCommit` and refreshes the controller. Undo saves the
inverse (`before` and `after` swapped) and refreshes again. The backend decides
staleness there.

## SvReviewPanel

| Prop | Type | Default | |
|---|---|---|---|
| `review` | `Review` | required | What `createReview` returned. |
| `title` | `string` | `'Review changes'` | The panel heading. |
| `confirmOver` | `number` | `50` | Ask before deciding more than this many at once. |
| `onDecide` | `(outcome) => void` | | Called after each decision. |

It is a plain panel, not a drawer, so the grid stays usable beside it. Inside
the group list, **J** and **K** move between groups, **Enter** opens one, **A**
accepts it and **R** rejects it. "Show in grid" scrolls to the group's rows on
the current page without moving the active cell, and says how many are on
other pages.

## Saving and routing a review

`review.toJSON()` returns every set with its proposals and their status, as
plain JSON. `review.load(json)` restores it, in another session or for another
person to decide.

## Licensing

Change review is part of SvGrid Enterprise. Without a license key it runs with
a watermark and a one-time notice. It adds nothing to `@svgrid/grid`: the tint
is `conditionalFormats`, the proposed value is a wrapped `cell`, and the undo
step goes through the grid's public command context.

## See also

- [AI helpers](../ai.md)
- [Undo and redo](../editing/undo-redo.md)
- [Conditional formatting](../cells/conditional-formatting.md)
- [Server-side row model](../server/server-row-model.md)
