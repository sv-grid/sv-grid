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
export function createReview<TData = unknown>(opts: ReviewOptions<TData>) {
  if (!opts.setRows && !opts.server) throw new Error('[svgrid review] pass setRows (client data) or server (server row model)')
  if (opts.server && !opts.onCommit) throw new Error('[svgrid review] onCommit is required with a server row model')
  const msg = reviewMessages(opts.messages)
  // Without a key: watermark and a one-time nudge. The review still runs.
  nudgeEnterprise('Change review')
  // Proposed values beside rich cells (selects, ratings): registered by the
  // first review, so grids in apps without one keep the plain fast path.
  registerRichCellMarks()

  const all = new Map<string, Proposal>()
  const sets = new Map<string, Omit<ChangeSet, 'proposals'> & { ids: string[] }>()
  /** Live proposals (pending or in conflict) per cell. */
  const byCell = new Map<string, Set<string>>()
  const inFlight = new Set<string>()
  /** Decision order for the log: timestamps tie within one millisecond. */
  const decidedOrder = new Map<string, number>()
  let lastError = $state<{ error: unknown; during: 'undo' | 'redo'; at: number } | null>(null)
  function failed(error: unknown, during: 'undo' | 'redo') {
    lastError = { error, during, at: Date.now() }
    opts.onError?.(error, during)
  }
  let decisionSeq = 0
  const stamp = (p: Proposal) => decidedOrder.set(p.id, ++decisionSeq)
  let version = $state(0)
  // "Only rows with changes": our node ANDed onto the advanced filter. Put on
  // again after every change so the grid filters with the new pending set.
  const filterToken = nextId('rv-')
  let pendingOnly = $state(false)
  let filterNonce = 0
  let pendingRows: { v: number; ids: Set<string> } | null = null
  const pendingSource = { hasPendingRow: (rowId: string) => hasPendingRow(rowId) }
  function hasPendingRow(rowId: string): boolean {
    if (pendingRows?.v !== version) {
      const ids = new Set<string>()
      for (const p of all.values()) if (p.status === 'pending' || p.status === 'conflict') ids.add(p.rowId)
      pendingRows = { v: version, ids }
    }
    return pendingRows.ids.has(rowId)
  }
  function applyPendingFilter() {
    const api = getApi()
    if (!api) return
    const current = api.getAdvancedFilter()
    // The user's own filter tools may have dropped the node: then the toggle is off.
    if (filterNonce > 0 && !hasPending(current)) {
      pendingOnly = false
      return
    }
    api.setAdvancedFilter(withPending(current, filterToken, ++filterNonce))
  }
  const bump = () => {
    version += 1
    if (pendingOnly) applyPendingFilter()
  }

  /**
   * Show only rows with a pending or conflicting proposal, on top of the
   * user's own filters; off takes our condition back out and leaves theirs.
   * Rows leave the view as their proposals are decided.
   */
  function showPendingOnly(on: boolean): void {
    const api = getApi()
    if (!api) return
    if (on) {
      trackPendingSource(filterToken, pendingSource)
      filterNonce = 0
      pendingOnly = true
      api.setAdvancedFilter(withPending(api.getAdvancedFilter(), filterToken, ++filterNonce))
    } else {
      pendingOnly = false
      api.setAdvancedFilter(stripPending(api.getAdvancedFilter()))
    }
  }

  const getApi = (): ReviewGridApi | null =>
    (typeof opts.api === 'function' ? (opts.api as () => ReviewGridApi | undefined | null)() : opts.api) ?? null

  function rowIdFn(api: ReviewGridApi): (row: TData, index: number) => string {
    const fn = api.getOption('getRowId') as ((row: TData, index: number) => string) | undefined
    if (!fn) throw new Error('[svgrid review] the grid needs a getRowId prop: proposals are keyed by row id, and positions move on sort and filter')
    return fn
  }

  function indexRows(api: ReviewGridApi): Map<string, number> {
    const id = rowIdFn(api)
    const map = new Map<string, number>()
    api.getData().forEach((row, i) => map.set(String(id(row as TData, i)), i))
    return map
  }

  // ---- adding -------------------------------------------------------------

  function add(input: AddInput): ChangeSet {
    const linked = getApi()
    if (linked) linkCards(linked)
    const setId = input.id ?? nextId('cs-')
    const createdAt = Date.now()
    const ids: string[] = []
    for (const raw of input.proposals) {
      if (sameValue(raw.before, raw.after)) continue
      const p: Proposal = {
        ...raw,
        rowId: String(raw.rowId),
        id: raw.id ?? nextId('pr-'),
        op: 'update',
        source: input.source,
        // A merged proposal keeps when it was made.
        createdAt: typeof (raw as { createdAt?: unknown }).createdAt === 'number' ? (raw as unknown as { createdAt: number }).createdAt : createdAt,
        status: 'pending',
      }
      const key = cellKey(p.rowId, p.field)
      const live = byCell.get(key) ?? new Set<string>()
      for (const otherId of [...live]) {
        const other = all.get(otherId)!
        // Being accepted right now: leave it be. If it lands, the stale check
        // catches this one.
        if (inFlight.has(otherId)) continue
        if (other.source.id === p.source.id && other.status === 'pending') {
          // A newer proposal from the same producer replaces the older one
          // and keeps what the cell held when the first was made.
          p.before = other.before
          live.delete(otherId)
          all.delete(otherId)
          for (const set of sets.values()) {
            const at = set.ids.indexOf(otherId)
            if (at >= 0) set.ids.splice(at, 1)
          }
        } else {
          other.status = 'conflict'
          other.note = msg.noteConflict
          p.status = 'conflict'
          p.note = other.note
        }
      }
      if (p.status === 'pending' && sameValue(p.before, p.after)) continue
      live.add(p.id)
      byCell.set(key, live)
      all.set(p.id, p)
      ids.push(p.id)
    }
    sets.set(setId, { id: setId, title: input.title ?? input.source.label, source: input.source, createdAt, ids })
    bump()
    return { id: setId, title: input.title ?? input.source.label, source: input.source, createdAt, proposals: ids.map((i) => all.get(i)!) }
  }

  const leaveCell = (p: Proposal) => {
    const live = byCell.get(cellKey(p.rowId, p.field))
    live?.delete(p.id)
    if (live && !live.size) byCell.delete(cellKey(p.rowId, p.field))
  }
  const enterCell = (p: Proposal) => {
    const key = cellKey(p.rowId, p.field)
    byCell.set(key, (byCell.get(key) ?? new Set()).add(p.id))
  }

  // ---- reading ------------------------------------------------------------

  let groupCache: { v: number; groups: ProposalGroup[] } | null = null

  function fieldLabels(): (field: string) => string {
    const api = getApi()
    const cols = api?.getColumns() ?? []
    const map = new Map(cols.map((c) => [c.field ?? c.id, c.header || c.id]))
    return (f) => map.get(f) ?? f
  }

  const list = (status?: Proposal['status']) => {
    void version
    const out = [...all.values()]
    return status ? out.filter((p) => p.status === status) : out
  }

  function groups(): ProposalGroup[] {
    const v = version
    if (groupCache?.v === v) return groupCache.groups
    const g = clusterProposals(list('pending'), { fieldLabel: fieldLabels(), ...opts.cluster, messages: { ...opts.messages, ...opts.cluster?.messages } })
    groupCache = { v, groups: g }
    return g
  }

  function pendingFor(rowId: string, field: string): Proposal | undefined {
    void version
    for (const id of byCell.get(cellKey(rowId, field)) ?? []) {
      const p = all.get(id)
      if (p?.status === 'pending') return p
    }
    return undefined
  }

  // ---- deciding -----------------------------------------------------------

  const outcome = (): ReviewOutcome => ({ accepted: [], rejected: [], stale: [], skipped: [], committedStale: [] })

  /** Drop proposals whose cell no longer holds `before`. */
  function freshOnly(ps: Proposal[], out: ReviewOutcome, api: ReviewGridApi | null): Proposal[] {
    if (!api) return ps
    const data = api.getData()
    const index = indexRows(api)
    return ps.filter((p) => {
      const i = index.get(p.rowId)
      if (i === undefined) {
        // A server row model only holds the loaded rows; the backend decides there.
        if (opts.server) return true
        markStale(p, msg.noteRowGone, out)
        return false
      }
      const current = (data[i] as Record<string, unknown>)[p.field]
      if (sameValue(current, p.before)) return true
      markStale(p, msg.noteCellChanged, out)
      return false
    })
  }

  function markStale(p: Proposal, note: string, out: ReviewOutcome) {
    p.status = 'stale'
    p.note = note
    p.decidedAt = Date.now()
    stamp(p)
    leaveCell(p)
    out.stale.push(p.id)
  }

  /** Write `value` per (rowId, field) into a copy of the grid's current data. */
  function writeValues(api: ReviewGridApi, writes: ReadonlyArray<readonly [string, string, unknown]>, beforeSet?: (next: TData[]) => void) {
    const data = api.getData()
    const index = indexRows(api)
    const next = data.slice() as TData[]
    const copied = new Set<number>()
    for (const [rowId, field, value] of writes) {
      const i = index.get(rowId)
      if (i === undefined) continue
      if (!copied.has(i)) {
        next[i] = { ...(next[i] as object) } as TData
        copied.add(i)
      }
      ;(next[i] as Record<string, unknown>)[field] = value
    }
    if (!copied.size) return
    beforeSet?.(next)
    opts.setRows!(next)
  }

  function currentValue(api: ReviewGridApi, index: Map<string, number>, p: Proposal): unknown {
    const i = index.get(p.rowId)
    return i === undefined ? undefined : (api.getData()[i] as Record<string, unknown>)[p.field]
  }

  /**
   * What an open editor could write back over. A cell editor is committed
   * first (`stopEditing`), so its value lands and the stale check sees it. A
   * full-row draft has no public commit, so its row is left alone.
   */
  function editedRow(api: ReviewGridApi | null): string | null {
    if (!api) return null
    api.stopEditing(false)
    if (!api.getOption('fullRowEditing')) return null
    const active = api.getActiveCell()
    return active ? api.getRowId(active.rowIndex) : null
  }

  async function accept(ids: ReadonlyArray<string>): Promise<ReviewOutcome> {
    const out = outcome()
    const api = getApi()
    if (!api && !opts.server) {
      for (const id of ids) {
        const p = all.get(id)
        if (p?.status !== 'pending') continue
        p.note = msg.noteGridNotReady
        out.skipped.push(id)
      }
      bump()
      return out
    }
    const busyRow = editedRow(api)
    let take: Proposal[] = []
    for (const id of ids) {
      const p = all.get(id)
      if (!p || p.status !== 'pending') continue
      if (inFlight.has(id) || (busyRow !== null && p.rowId === busyRow)) {
        if (!inFlight.has(id)) p.note = msg.noteRowEditing
        out.skipped.push(id)
        continue
      }
      take.push(p)
    }
    take = freshOnly(take, out, api)
    if (!take.length) {
      bump()
      return out
    }
    for (const p of take) inFlight.add(p.id)
    try {
      if (opts.onCommit) await opts.onCommit(take.map((p) => ({ ...p })))
    } catch (error) {
      for (const p of take) inFlight.delete(p.id)
      bump()
      return { ...out, error }
    }
    for (const p of take) inFlight.delete(p.id)
    // The await let other writes in: check again before writing. What
    // onCommit already saved but cannot be written now is told apart.
    if (!opts.server) {
      const saved = take.filter((p) => p.status === 'pending')
      const late = outcome()
      take = freshOnly(saved, late, api)
      for (const id of late.stale) {
        const p = all.get(id)!
        if (opts.onCommit) {
          p.note = msg.noteSavedStale
          out.committedStale.push(id)
        } else out.stale.push(id)
      }
    }
    if (!take.length) {
      bump()
      return out
    }
    if (opts.setRows && api) writeValues(api, take.map((p) => [p.rowId, p.field, p.after] as const), (next) => opts.onApply?.(take, 'accept', next))
    else {
      opts.server?.refresh()
      opts.onApply?.(take, 'accept')
    }
    const at = Date.now()
    for (const p of take) {
      p.status = 'accepted'
      p.note = undefined
      p.decidedBy = opts.user
      p.decidedAt = at
      stamp(p)
      leaveCell(p)
      out.accepted.push(p.id)
    }
    recordUndo(api, take, 'accepted')
    decided('accept', take)
    bump()
    return out
  }

  function decided(action: ReviewDecision['action'], ps: Proposal[], of?: ReviewDecision['of']) {
    if (ps.length) opts.onDecision?.({ action, of, proposals: ps.map((p) => ({ ...p })), by: opts.user, at: Date.now() })
  }

  function reject(ids: ReadonlyArray<string>): ReviewOutcome {
    const out = outcome()
    const at = Date.now()
    const taken: Proposal[] = []
    // What each proposal was before, so an undo puts a conflict back as one.
    const was = new Map<string, ProposalStatus>()
    for (const id of ids) {
      const p = all.get(id)
      if (!p || (p.status !== 'pending' && p.status !== 'conflict') || inFlight.has(id)) continue
      was.set(p.id, p.status)
      p.status = 'rejected'
      p.decidedBy = opts.user
      p.decidedAt = at
      stamp(p)
      leaveCell(p)
      taken.push(p)
      out.rejected.push(id)
    }
    if (taken.length) recordUndo(getApi(), taken, 'rejected', was)
    decided('reject', taken)
    bump()
    return out
  }

  /**
   * One Ctrl+Z for the whole decision, by row id, so it works with paging and
   * filters on. Undoing an accept writes `before` back only where the cell
   * still holds `after`; anything edited since is left as it is. With
   * `onCommit`, the reversed values are saved first and written once that
   * resolves, the way an accept is.
   */
  function recordUndo(api: ReviewGridApi | null, ps: Proposal[], kind: 'accepted' | 'rejected', was?: Map<string, ProposalStatus>) {
    if (!api) return
    const prior = new Map(ps.map((p) => [p.id, { decidedBy: p.decidedBy, decidedAt: p.decidedAt }]))
    const undecided = (p: Proposal): ProposalStatus => was?.get(p.id) ?? 'pending'
    const flip = (undo: boolean, which: Proposal[]) => {
      for (const p of which) {
        if (undo) {
          p.status = undecided(p)
          p.decidedBy = undefined
          p.decidedAt = undefined
          // A proposal dropped since (clear, load) stays out of the cell index.
          if (all.get(p.id) === p) enterCell(p)
        } else {
          p.status = kind
          Object.assign(p, prior.get(p.id))
          leaveCell(p)
        }
      }
      decided(undo ? 'undo' : 'redo', which, kind === 'accepted' ? 'accept' : 'reject')
      bump()
    }
    const move = (undo: boolean) => {
      const live = ps.filter((p) => (undo ? p.status === kind : p.status === undecided(p)))
      if (kind === 'rejected') return flip(undo, live)
      const from = undo ? 'after' : 'before'
      const to = undo ? 'before' : 'after'
      const how = undo ? 'undo' : 'redo'
      if (opts.server) {
        const inverse = live.map((p) => ({ ...p, before: p[from], after: p[to] }))
        Promise.resolve(opts.onCommit!(inverse)).then(() => {
          opts.server!.refresh()
          flip(undo, live)
          opts.onApply?.(live, how)
        }, (error) => failed(error, how))
        return
      }
      // One row index per pass (rebuilt after an async save), not one per proposal.
      const holdsIn = () => {
        const index = indexRows(api)
        return (p: Proposal) => sameValue(currentValue(api, index, p), p[from])
      }
      const write = (ok: Proposal[]) => {
        if (!ok.length) return
        writeValues(api, ok.map((p) => [p.rowId, p.field, p[to]] as const), (next) => opts.onApply?.(ok, how, next))
        flip(undo, ok)
      }
      const ok = live.filter(holdsIn())
      if (!opts.onCommit) return write(ok)
      // The backend holds the accepted values: save the reverse there first.
      Promise.resolve(opts.onCommit(ok.map((p) => ({ ...p, before: p[from], after: p[to] })))).then(
        () => write(ok.filter(holdsIn())),
        (error) => failed(error, how),
      )
    }
    api.getCommandContext().recordUndo(
      () => move(true),
      () => move(false),
    )
  }

  function groupIds(key: string, shownIds: ReadonlyArray<string>): string[] {
    const g = groups().find((x) => x.key === key)
    if (!g) return []
    const members = new Set(g.ids)
    return shownIds.filter((id) => members.has(id))
  }

  /**
   * Keep one of a cell's conflicting proposals (it becomes pending) and reject
   * the rest, as one undo step that puts all of them back in conflict.
   */
  function resolveConflict(keepId: string): void {
    const keep = all.get(keepId)
    if (!keep || keep.status !== 'conflict') return
    const rivals = [...(byCell.get(cellKey(keep.rowId, keep.field)) ?? [])]
      .filter((id) => id !== keepId && !inFlight.has(id))
      .map((id) => all.get(id))
      .filter((p): p is Proposal => p?.status === 'conflict')
    const note = keep.note
    const apply = (resolved: boolean) => {
      const at = Date.now()
      for (const r of rivals) {
        if (resolved) {
          r.status = 'rejected'
          r.decidedBy = opts.user
          r.decidedAt = at
          stamp(r)
          leaveCell(r)
        } else {
          r.status = 'conflict'
          r.decidedBy = undefined
          r.decidedAt = undefined
          if (all.get(r.id) === r) enterCell(r)
        }
      }
      keep.status = resolved ? 'pending' : 'conflict'
      keep.note = resolved ? undefined : note
      bump()
    }
    apply(true)
    decided('reject', rivals)
    getApi()?.getCommandContext().recordUndo(
      () => apply(false),
      () => apply(true),
    )
  }

  // ---- serialising --------------------------------------------------------

  /**
   * Every set with its proposals and their status, as plain JSON. Pass
   * `setIds` to export only some, to hand them to someone else to decide.
   */
  function toJSON(opts: { setIds?: ReadonlyArray<string> } = {}): ReviewJSON {
    const only = opts.setIds ? new Set(opts.setIds) : null
    return {
      v: 1,
      sets: [...sets.values()].filter((set) => !only || only.has(set.id)).map(({ ids, ...meta }) => ({
        ...meta,
        proposals: ids.map((i) => all.get(i)).filter((p): p is Proposal => !!p).map((p) => ({ ...p })),
      })),
    }
  }

  /**
   * Replace everything with an export. The export is checked first: a wrong
   * shape throws and leaves the review as it was; a malformed proposal is
   * dropped. Returns how many were dropped.
   */
  function load(json: ReviewJSON): { dropped: number } {
    const { sets: valid, dropped } = checkExport(json)
    clear()
    for (const set of valid) {
      sets.set(set.id, { id: set.id, title: set.title, source: set.source, createdAt: set.createdAt, ids: set.proposals.map((p) => p.id) })
      for (const p of set.proposals) {
        all.set(p.id, { ...p })
        if (p.status === 'pending' || p.status === 'conflict') enterCell(p)
      }
    }
    bump()
    return { dropped }
  }

  /**
   * Add the sets of an export to this review, keeping what is here: an
   * approver's page merges what the author exported. A set already present is
   * skipped. Pending proposals go through the same rules as `add` (a cell
   * with a live proposal from another source becomes a conflict); decided ones
   * are kept as history.
   */
  function merge(json: ReviewJSON): { dropped: number } {
    const { sets: valid, dropped } = checkExport(json)
    for (const set of valid) {
      if (sets.has(set.id)) continue
      const live = set.proposals.filter((p) => p.status === 'pending' || p.status === 'conflict')
      const history = set.proposals.filter((p) => !live.includes(p) && !all.has(p.id))
      add({ id: set.id, title: set.title, source: set.source, proposals: live.filter((p) => !all.has(p.id)) })
      sets.get(set.id)!.createdAt = set.createdAt
      for (const p of history) all.set(p.id, { ...p })
      sets.get(set.id)!.ids.push(...history.map((p) => p.id))
    }
    bump()
    return { dropped }
  }

  // ---- history ------------------------------------------------------------

  /** Every decided proposal (accepted, rejected or stale), oldest decision first. */
  function log(): Proposal[] {
    void version
    return [...all.values()]
      .filter((p) => p.status === 'accepted' || p.status === 'rejected' || p.status === 'stale')
      .sort((a, b) => (a.decidedAt ?? 0) - (b.decidedAt ?? 0) || (decidedOrder.get(a.id) ?? 0) - (decidedOrder.get(b.id) ?? 0))
      .map((p) => ({ ...p }))
  }

  /**
   * Propose undoing what a set wrote, after the fact: a new set with each
   * accepted proposal reversed (`after` back to `before`). It is reviewed and
   * accepted like any other set, so the stale check keeps a later edit.
   * Returns null when nothing of the set was accepted.
   */
  function revertSet(setId: string): ChangeSet | null {
    const set = sets.get(setId)
    if (!set) return null
    const accepted = set.ids.map((id) => all.get(id)).filter((p): p is Proposal => p?.status === 'accepted')
    if (!accepted.length) return null
    return add({
      source: { kind: 'user', id: `revert:${setId}`, label: `Revert: ${set.title}` },
      title: `Revert: ${set.title}`,
      proposals: accepted.map((p) => ({ rowId: p.rowId, field: p.field, before: p.after, after: p.before, reason: `reverts ${p.source.label}` })),
    })
  }

  /** The sets in this review, newest last, without their proposals. */
  function sets_(): Array<Omit<ChangeSet, 'proposals'> & { count: number }> {
    void version
    return [...sets.values()].map(({ ids, ...meta }) => ({ ...meta, count: ids.length }))
  }

  function clear(): void {
    all.clear()
    sets.clear()
    byCell.clear()
    bump()
  }

  // ---- grid display -------------------------------------------------------

  /** A card's mark (board, gallery): how many proposals its row has and what they set. */
  let liveByRow: { v: number; rows: Map<string, Proposal[]> } | null = null
  function cardMark(rowId: string): CardMark | null {
    if (liveByRow?.v !== version) {
      const rows = new Map<string, Proposal[]>()
      for (const p of all.values()) {
        if (p.status !== 'pending' && p.status !== 'conflict') continue
        const list = rows.get(p.rowId)
        if (list) list.push(p)
        else rows.set(p.rowId, [p])
      }
      liveByRow = { v: version, rows }
    }
    const ps = liveByRow.rows.get(rowId)
    if (!ps) return null
    const labels = fieldLabels()
    return {
      count: ps.length,
      label: fill(msg.cardProposed, { count: ps.length }),
      text: ps.map((p) => `${labels(p.field)} → ${showValue(p.after, msg.empty)}`).join(', '),
    }
  }
  /** Whether a row object is in the grid's data (cached per data array). */
  let owned: { data: ReadonlyArray<unknown>; rows: WeakSet<object> } | null = null
  function owns(row: unknown): boolean {
    const data = getApi()?.getData()
    if (!data || !row || typeof row !== 'object') return false
    if (owned?.data !== data) owned = { data, rows: new WeakSet(data.filter((r): r is object => !!r && typeof r === 'object')) }
    return owned.rows.has(row)
  }
  let marksFor: unknown = null
  /** Register for the board and gallery cards of the grid, once its getRowId is known. */
  function linkCards(api: ReviewGridApi) {
    const fn = api.getOption('getRowId') as object | undefined
    if (fn && fn !== marksFor) {
      marksFor = fn
      registerCardMarks(fn, {
        cardMark,
        owns,
        cellProposal: (rowId, field) => {
          const p = pendingFor(rowId, field)
          return p ? { after: p.after, source: p.source.label, reason: p.reason, proposes: msg.proposes, empty: msg.empty } : null
        },
      })
    }
  }

  /** The row "Show in grid" just landed on; it flashes for a moment so the eye finds it. */
  let flashRow = $state<string | null>(null)
  let flashTimer: ReturnType<typeof setTimeout> | undefined
  function flash(rowId: string) {
    flashRow = rowId
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => (flashRow = null), 1600)
  }

  const formats = $derived.by((): ConditionalFormat<any>[] => {
    void version
    const api = getApi()
    if (!api || !api.getOption('getRowId')) return []
    linkCards(api)
    const idOf = rowIdFn(api)
    const cols = api.getColumns()
    const out = pendingFormats(list('pending'), idOf, cols)
    // After the pending tint, so a disputed cell reads as disputed.
    out.push(...pendingFormats(list('conflict'), idOf, cols, { background: CONFLICT_BG, icon: CONFLICT_ICON }))
    const lit = flashRow
    // Last, so it wins over the pending tint; every column of the row.
    if (lit !== null) out.push({ type: 'rule', when: ({ row }: { row: TData }) => String(idOf(row, 0)) === lit, background: FLASH_BG })
    return out
  })

  /** Pending-field set as a string, so `columns()` rebuilds only when it changes. */
  const pendingFields = $derived.by(() => {
    void version
    return [...new Set(list('pending').map((p) => p.field))].sort().join(SEP)
  })

  /** The first non-blank value of `field`, so a boolean column is never wrapped. */
  function sampleValue(field: string): unknown {
    for (const row of getApi()?.getData() ?? []) {
      const v = (row as Record<string, unknown>)[field]
      if (v != null && v !== '') return v
    }
    return undefined
  }

  let columnsCache: { input: unknown; fields: string; output: unknown } | null = null
  function columns<C extends ReadonlyArray<any>>(cols: C): C {
    // The grid reads its columns in every view (table, board, gallery), so cards link here too.
    const linked = getApi()
    if (linked) linkCards(linked)
    const fields = pendingFields
    if (columnsCache && columnsCache.input === cols && columnsCache.fields === fields) return columnsCache.output as C
    const output = wrapColumns(cols, new Set(fields ? fields.split(SEP) : []), review, sampleValue)
    columnsCache = { input: cols, fields, output }
    return output
  }

  // ---- navigation ---------------------------------------------------------

  /**
   * Show the next proposal of `ids` after `fromId`, on whatever page it is:
   * with client paging the grid moves to its page (`api.getRowPosition`),
   * then scrolls to it. Does not move the active cell. With grouping, where
   * pages are counted in groups, it stays on the current page. Returns the id
   * shown and how many of `ids` cannot be shown (filtered out, or on another
   * page of a grouped grid).
   */
  function reveal(ids: ReadonlyArray<string>, fromId?: string): { id: string | null; hidden: number } {
    const api = getApi()
    if (!api) return { id: null, hidden: ids.length }
    const proposals = ids.map((i) => all.get(i)).filter((p): p is Proposal => !!p)
    const grouped = (api.getState().grouping?.length ?? 0) > 0
    // The grid pages with `pageable`, or the older `showPagination`.
    const paged = !!(api.getOption('pageable') ?? api.getOption('showPagination')) && !api.getOption('externalPagination')
    let reachable: Array<{ p: Proposal; position: number }>
    if (grouped) {
      const idFn = rowIdFn(api)
      const onPage = new Set(api.getDisplayedRows().map((r, i) => String(idFn(r as TData, i))))
      reachable = proposals.filter((p) => onPage.has(p.rowId)).map((p) => ({ p, position: -1 }))
    } else {
      reachable = proposals
        .map((p) => ({ p, position: api.getRowPosition(p.rowId) }))
        .filter((x): x is { p: Proposal; position: number } => x.position !== null)
    }
    const hidden = proposals.length - reachable.length
    if (!reachable.length) return { id: null, hidden }
    const start = fromId ? reachable.findIndex((x) => x.p.id === fromId) + 1 : 0
    const target = reachable[start % reachable.length]!
    if (!grouped) {
      let index = target.position
      if (paged) {
        const { pageIndex, pageSize } = api.getPageInfo()
        const page = Math.floor(index / pageSize)
        if (page !== pageIndex) api.setPage(page)
        index -= page * pageSize
      }
      api.scrollToRow(index)
      flash(target.p.rowId)
      return { id: target.p.id, hidden }
    }
    // The display index counts group banners, which getDisplayedRows skips:
    // walk the display rows until the id matches.
    const limit = api.getDisplayedRows().length * 2 + 64
    for (let i = 0; i < limit; i++) {
      if (api.getRowId(i) === target.p.rowId) {
        api.scrollToRow(i)
        flash(target.p.rowId)
        break
      }
    }
    return { id: target.p.id, hidden }
  }

  // Row index for labels, rebuilt when the grid's data array changes.
  let labelIndex: { data: unknown; map: Map<string, number> } | null = null
  function rowLabel(p: Proposal): string | null {
    const api = getApi()
    if (!api || !api.getOption('getRowId')) return null
    const data = api.getData()
    if (labelIndex?.data !== data) labelIndex = { data, map: indexRows(api) }
    const i = labelIndex.map.get(p.rowId)
    if (i === undefined) return null
    const row = data[i] as TData
    if (opts.rowLabel) return opts.rowLabel(row) || null
    for (const c of api.getColumns()) {
      if (!c.visible || !c.field) continue
      const v = (row as Record<string, unknown>)[c.field]
      if (typeof v === 'string' && v.trim()) return c.field === p.field ? null : v.trim()
    }
    return null
  }

  const review = {
    get version() {
      return version
    },
    /** The wording in effect: English with `messages` laid over it. */
    messages: msg,
    /** The last undo or redo whose save failed, or null. */
    get lastError() {
      return lastError
    },
    add,
    get: (id: string) => {
      void version
      return all.get(id)
    },
    proposals: () => list(),
    /** What names the proposal's row (`rowLabel`), or null. */
    rowLabel,
    /** A field's column header, as the group labels show it. */
    fieldLabel: (field: string) => fieldLabels()(field),
    pending: () => list('pending'),
    conflicts: () => list('conflict'),
    groups,
    pendingFor,
    accept,
    reject,
    acceptGroup: (key: string, shownIds: ReadonlyArray<string>) => accept(groupIds(key, shownIds)),
    rejectGroup: (key: string, shownIds: ReadonlyArray<string>) => reject(groupIds(key, shownIds)),
    resolveConflict,
    get formats() {
      return formats
    },
    columns,
    reveal,
    showPendingOnly,
    /** On while our condition is in the grid's advanced filter (the grid's own Clear takes it out too). */
    get pendingOnly() {
      return pendingOnly && hasPending(getApi()?.getAdvancedFilter() ?? null)
    },
    toJSON,
    load,
    merge,
    log,
    revertSet,
    sets: sets_,
    clear,
  }
  return review
}
```
