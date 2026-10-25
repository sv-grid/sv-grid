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

### `interface Review`

What `createReview` returns: the proposals, their groups, the decisions,
and what the grid takes (`columns`, `formats`). Every read is reactive.

```ts
export interface Review<TData = unknown> {
  /** Bumped on every change, for code that caches what it reads. */
  readonly version: number
  /** The wording in effect: English with `messages` laid over it. */
  readonly messages: ReviewMessages
  /** The last undo or redo whose save failed, or null. */
  readonly lastError: { error: unknown; during: 'undo' | 'redo'; at: number } | null
  /** Add a change set; a cell that already has a live proposal from another source becomes a conflict. */
  add(input: AddInput): ChangeSet
  /** One proposal by id. */
  get(id: string): Proposal | undefined
  /** Every proposal of the session, whatever its status. */
  proposals(): Proposal[]
  /** What names a proposal's row (`rowLabel`), or null. */
  rowLabel(p: Proposal): string | null
  /** A field's column header, as the group labels show it. */
  fieldLabel(field: string): string
  /** The proposals waiting for a decision. */
  pending(): Proposal[]
  /** The proposals two sources disagree on, to settle with `resolveConflict`. */
  conflicts(): Proposal[]
  /** The pending proposals grouped by the change they make, the groups that need a person first. */
  groups(): ProposalGroup[]
  /** The pending proposal for one cell, if there is one. */
  pendingFor(rowId: string, field: string): Proposal | undefined
  /** Write these proposals: checks each cell still holds `before`, before and after `onCommit`. One undo step. */
  accept(ids: ReadonlyArray<string>): Promise<ReviewOutcome>
  /** Decide against these proposals; nothing is written. One undo step. */
  reject(ids: ReadonlyArray<string>): ReviewOutcome
  /** Accept a group, limited to the ids the person was shown, so a proposal added since is not decided unseen. */
  acceptGroup(key: string, shownIds: ReadonlyArray<string>): Promise<ReviewOutcome>
  /** Reject a group, limited to the ids the person was shown. */
  rejectGroup(key: string, shownIds: ReadonlyArray<string>): ReviewOutcome
  /** Keep one of a cell's conflicting proposals (it becomes pending) and reject the rest, as one undo step. */
  resolveConflict(keepId: string): void
  /** `conditionalFormats` for the grid: pending cells tinted, conflicting cells marked, the row "Show in grid" lands on lit. */
  readonly formats: ConditionalFormat<any>[]
  /** The grid's columns with the proposed value drawn in each pending cell. */
  columns<C extends ReadonlyArray<any>>(cols: C): C
  /** Show the next proposal of `ids` after `fromId` in the grid, on whatever page it is. */
  reveal(ids: ReadonlyArray<string>, fromId?: string): { id: string | null; hidden: number }
  /** Show only rows with a pending or conflicting proposal, on top of the user's own filters. */
  showPendingOnly(on: boolean): void
  /** Whether `showPendingOnly` is on (the grid's own Clear turns it off too). */
  readonly pendingOnly: boolean
  /** Every set with its proposals and their status, as plain JSON; `setIds` exports only some. */
  toJSON(opts?: { setIds?: ReadonlyArray<string> }): ReviewJSON
  /** Replace everything with an export; returns how many malformed proposals were dropped. */
  load(json: ReviewJSON): { dropped: number }
  /** Add the sets of an export, keeping what is here; returns how many were dropped. */
  merge(json: ReviewJSON): { dropped: number }
  /** Every decided proposal (accepted, rejected or stale), oldest decision first. */
  log(): Proposal[]
  /** Propose undoing what a set wrote, as a new set to review; null when nothing of it was accepted. */
  revertSet(setId: string): ChangeSet | null
  /** The sets in this review, newest last, without their proposals. */
  sets(): Array<Omit<ChangeSet, 'proposals'> & { count: number }>
  /** Forget every proposal and set. */
  clear(): void
}
```

### `function createReview`

Hold writes nobody typed (an agent's edits, an import, an AI helper's
output) as proposals, grouped by the change they make, and write them only
when a person accepts them. Give the grid `review.columns(columns)` and
`review.formats`, and render `<SvReviewPanel {review} />` beside it. Each
decision is one Ctrl+Z in the grid.

```ts
export function createReview<TData = unknown>(opts: ReviewOptions<TData>): Review<TData>
```
