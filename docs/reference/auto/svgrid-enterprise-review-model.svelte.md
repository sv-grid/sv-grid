# `@svgrid/enterprise` · `review/model.svelte.ts`

Auto-generated. Source: `packages\enterprise\src\review\model.svelte.ts`.

### `type ReviewGridApi`

The part of the grid api a review uses. Any `SvGridApi` satisfies it.

```ts
export type ReviewGridApi = Pick<
  SvGridApi<any, any>,
  | 'getData' | 'getOption' | 'getActiveCell' | 'getRowId' | 'getColumns' | 'getCommandContext' | 'stopEditing' | 'scrollToRow' | 'getDisplayedRows'
  | 'getAdvancedFilter' | 'setAdvancedFilter'
  | 'getRowPosition' | 'getPageInfo' | 'setPage' | 'getState'
```

### `type ReviewOptions`

Options for `createReview`: the grid it reviews, how accepted values are
written (`setRows`, or `server` with `onCommit`), and what to call as
decisions are made.

```ts
export type ReviewOptions<TData> = {
  /** The grid api, or a getter for it (it is bound after mount). */
  api: ReviewGridApi | (() => ReviewGridApi | undefined | null)
  /** Replace the app's rows. Required unless `server` is set. Must apply synchronously. */
  setRows?: (next: TData[]) => void
  /**
   * Server row model: the controller passed to the grid as `rowModel`.
   * Accept and undo commit through `onCommit` and then refresh it.
   */
  server?: { refresh(): void }
  /** Persist accepted values. Reject (throw) to keep them pending. Required with `server`. */
  onCommit?: (accepted: Proposal[]) => void | Promise<void>
  /** Who decides, stamped on each decided proposal. */
  user?: string
  cluster?: ClusterOptions
  /** Wording of everything the review shows (panel, group labels, marks); English by default. */
  messages?: Partial<ReviewMessages>
  /**
   * Called after every decision, its undo and its redo, with copies of the
   * proposals it moved. Write these to an audit log of your own.
   */
  onDecision?: (decision: ReviewDecision) => void
  /**
   * Called as accepted values (or an undo / redo of them) are written, with
   * the proposals and the new rows just before they go to `setRows`, so
   * bookkeeping that edits a row lands in the same write. SvGrid Base stamps
   * "last modified" and notes the record's activity with
   * `baseReviewApplied(api)` from `@svgrid/enterprise/base`. With a server
   * row model there are no rows to edit: `rows` is undefined.
   */
  onApply?: (applied: Proposal[], how: 'accept' | 'undo' | 'redo', rows?: TData[]) => void
  /**
   * An undo or redo whose `onCommit` failed: nothing was written and the
   * decision stands. Also kept as `review.lastError`, which the panel announces.
   */
  onError?: (error: unknown, during: 'undo' | 'redo') => void
  /**
   * What names a row on the panel's lines, such as its company, so a reviewer
   * knows whose record a change is in. Default: the row's first visible text
   * column, left out when that column is the one the change is to.
   */
  rowLabel?: (row: TData) => string | null | undefined
}
```

### `type ReviewDecision`

One decision, its undo or its redo, as `onDecision` receives it, with copies
of the proposals it moved. Write these to an audit log.

```ts
export type ReviewDecision = {
  action: 'accept' | 'reject' | 'undo' | 'redo'
  /** For undo / redo: which decision was undone or redone. */
  of?: 'accept' | 'reject'
  proposals: Proposal[]
  by?: string
  at: number
}
```

### `type ReviewOutcome`

What an accept or a reject did, by proposal id: accepted, rejected, stale
(the cell changed before the write), committed and then found stale, or
skipped; and what `onCommit` threw, if it did.

```ts
export type ReviewOutcome = {
  accepted: string[]
  rejected: string[]
  /** The cell changed since the proposal was made, or its row is gone. Never written. */
  stale: string[]
  /** Left pending: the row is being edited, the proposal is already being accepted, or the grid is not ready. */
  skipped: string[]
  /**
   * Saved by `onCommit`, then not written here because the cell changed while
   * it was saving. The backend holds the proposed value; reload or save the
   * cell's value back.
   */
  committedStale: string[]
  /** What `onCommit` threw; nothing was written and the proposals stay pending. */
  error?: unknown
}
```

### `type AddInput`

A change set for `review.add`: where it came from, an optional title and
id, and its proposals.

```ts
export type AddInput = {
  source: ProposalSource
  title?: string
  id?: string
  proposals: ReadonlyArray<ProposalInput>
}
```

### `type ReviewJSON`

A review's change sets as `review.toJSON()` writes them and `review.load` /
`review.merge` read them, to route a review to an approver.

```ts
export type ReviewJSON = { v: 1; sets: ChangeSet[] }
```

### `type Review`

What `createReview` returns.

```ts
export type Review<TData = unknown> = ReturnType<typeof createReview<TData>>
```

### `function createReview`

Hold writes nobody typed (an agent's edits, an import, an AI helper's
output) as proposals, grouped by the change they make, and write them only
when a person accepts them. Give the grid `review.columns(columns)` and
`review.formats`, and render `<SvReviewPanel {review} />` beside it. Each
decision is one Ctrl+Z in the grid.

```ts
export function createReview<TData = unknown>(opts: ReviewOptions<TData>)
```
