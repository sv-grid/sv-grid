/**
 * Automations on the server: the ones set to "Runs in: the server".
 *
 * The browser runner runs an automation in the page of whoever made the
 * change. That cannot send an email, keep an API key, notice a change made by
 * another app, or run at 9:00 when nobody has the base open. This runner can:
 * it lives in your server (a SvelteKit route, a worker process), reads and
 * writes the tables through the same `baseSource`s, and hears of changes in
 * one of three ways:
 *
 *  - `recordChanged(table, { before, after })`: a change with both sides, as
 *    a Supabase database webhook or a Postgres trigger sends it;
 *  - `audit(table)`: the `audit` hook of `createKitHandlers`, after every
 *    write through your endpoint (the "before" is what it read last);
 *  - `tableChanged(table)`: read the table again and compare.
 *
 * `tick()` runs the scheduled ones; call it once a minute (a cron job, a
 * `setInterval`). A change it makes is kept as what it read, so the echo of
 * its own write (the webhook firing for it) is recognized and ignored, and
 * automations setting each other off stop at `MAX_DEPTH`.
 */
import { cronMatches } from '../scheduling'
import { primaryOf, rowIdOf, syncAllInverses, type BaseTable } from './base-tables'
import { newRecordId } from './field-ops'
import { registerLinkedTable } from './sources.svelte'
import {
  MAX_DEPTH,
  automationsFor,
  fieldValueFrom,
  fillTokens,
  matches,
  outbound,
  runAppAction,
  tableFields,
  type AutomationAction,
  type AutomationEvent,
  type AutomationRun,
  type AutomationStep,
  type BaseAutomation,
} from './automations.svelte'
import { callWebhook, sendEmailAction, type OutgoingEmail } from './automation-outbound'

type Row = Record<string, unknown>

export type AutomationNotice = { message: string; severity: 'info' | 'success' | 'warning' | 'error'; automation: string; table: string; record: Row | null }

export type AutomationServerOptions = {
  /** The tables, each with its `source` and `automations` (its `data` is read from the source). */
  tables: BaseTable[]
  /** Secrets a webhook names as `{secret:NAME}`: an object, or a lookup such as `(n) => env[n]`. */
  secrets?: Record<string, string | undefined> | ((name: string) => string | undefined)
  /** Sends the "Send an email" action: your mail provider. */
  sendEmail?: (email: OutgoingEmail) => Promise<unknown> | unknown
  /** "Show a notice" on the server: log it, push it to the people concerned. */
  notify?: (notice: AutomationNotice) => void
  /** Each run as it finishes, with what each action did. */
  onRun?: (run: AutomationRun) => void
  fetch?: typeof fetch
  now?: () => Date
  /** How many runs `runs` keeps (default 200). */
  keepRuns?: number
}

let runSeq = 0

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function createAutomationServer(options: AutomationServerOptions) {
  const now = options.now ?? (() => new Date())
  const keep = options.keepRuns ?? 200
  let tables: BaseTable[] = options.tables.map((t) => ({ ...t, data: [] }))
  let primed: Promise<void> | null = null
  let chain: Promise<unknown> = Promise.resolve()
  const runs: AutomationRun[] = []
  const lastFired = new Map<string, string>()
  const secret = (name: string) => (typeof options.secrets === 'function' ? options.secrets(name) : options.secrets?.[name])

  const tableOf = (id: string) => tables.find((t) => t.id === id)
  const sourceOf = (t: BaseTable) => {
    if (!t.source) throw new Error(`Table ${t.name} has no source`)
    return t.source
  }

  function setData(tableId: string, change: (rows: Row[]) => Row[]) {
    tables = tables.map((t) => (t.id === tableId ? { ...t, data: change(t.data) } : t))
    // The fields that link back are worked out from the other side.
    for (const t of tables) tables = syncAllInverses(tables, t.id)
  }

  /** Read every table once, so later changes have a "before" and links have names. */
  function prime(): Promise<void> {
    primed ??= (async () => {
      for (const t of tables) {
        const rows = await sourceOf(t).load()
        setData(t.id, () => rows)
      }
      for (const t of tables) {
        const id = t.id
        registerLinkedTable({
          id,
          name: t.name,
          rows: () => tableOf(id)?.data ?? [],
          getRowId: (r) => rowIdOf(tableOf(id) ?? t, r),
          primaryField: primaryOf(t),
          fields: t.columns.filter((d) => d.field).map((d) => ({ field: String(d.field), header: String(d.header ?? d.field), fieldType: d.fieldType, fieldProps: d.fieldProps })),
        })
      }
    })()
    return primed
  }

  /** Column ids of the fields that differ between two versions of a record. */
  function changedFields(t: BaseTable, before: Row, after: Row): string[] {
    const out: string[] = []
    for (const c of tableFields(t).values()) if (!same(before[c.field], after[c.field])) out.push(c.id)
    return out
  }

  // ---- What it hears ---------------------------------------------------------------

  /**
   * A record changed: rows as the database has them (`db: false` for rows
   * already in the base's shape). No `after` is a delete; no `before` is
   * read from what it last read.
   */
  async function recordChanged(tableId: string, change: { before?: Row | null; after?: Row | null }, opts: { db?: boolean } = {}): Promise<AutomationRun[]> {
    await prime()
    const t = tableOf(tableId)
    if (!t) throw new Error(`No table "${tableId}"`)
    const asPage = (r: Row | null | undefined) => (r ? (opts.db === false ? r : sourceOf(t).toPage(r)) : null)
    const after = asPage(change.after)
    const before = asPage(change.before)
    if (!after) {
      const id = String(before?.id ?? '')
      setData(tableId, (rows) => rows.filter((r) => rowIdOf(t, r) !== id))
      return []
    }
    const id = String(after.id)
    const known = t.data.find((r) => rowIdOf(t, r) === id)
    // A junction link is not in a database row: keep the one it read.
    const merged: Row = { ...(known ?? {}), ...after }
    // The echo of a change it made, or one it already heard: nothing new.
    if (known && same(known, merged)) return []
    const prev = before ? { ...(known ?? {}), ...before } : known
    setData(tableId, (rows) => (known ? rows.map((r) => (r === known ? merged : r)) : [...rows, merged]))
    const record = tableOf(tableId)!.data.find((r) => rowIdOf(t, r) === id)!
    if (!prev) return handle({ type: 'created', table: tableId, record })
    const fields = changedFields(t, prev, record)
    return fields.length ? handle({ type: 'updated', table: tableId, record, before: prev, fields }) : []
  }

  /** Read a table again and run what its changes set off. */
  async function tableChanged(tableId: string): Promise<AutomationRun[]> {
    await prime()
    const t = tableOf(tableId)
    if (!t) throw new Error(`No table "${tableId}"`)
    const fresh = await sourceOf(t).load()
    const old = new Map(t.data.map((r) => [rowIdOf(t, r), r]))
    setData(tableId, () => fresh)
    const out: AutomationRun[] = []
    for (const r of tableOf(tableId)!.data) {
      const prev = old.get(rowIdOf(t, r))
      if (!prev) out.push(...(await handle({ type: 'created', table: tableId, record: r })))
      else {
        const fields = changedFields(t, prev, r)
        if (fields.length) out.push(...(await handle({ type: 'updated', table: tableId, record: r, before: prev, fields })))
      }
    }
    return out
  }

  /** The `audit` hook of `createKitHandlers` for a table: every write through the endpoint. */
  function audit(tableId: string) {
    return async (entry: { action: 'create' | 'update' | 'delete'; id: string | null; result?: unknown }) => {
      if (entry.action === 'delete') {
        await recordChanged(tableId, { before: { id: entry.id }, after: null }, { db: false })
        return
      }
      // A bulk update has no single row: read the table.
      if (!entry.result) {
        await tableChanged(tableId)
        return
      }
      await recordChanged(tableId, { after: entry.result as Row })
    }
  }

  async function formSubmitted(tableId: string, recordId: string, view?: string): Promise<AutomationRun[]> {
    await prime()
    const record = await recordById(tableId, recordId)
    return record ? handle({ type: 'form', table: tableId, record, view }) : []
  }

  async function buttonPressed(tableId: string, recordId: string, field: string): Promise<AutomationRun[]> {
    await prime()
    const record = await recordById(tableId, recordId)
    return record ? handle({ type: 'button', table: tableId, record, field }) : []
  }

  async function recordById(tableId: string, id: string): Promise<Row | null> {
    const t = tableOf(tableId)
    if (!t) return null
    let hit = t.data.find((r) => rowIdOf(t, r) === id)
    if (!hit) {
      await tableChanged(tableId)
      hit = tableOf(tableId)!.data.find((r) => rowIdOf(t, r) === id)
    }
    return hit ?? null
  }

  /** Run the scheduled automations due at this minute (call it once a minute). */
  async function tick(at: Date = now()): Promise<AutomationRun[]> {
    await prime()
    const minute = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()} ${at.getHours()}:${at.getMinutes()}`
    const out: AutomationRun[] = []
    for (const t of tables) {
      for (const a of t.automations ?? []) {
        if (!a.enabled || a.runOn !== 'server' || a.trigger.type !== 'scheduled') continue
        const key = `${t.id}:${a.id}`
        if (lastFired.get(key) === minute || !cronMatches(a.trigger.cron, at)) continue
        lastFired.set(key, minute)
        if (!a.condition) out.push(await queue(a, t.id, null, 0))
        else for (const r of tableOf(t.id)!.data) if (matches(t, a.condition, r)) out.push(await queue(a, t.id, rowIdOf(t, r), 0))
      }
    }
    return out
  }

  // ---- Running ------------------------------------------------------------------------

  async function handle(e: AutomationEvent): Promise<AutomationRun[]> {
    const t = tableOf(e.table)
    if (!t) return []
    const depth = 'depth' in e ? (e.depth ?? 0) : 0
    const out: AutomationRun[] = []
    for (const a of automationsFor(t, e, 'server')) out.push(await queue(a, t.id, rowIdOf(t, e.record), depth))
    return out
  }

  /** One run at a time, in the order they were set off. */
  function queue(a: BaseAutomation, tableId: string, recordId: string | null, depth: number): Promise<AutomationRun> {
    const next = chain.then(() => runOne(a, tableId, recordId, depth))
    chain = next.catch(() => undefined)
    return next
  }

  async function runOne(a: BaseAutomation, tableId: string, recordId: string | null, depth: number): Promise<AutomationRun> {
    const t = tableOf(tableId)!
    const rec = recordId == null ? null : (t.data.find((r) => rowIdOf(t, r) === recordId) ?? null)
    const run: AutomationRun = { id: ++runSeq, automationId: a.id, name: a.name, table: t.name, record: rec ? String(rec[primaryOf(t)] ?? recordId) : null, at: now().getTime(), status: 'ok', steps: [] }
    if (depth >= MAX_DEPTH) {
      run.status = 'stopped'
      run.steps.push({ action: 'Stopped', detail: `Automations set each other off ${MAX_DEPTH} times in a row; this one did not run, so they cannot loop.` })
    } else {
      const follow: Array<() => Promise<unknown>> = []
      for (const action of a.actions) {
        try {
          const step = await act(a, action, tableId, recordId, depth, follow)
          if (step) run.steps.push(step)
        } catch (e) {
          run.status = 'error'
          run.steps.push({ action: action.type, detail: '', error: e instanceof Error ? e.message : String(e) })
          break
        }
      }
      remember(run)
      // What its actions changed can set off others, after this run is kept.
      for (const f of follow) void f()
      return run
    }
    remember(run)
    return run
  }

  function remember(run: AutomationRun) {
    runs.unshift(run)
    if (runs.length > keep) runs.length = keep
    options.onRun?.(run)
  }

  async function act(a: BaseAutomation, action: AutomationAction, tableId: string, recordId: string | null, depth: number, follow: Array<() => Promise<unknown>>): Promise<AutomationStep | null> {
    const t = tableOf(tableId)!
    const rec = recordId == null ? null : (t.data.find((r) => rowIdOf(t, r) === recordId) ?? null)
    const ctx = { tables, from: t, record: rec, now: now() }
    switch (action.type) {
      case 'notify': {
        const message = fillTokens(t, rec, action.message)
        options.notify?.({ message, severity: action.severity ?? 'info', automation: a.name, table: t.name, record: rec })
        return { action: 'Notice', detail: message }
      }
      case 'highlight':
        return null
      case 'updateRecord': {
        if (!rec || recordId == null) return { action: 'Update record', detail: 'No record to update' }
        const fields = tableFields(t)
        const patch: Row = {}
        for (const [id, spec] of Object.entries(action.values)) {
          const c = fields.get(id)
          if (c) patch[c.field] = fieldValueFrom(t, c.def, spec, ctx)
        }
        const after = { ...rec, ...patch }
        const changed = Object.keys(patch).filter((f) => !same(rec[f], after[f]))
        if (!changed.length) return { action: 'Update record', detail: 'Already set' }
        const only: Row = {}
        for (const f of changed) only[f] = after[f]
        await sourceOf(t).update(recordId, only, rec)
        setData(tableId, (rows) => rows.map((r) => (r === rec ? after : r)))
        const ids = changed.map((f) => [...fields.values()].find((c) => c.field === f)?.id ?? f)
        follow.push(() => handle({ type: 'updated', table: tableId, record: tableOf(tableId)!.data.find((r) => rowIdOf(t, r) === recordId)!, before: rec, fields: ids, depth: depth + 1 }))
        return { action: 'Update record', detail: changed.map((f) => `${[...fields.values()].find((c) => c.field === f)?.header ?? f}: ${String(after[f] ?? '')}`).join(', ') }
      }
      case 'createRecord': {
        const target = tableOf(action.table)
        if (!target) throw new Error(`No table "${action.table}"`)
        const fields = tableFields(target)
        const row: Row = { id: newRecordId() }
        for (const [id, spec] of Object.entries(action.values)) {
          const c = fields.get(id)
          if (c) row[c.field] = fieldValueFrom(target, c.def, spec, ctx)
        }
        if (action.linkField && rec) {
          const c = fields.get(action.linkField)
          if (c) row[c.field] = [rowIdOf(t, rec)]
        }
        const stored = await sourceOf(target).insert(row)
        const made: Row = { ...row, id: String(stored.id ?? row.id) }
        setData(target.id, (rows) => [...rows, made])
        follow.push(() => handle({ type: 'created', table: target.id, record: made, depth: depth + 1 }))
        return { action: 'Create record', detail: `${String(made[primaryOf(target)] ?? '') || 'a record'} in ${target.name}` }
      }
      case 'run':
        return runAppAction(a, action, t, rec)
      case 'webhook':
        return { action: 'Webhook', detail: await callWebhook(action, outbound(a, t, rec, { secret, fetch: options.fetch })) }
      case 'email':
        return { action: 'Email', detail: await sendEmailAction(action, outbound(a, t, rec), options.sendEmail) }
    }
  }

  return {
    prime,
    recordChanged,
    tableChanged,
    audit,
    formSubmitted,
    buttonPressed,
    tick,
    /** The latest runs, newest first: hand them to `<SvBase serverRuns>` from an endpoint. */
    get runs(): ReadonlyArray<AutomationRun> {
      return runs
    },
    /** Resolves when every queued run has finished. */
    settled: () => chain.then(() => undefined),
    /** The tables as it last read them. */
    get tables(): ReadonlyArray<BaseTable> {
      return tables
    },
  }
}

export type AutomationServer = ReturnType<typeof createAutomationServer>

