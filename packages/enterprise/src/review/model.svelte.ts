/**
 * A change review: proposals held apart from the grid's data until a person
 * accepts them, grouped for review, written to the app's data on accept, and
 * undone with one Ctrl+Z per decision.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createReview, SvReviewPanel } from '@svgrid/enterprise/review'
 *   let orders = $state(initial)
 *   let api = $state()
 *   const review = createReview({ api: () => api, setRows: (next) => (orders = next) })
 *   review.add({ source: { kind: 'agent', id: 'cleanup', label: 'Cleanup agent' }, proposals })
 * </script>
 *
 * <SvGrid data={orders} columns={review.columns(columns)} getRowId={(r) => r.id}
 *   conditionalFormats={review.formats} onApiReady={(a) => (api = a)} />
 * <SvReviewPanel {review} />
 * ```
 *
 * Why the app's data and not the grid's writers: `api.setCellValue` and the
 * command context write by view index into the grid's own copy, which the
 * next `data` prop discards. Reads go through `api.getData()` instead, which
 * includes the grid's own writes (paste, fill, addRows), so `next` carries
 * them forward. `setRows` must apply synchronously.
 */
import type { ConditionalFormat, SvGridApi } from '@svgrid/grid'
import { nudgeEnterprise } from '../license'
import { clusterProposals, type ClusterOptions } from './cluster'
import { sameValue } from './equal'
import { pendingFormats } from './formats'
import { hasPending, stripPending, trackPendingSource, withPending } from './pending-filter'
import { registerCardMarks, type CardMark } from './card-marks.svelte'
import { showValue } from './cluster'
import { wrapColumns } from './ghost'
import type { ChangeSet, Proposal, ProposalGroup, ProposalInput, ProposalSource } from './types'

/** The part of the grid api a review uses. Any `SvGridApi` satisfies it. */
export type ReviewGridApi = Pick<
  SvGridApi<any, any>,
  | 'getData' | 'getOption' | 'getActiveCell' | 'getRowId' | 'getColumns' | 'getCommandContext' | 'stopEditing' | 'scrollToRow' | 'getDisplayedRows'
  | 'getAdvancedFilter' | 'setAdvancedFilter'
>

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
}

export type ReviewDecision = {
  action: 'accept' | 'reject' | 'undo' | 'redo'
  /** For undo / redo: which decision was undone or redone. */
  of?: 'accept' | 'reject'
  proposals: Proposal[]
  by?: string
  at: number
}

export type ReviewOutcome = {
  accepted: string[]
  rejected: string[]
  /** The cell changed since the proposal was made, or its row is gone. Never written. */
  stale: string[]
  /** Left pending: the row is being edited, or the proposal is already being accepted. */
  skipped: string[]
  /** What `onCommit` threw; nothing was written and the proposals stay pending. */
  error?: unknown
}

export type AddInput = {
  source: ProposalSource
  title?: string
  id?: string
  proposals: ReadonlyArray<ProposalInput>
}

export type ReviewJSON = { v: 1; sets: ChangeSet[] }

export type Review<TData = unknown> = ReturnType<typeof createReview<TData>>

let uid = 0
const nextId = (prefix: string) => `${prefix}${Date.now().toString(36)}-${(uid++).toString(36)}`
const SEP = '\u0000'
const cellKey = (rowId: string, field: string) => rowId + SEP + field

export function createReview<TData = unknown>(opts: ReviewOptions<TData>) {
  if (!opts.setRows && !opts.server) throw new Error('[svgrid review] pass setRows (client data) or server (server row model)')
  if (opts.server && !opts.onCommit) throw new Error('[svgrid review] onCommit is required with a server row model')
  // Without a key: watermark and a one-time nudge. The review still runs.
  nudgeEnterprise('Change review')

  const all = new Map<string, Proposal>()
  const sets = new Map<string, Omit<ChangeSet, 'proposals'> & { ids: string[] }>()
  /** Live proposals (pending or in conflict) per cell. */
  const byCell = new Map<string, Set<string>>()
  const inFlight = new Set<string>()
  /** Decision order for the log: timestamps tie within one millisecond. */
  const decidedOrder = new Map<string, number>()
  let decisionSeq = 0
  const stamp = (p: Proposal) => decidedOrder.set(p.id, ++decisionSeq)
  let version = $state(0)
  // "Only rows with changes": our node ANDed onto the advanced filter. Put on
  // again after every change so the grid filters with the new pending set.
  const filterToken = nextId('rv-')
  let pendingOnly = $state(false)
  let filterNonce = 0
  let pendingRows: { v: number; ids: Set<string> } | null = null
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
      trackPendingSource(filterToken, { hasPendingRow })
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
    api.getData().forEach((row, i) => map.set(id(row as TData, i), i))
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
        id: raw.id ?? nextId('pr-'),
        op: 'update',
        source: input.source,
        createdAt,
        status: 'pending',
      }
      const key = cellKey(p.rowId, p.field)
      const live = byCell.get(key) ?? new Set<string>()
      for (const otherId of [...live]) {
        const other = all.get(otherId)!
        if (other.source.id === p.source.id && other.status === 'pending') {
          // A newer proposal from the same producer replaces the older one
          // and keeps what the cell held when the first was made.
          p.before = other.before
          live.delete(otherId)
          all.delete(otherId)
        } else {
          other.status = 'conflict'
          other.note = 'another source proposed a different value'
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
    const g = clusterProposals(list('pending'), { fieldLabel: fieldLabels(), ...opts.cluster })
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

  const outcome = (): ReviewOutcome => ({ accepted: [], rejected: [], stale: [], skipped: [] })

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
        markStale(p, 'the row no longer exists', out)
        return false
      }
      const current = (data[i] as Record<string, unknown>)[p.field]
      if (sameValue(current, p.before)) return true
      markStale(p, 'the cell changed after this was proposed', out)
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
    const busyRow = editedRow(api)
    let take: Proposal[] = []
    for (const id of ids) {
      const p = all.get(id)
      if (!p || p.status !== 'pending') continue
      if (inFlight.has(id) || (busyRow !== null && p.rowId === busyRow)) {
        if (!inFlight.has(id)) p.note = 'the row is being edited'
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
    // The await let other writes in: check again before writing.
    if (!opts.server) take = freshOnly(take.filter((p) => p.status === 'pending'), out, api)
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
    for (const id of ids) {
      const p = all.get(id)
      if (!p || (p.status !== 'pending' && p.status !== 'conflict') || inFlight.has(id)) continue
      p.status = 'rejected'
      p.decidedBy = opts.user
      p.decidedAt = at
      stamp(p)
      leaveCell(p)
      taken.push(p)
      out.rejected.push(id)
    }
    if (taken.length) recordUndo(getApi(), taken, 'rejected')
    decided('reject', taken)
    bump()
    return out
  }

  /**
   * One Ctrl+Z for the whole decision, by row id, so it works with paging and
   * filters on. Undoing an accept writes `before` back only where the cell
   * still holds `after`; anything edited since is left as it is.
   */
  function recordUndo(api: ReviewGridApi | null, ps: Proposal[], kind: 'accepted' | 'rejected') {
    if (!api) return
    const prior = new Map(ps.map((p) => [p.id, { decidedBy: p.decidedBy, decidedAt: p.decidedAt }]))
    const flip = (to: 'pending' | typeof kind, which: Proposal[]) => {
      for (const p of which) {
        p.status = to
        if (to === 'pending') {
          p.decidedBy = undefined
          p.decidedAt = undefined
          enterCell(p)
        } else {
          Object.assign(p, prior.get(p.id))
          leaveCell(p)
        }
      }
      decided(to === 'pending' ? 'undo' : 'redo', which, kind === 'accepted' ? 'accept' : 'reject')
      bump()
    }
    const move = (from: 'before' | 'after', to: 'before' | 'after', status: 'pending' | typeof kind) => {
      const live = ps.filter((p) => p.status === (status === 'pending' ? kind : 'pending'))
      if (kind === 'rejected') return flip(status, live)
      if (opts.server) {
        const inverse = live.map((p) => ({ ...p, before: p[from], after: p[to] }))
        Promise.resolve(opts.onCommit!(inverse)).then(() => {
          opts.server!.refresh()
          flip(status, live)
          opts.onApply?.(live, status === 'pending' ? 'undo' : 'redo')
        }, () => {})
        return
      }
      const index = indexRows(api)
      const ok = live.filter((p) => sameValue(currentValue(api, index, p), p[from]))
      writeValues(api, ok.map((p) => [p.rowId, p.field, p[to]] as const), (next) => opts.onApply?.(ok, status === 'pending' ? 'undo' : 'redo', next))
      flip(status, ok)
    }
    api.getCommandContext().recordUndo(
      () => move('after', 'before', 'pending'),
      () => move('before', 'after', kind),
    )
  }

  function groupIds(key: string, shownIds: ReadonlyArray<string>): string[] {
    const g = groups().find((x) => x.key === key)
    if (!g) return []
    const members = new Set(g.ids)
    return shownIds.filter((id) => members.has(id))
  }

  /** Keep one of a cell's conflicting proposals (it becomes pending) and reject the rest. */
  function resolveConflict(keepId: string): void {
    const keep = all.get(keepId)
    if (!keep || keep.status !== 'conflict') return
    const rivals = [...(byCell.get(cellKey(keep.rowId, keep.field)) ?? [])].filter((id) => id !== keepId)
    reject(rivals)
    keep.status = 'pending'
    keep.note = undefined
    bump()
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

  function load(json: ReviewJSON): void {
    clear()
    for (const set of json.sets) {
      sets.set(set.id, { id: set.id, title: set.title, source: set.source, createdAt: set.createdAt, ids: set.proposals.map((p) => p.id) })
      for (const p of set.proposals) {
        all.set(p.id, { ...p })
        if (p.status === 'pending' || p.status === 'conflict') enterCell(p)
      }
    }
    bump()
  }

  /**
   * Add the sets of an export to this review, keeping what is here: an
   * approver's page merges what the author exported. A set already present is
   * skipped. Pending proposals go through the same rules as `add` (a cell
   * with a live proposal from another source becomes a conflict); decided ones
   * are kept as history.
   */
  function merge(json: ReviewJSON): void {
    for (const set of json.sets) {
      if (sets.has(set.id)) continue
      const live = set.proposals.filter((p) => p.status === 'pending' || p.status === 'conflict')
      const history = set.proposals.filter((p) => !live.includes(p) && !all.has(p.id))
      add({ id: set.id, title: set.title, source: set.source, proposals: live.filter((p) => !all.has(p.id)) })
      for (const p of history) all.set(p.id, { ...p })
      sets.get(set.id)!.ids.push(...history.map((p) => p.id))
    }
    bump()
  }

  // ---- history ------------------------------------------------------------

  /** Every decided proposal (accepted, rejected or stale), oldest decision first. */
  function log(): Proposal[] {
    void version
    return [...all.values()]
      .filter((p) => p.status === 'accepted' || p.status === 'rejected' || p.status === 'stale')
      .sort((a, b) => (decidedOrder.get(a.id) ?? 0) - (decidedOrder.get(b.id) ?? 0))
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
  function cardMark(rowId: string): CardMark | null {
    void version
    const ps: Proposal[] = []
    for (const p of all.values()) if (p.rowId === rowId && (p.status === 'pending' || p.status === 'conflict')) ps.push(p)
    if (!ps.length) return null
    const labels = fieldLabels()
    return { count: ps.length, text: ps.map((p) => `${labels(p.field)} → ${showValue(p.after)}`).join(', ') }
  }
  let marksFor: unknown = null
  /** Register for the board and gallery cards of the grid, once its getRowId is known. */
  function linkCards(api: ReviewGridApi) {
    const fn = api.getOption('getRowId') as object | undefined
    if (fn && fn !== marksFor) {
      marksFor = fn
      registerCardMarks(fn, { cardMark })
    }
  }

  const formats = $derived.by((): ConditionalFormat<any>[] => {
    void version
    const api = getApi()
    if (!api || !api.getOption('getRowId')) return []
    linkCards(api)
    return pendingFormats(list('pending'), rowIdFn(api), api.getColumns())
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
   * Scroll to the next proposal of `ids` on the current page, after `fromId`.
   * Does not move the active cell. Returns the id scrolled to and how many of
   * `ids` are not on this page.
   */
  function reveal(ids: ReadonlyArray<string>, fromId?: string): { id: string | null; offPage: number } {
    const api = getApi()
    if (!api) return { id: null, offPage: ids.length }
    const idFn = rowIdFn(api)
    const shown = api.getDisplayedRows()
    const onPage = new Set(shown.map((r, i) => idFn(r as TData, i)))
    const targets = ids.map((i) => all.get(i)).filter((p): p is Proposal => !!p && onPage.has(p.rowId))
    const offPage = ids.length - targets.length
    if (!targets.length) return { id: null, offPage }
    const start = fromId ? targets.findIndex((p) => p.id === fromId) + 1 : 0
    const target = targets[start % targets.length]!
    // The display index counts group banners, which getDisplayedRows skips:
    // walk the display rows until the id matches.
    const limit = shown.length * 2 + 64
    for (let i = 0; i < limit; i++) {
      if (api.getRowId(i) === target.rowId) {
        api.scrollToRow(i)
        break
      }
    }
    return { id: target.id, offPage }
  }

  const review = {
    get version() {
      return version
    },
    add,
    get: (id: string) => {
      void version
      return all.get(id)
    },
    proposals: () => list(),
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
