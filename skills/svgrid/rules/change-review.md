# Change review (Enterprise)

Writes nobody typed (an AI helper's output, an agent's edits, an import) go
through a **change review**: they are held as proposals, grouped by what they
change, and only written when a person accepts them. Import from
`@svgrid/enterprise/review`; it needs `@svgrid/enterprise`.

## Wire it to app-owned rows

```svelte
<script lang="ts">
  import { SvGrid, type SvGridApi } from '@svgrid/grid'
  import { createReview, SvReviewPanel } from '@svgrid/enterprise/review'

  let rows = $state(initialRows)
  let api = $state<SvGridApi<any, Order> | null>(null)
  const review = createReview<Order>({
    api: () => api,                       // a getter: onApiReady fires after mount
    setRows: (next) => (rows = next),     // must apply synchronously
    onCommit: async (accepted) => save(accepted), // optional: persist first
  })
</script>

<!-- ✅ getRowId is required; columns and conditionalFormats come from the review. -->
<SvGrid
  data={rows}
  columns={review.columns(columns)}
  getRowId={(r) => r.id}
  conditionalFormats={review.formats}
  onApiReady={(a) => (api = a)}
/>
<SvReviewPanel {review} />
```

- **The grid api arrives through `onApiReady`**, not `bind:api`.
- **`getRowId` on the grid is required.** Proposals are keyed by row id;
  `createReview` throws a clear error without it.
- **Accepted values go through `setRows`**, never `api.setCellValue`: grid
  writes are view-indexed and the next `data` prop discards them.
- With a server row model, pass `server: controller` instead of `setRows`;
  `onCommit` is then required.

## Feed it proposals

```ts
// ✅ An AI helper: snapshot, call, add as proposals (indices resolved to row ids).
await reviewSmartFill(review, api, { field: 'region', examples })

// ✅ An import: one proposal per changed field, matched by key.
review.add(fromRows(imported, { api, key: 'id', source: { kind: 'import', id: file.name, label: file.name } }))

// ✅ Anything else: rowId, field, before (what the cell holds), after.
review.add({ source: { kind: 'agent', id: 'cleanup', label: 'Cleanup agent' }, proposals })
```

```ts
// ❌ Wrong - an agent writing straight to the data skips the review.
api.setCellValue(rowIndex, 'region', guess)
```

## Agents get tools that only propose

`createGridTools({ review, api: () => api, fields })` returns
`grid_describe`, `grid_query_rows`, `grid_propose_edits` and
`grid_review_status` as `{ name, description, inputSchema, execute }` for any
tool-use loop; `registerWebMcpTools(tools)` registers them with WebMCP where a
browser has it. None of them writes the data.

## Facts to keep straight

- Accept checks every cell still holds `before`, before and after `onCommit`;
  a changed cell is reported `stale` and never overwritten. Each decision is
  one Ctrl+Z in the grid.
- `onDecision` is where an audit log goes; `revertSet(setId)` proposes undoing
  a set later; `toJSON({ setIds })` and `merge(json)` route sets to an
  approver.
- In SvGrid Base add `onApply: baseReviewApplied(() => api)` (from
  `@svgrid/enterprise/base`) so accepts stamp "last modified" and the record
  activity.
- The panel names each change's row by its first visible text column; pass
  `createReview({ rowLabel: (row) => row.company })` when that is not the
  right name.
- `review.formats` marks pending cells (amber, a dot) and cells two sources
  disagree on (red, "!"). Concatenate it with the app's own
  `conditionalFormats` rather than replacing them.
- Wording: `createReview({ messages })`, keys and English text in
  `REVIEW_MESSAGES`.
