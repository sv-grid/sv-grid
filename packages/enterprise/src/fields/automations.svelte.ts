/**
 * Automations: "when this happens to a record, do these things", per table
 * of a base.
 *
 * A trigger names the moment (a record created, a field changed, a record
 * that starts matching a condition, a form sent, a button pressed, a time of
 * day). An optional condition, written with the view bar's filter, narrows it
 * to some records. The actions then run in order: change the record, create a
 * record in any table (linked back to this one if you like), show a notice,
 * color the record while it matches, or run a function the app registered.
 *
 * Automations run in the page of the person who made the change, once: a
 * change that arrives from another person (realtime) does not set them off
 * here. A change an automation makes can set off other automations, up to
 * `MAX_DEPTH` deep, so two that answer each other stop instead of looping.
 * Every run is kept in a short history, with what each action did.
 */
import { toast } from '@svgrid/grid'
import { createScheduler, type Schedule, type Scheduler } from '../scheduling'
import { colId, primaryOf, rowIdOf, syncAllInverses, type BaseTable } from './base-tables'
import { compileFieldFilter, describeFieldFilter, type FieldFilter } from './filter-model'
import { fieldPropsOf, fillFieldColumn } from './registry.svelte'
import { noteChange } from './activity.svelte'
import { getFieldUsers } from './sources.svelte'
import { newRecordId } from './field-ops'
import { fieldText, fieldValue, linkNames } from './base-alerts'
import type { FieldColumn } from './grid-access'
import { callWebhook, sendEmailAction, type EmailAction, type OutboundContext, type WebhookAction } from './automation-outbound'

type Row = Record<string, unknown>
type Def = Record<string, any>

// ---- The model ----------------------------------------------------------------

export type AutomationTrigger =
  /** A record is added: "+ Add row", a form, a board lane, another automation. */
  | { type: 'recordCreated' }
  /** A record changes; with `fields`, only when one of them does. */
  | { type: 'recordUpdated'; fields?: string[] }
  /** A record starts matching the condition (it did not before the change). */
  | { type: 'recordMatches' }
  /** A form view sends a record; with `view`, only that form. */
  | { type: 'formSubmitted'; view?: string }
  /** A button field is pressed on a record. */
  | { type: 'button'; field: string }
  /** On a schedule: once for each record matching the condition then, or once with no record. */
  | { type: 'scheduled'; cron: string }

export type AutomationAction =
  /** Set fields of the record that set it off. */
  | { type: 'updateRecord'; values: Record<string, unknown> }
  /** Add a record to a table; `linkField` there links it to the record that set it off. */
  | { type: 'createRecord'; table: string; values: Record<string, unknown>; linkField?: string }
  /** A notice: `{Field name}` is that field of the record. */
  | { type: 'notify'; message: string; severity?: 'info' | 'success' | 'warning' | 'error' }
  /** While the record matches the condition, color these fields (or the whole row). */
  | { type: 'highlight'; fields?: string[]; background: string; color?: string }
  /** A function the app registered with `registerAutomationAction`. */
  | { type: 'run'; action: string; options?: Record<string, unknown> }
  /** Call a URL with the record (a chat webhook, your API). */
  | WebhookAction
  /** Send an email (the server runner's `sendEmail`). */
  | EmailAction

export type BaseAutomation = {
  id: string
  name: string
  enabled: boolean
  /**
   * Where it runs: in the browser of the person who made the change
   * (default), or on the server with `createAutomationServer`, which hears of
   * changes from the database and can read secrets and send email.
   */
  runOn?: 'browser' | 'server'
  trigger: AutomationTrigger
  /** Only records that match (the view bar's filter). */
  condition?: FieldFilter
  actions: AutomationAction[]
}

/**
 * Field values in `updateRecord` / `createRecord` are written as the field
 * shows them: an option's name, a person's name, a linked record's name, a
 * number, `true`. Text may name fields: `{Task} follow-up`. Dates also take
 * `today`, `now`, `today+7`, `today-1`. `{record}` in a link field is the
 * record that set the automation off. An empty string clears the field.
 */
export type AutomationValue = unknown

// ---- App actions ----------------------------------------------------------------

export type AutomationActionContext = {
  automation: BaseAutomation
  table: BaseTable
  /** The record that set it off; null for a scheduled run with no condition. */
  record: Row | null
  /** A field of the record as its cell shows it. */
  text: (fieldName: string) => string
  options: Record<string, unknown>
}

export type RegisteredAutomationAction = {
  /** How the editor names it: "Post to Slack". */
  label: string
  run: (ctx: AutomationActionContext) => unknown | Promise<unknown>
}

const appActions = new Map<string, RegisteredAutomationAction>()

/**
 * Add an action automations can run: a webhook, an email, a message to chat.
 * It runs in the page; keep secrets on your server and call it from here.
 */
export function registerAutomationAction(id: string, action: RegisteredAutomationAction): void {
  appActions.set(id, action)
}

export function listAutomationActions(): Array<{ id: string; label: string }> {
  return [...appActions].map(([id, a]) => ({ id, label: a.label }))
}

// ---- Reading a table outside its grid ----------------------------------------------

const readers = new WeakMap<object, Map<string, FieldColumn>>()

/** A table's fields as filled in (formulas, lookups, formats), by column id. */
export function tableFields(t: BaseTable): Map<string, FieldColumn> {
  const hit = readers.get(t.columns)
  if (hit) return hit
  const all = t.columns.map((d) => ({ ...d, id: colId(d) }))
  const map = new Map<string, FieldColumn>()
  for (const d of t.columns) {
    if (d.field == null) continue
    const def = fillFieldColumn(d as Def, all) as Def
    map.set(colId(d), { id: colId(d), field: String(d.field), header: String(d.header ?? d.field), fieldType: d.fieldType, def, visible: true })
  }
  readers.set(t.columns, map)
  return map
}

/** A field by a header, its key or its id, ignoring case and outer spaces, as a formula's `{name}` matches one. */
const byName = (t: BaseTable, name: string): FieldColumn | undefined => {
  const lower = name.trim().toLowerCase()
  for (const c of tableFields(t).values()) {
    if (c.header.trim().toLowerCase() === lower || c.field.toLowerCase() === lower || c.id.toLowerCase() === lower) return c
  }
  return undefined
}

/** `{Field name}` tokens of a template, filled from a record. */
export function fillTokens(t: BaseTable, record: Row | null, template: string): string {
  return template.replace(/\{([^{}\n]+)\}/g, (m, name: string) => {
    if (!record) return m
    const c = byName(t, name)
    return c ? fieldText(c, record) : m
  })
}

/** Whether a record matches a condition (no condition matches every record). */
export function matches(t: BaseTable, condition: FieldFilter | undefined, record: Row): boolean {
  if (!condition) return true
  const fields = tableFields(t)
  const test = compileFieldFilter<Row>(condition, (row, id) => {
    const c = fields.get(id)
    return c ? fieldValue(c, row) : row[id]
  }, linkNames)
  return test ? test(record) : true
}

/**
 * Last modified time fields of a record an automation changed, as an edit
 * stamps them. Last modified by names a person, so it keeps its author.
 */
function stampModifiedTime(t: BaseTable, row: Row, changedIds: string[], at: Date): void {
  for (const d of t.columns) {
    if (d.fieldType !== 'lastModifiedTime' || d.field == null || changedIds.includes(colId(d))) continue
    const p = fieldPropsOf(d) as { watch?: string; watchFields?: string[] }
    if (p.watch === 'specific' && !changedIds.some((id) => (p.watchFields ?? []).includes(id))) continue
    row[String(d.field)] = at.toISOString()
  }
}

// ---- Values -----------------------------------------------------------------------

const DAY = 86_400_000
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** What a value written in an action becomes in a field of `t`. */
export function fieldValueFrom(t: BaseTable, def: Def, spec: unknown, ctx: { tables: BaseTable[]; from: BaseTable; record: Row | null; now: Date }): unknown {
  const type = def.fieldType as string | undefined
  if (typeof spec !== 'string') return spec
  const raw = spec.includes('{record}') ? spec : fillTokens(ctx.from, ctx.record, spec)
  const text = raw.trim()
  if (text === '') return type === 'checkbox' ? false : type === 'multiSelect' || type === 'link' || type === 'attachment' ? [] : null
  switch (type) {
    case 'checkbox':
      return /^(true|yes|1|checked|on)$/i.test(text)
    case 'number':
    case 'rating':
    case 'duration':
    case 'currency':
    case 'percent': {
      const n = Number(text.replace(/[^0-9.+-eE]/g, ''))
      // "100%" in a percent field is 1, as the field keeps it.
      return Number.isFinite(n) ? (text.endsWith('%') ? n / 100 : n) : null
    }
    case 'multiSelect':
      return text.split(/\s*,\s*/).filter(Boolean)
    case 'user': {
      const found = getFieldUsers().find((u) => u.id === text || u.name.toLocaleLowerCase() === text.toLocaleLowerCase())
      return found ? found.id : text
    }
    case 'date': {
      const m = /^(today|now)\s*(?:([+-])\s*(\d+))?$/i.exec(text)
      if (!m) return text
      const shift = m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) * DAY : 0
      const at = new Date(ctx.now.getTime() + shift)
      return m[1]!.toLowerCase() === 'now' || def.fieldProps?.time ? at.toISOString() : isoDay(at)
    }
    case 'link': {
      const target = ctx.tables.find((x) => x.id === def.fieldProps?.table)
      const out: string[] = []
      for (const part of text.split(/\s*,\s*/)) {
        if (part === '{record}') {
          if (ctx.record && ctx.from.id === target?.id) out.push(rowIdOf(ctx.from, ctx.record))
          continue
        }
        const name = fillTokens(ctx.from, ctx.record, part).toLocaleLowerCase()
        const hit = target?.data.find((r) => String(r?.[primaryOf(target)] ?? '').toLocaleLowerCase() === name)
        if (hit && target) out.push(rowIdOf(target, hit))
      }
      return def.fieldProps?.multiple === false ? out.slice(0, 1) : out
    }
    default:
      return raw
  }
}

// ---- Runs ---------------------------------------------------------------------------

export type AutomationStep = { action: string; detail: string; error?: string }
export type AutomationRun = {
  id: number
  automationId: string
  name: string
  table: string
  record: string | null
  at: number
  status: 'ok' | 'error' | 'stopped'
  steps: AutomationStep[]
}

/** The longest chain of automations setting each other off. */
export const MAX_DEPTH = 4

export type AutomationEvent =
  | { type: 'created'; table: string; record: Row; depth?: number }
  | { type: 'updated'; table: string; record: Row; before: Row; fields: string[]; depth?: number }
  | { type: 'form'; table: string; record: Row; view?: string }
  | { type: 'button'; table: string; record: Row; field: string }

export type AutomationRunnerOptions = {
  getTables: () => BaseTable[] | undefined
  /**
   * Put changed tables in the page (and, through a table's source, in the
   * database). `depth` is how deep in a chain of automations the change was
   * made: changes it causes in other tables (through links) carry it on.
   * `wrote` is the table it changed itself; it reports that change on its own.
   */
  apply: (tables: BaseTable[], depth?: number, wrote?: string) => void
  now?: () => Date
  /** The base's own object (its grids' `baseScope`), so its records' activity stays its own. */
  scope?: object
}

let runSeq = 0

export function createAutomationRunner(options: AutomationRunnerOptions) {
  const now = options.now ?? (() => new Date())
  let runs = $state.raw<AutomationRun[]>([])
  let scheduler: Scheduler | null = null
  let chain: Promise<void> = Promise.resolve()

  const record = (run: AutomationRun) => (runs = [run, ...runs].slice(0, 100))
  const automationsOf = (t: BaseTable) => (t.automations ?? []).filter((a) => a.enabled && a.runOn !== 'server')
  const tableOf = (id: string) => options.getTables()?.find((t) => t.id === id)
  const recordNow = (t: BaseTable, id: string) => tableOf(t.id)?.data.find((r) => r && rowIdOf(t, r) === id) ?? null

  const setOff = (t: BaseTable, e: AutomationEvent) => automationsFor(t, e, 'browser')

  /** Hear of something that happened to a record; the automations it sets off run in order. */
  function handle(e: AutomationEvent): Promise<void> {
    const t = tableOf(e.table)
    if (!t) return chain
    const list = setOff(t, e)
    const depth = 'depth' in e ? (e.depth ?? 0) : 0
    for (const a of list) chain = chain.then(() => runOne(a, t.id, rowIdOf(t, e.record), depth))
    return chain
  }

  async function runOne(a: BaseAutomation, tableId: string, recordId: string | null, depth: number): Promise<void> {
    const t = tableOf(tableId)
    if (!t) return
    const rec = recordId == null ? null : recordNow(t, recordId)
    const run: AutomationRun = { id: ++runSeq, automationId: a.id, name: a.name, table: t.name, record: rec ? String(rec[primaryOf(t)] ?? recordId) : null, at: now().getTime(), status: 'ok', steps: [] }
    if (depth >= MAX_DEPTH) {
      run.status = 'stopped'
      run.steps.push({ action: 'Stopped', detail: `Automations set each other off ${MAX_DEPTH} times in a row; this one did not run, so they cannot loop.` })
      record(run)
      return
    }
    for (const action of a.actions) {
      try {
        const step = await act(a, action, tableId, recordId, depth)
        if (step) run.steps.push(step)
      } catch (e) {
        run.status = 'error'
        run.steps.push({ action: actionLabel(action), detail: '', error: e instanceof Error ? e.message : String(e) })
        break
      }
    }
    record(run)
  }

  async function act(a: BaseAutomation, action: AutomationAction, tableId: string, recordId: string | null, depth: number): Promise<AutomationStep | null> {
    const tables = options.getTables() ?? []
    const t = tables.find((x) => x.id === tableId)!
    const rec = recordId == null ? null : (t.data.find((r) => r && rowIdOf(t, r) === recordId) ?? null)
    const ctx = { tables, from: t, record: rec, now: now() }
    switch (action.type) {
      case 'notify': {
        const message = fillTokens(t, rec, action.message)
        const sev = action.severity ?? 'info'
        toast[sev](message)
        return { action: 'Notice', detail: message }
      }
      case 'highlight':
        // Drawn by the grid while the record matches; nothing to do now.
        return null
      case 'updateRecord': {
        if (!rec || recordId == null) return { action: 'Update record', detail: 'No record to update' }
        const fields = tableFields(t)
        const patch: Row = {}
        for (const [id, spec] of Object.entries(action.values)) {
          const c = fields.get(id)
          if (c) patch[c.field] = fieldValueFrom(t, c.def, spec, ctx)
        }
        const before = { ...rec }
        const after = { ...rec, ...patch }
        const changed = Object.keys(patch).filter((f) => JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null))
        if (!changed.length) return { action: 'Update record', detail: 'Already set' }
        const changedIds = changed.map((f) => [...fields.values()].find((c) => c.field === f)?.id ?? f)
        stampModifiedTime(t, after, changedIds, ctx.now)
        let next = tables.map((x) => (x.id === t.id ? { ...x, data: x.data.map((r) => (r === rec ? after : r)) } : x))
        next = syncAllInverses(next, t.id)
        options.apply(next, depth + 1, t.id)
        // The record's activity says the automation made the change.
        changed.forEach((f, i) => noteChange({ base: options.scope, tableId: t.id }, recordId, changedIds[i]!, after[f], a.name))
        // What it changed can set off other automations, one level deeper.
        void handle({ type: 'updated', table: t.id, record: after, before, fields: changedIds, depth: depth + 1 })
        return { action: 'Update record', detail: changed.map((f) => said([...fields.values()].find((c) => c.field === f), f, after)).join(', ') }
      }
      case 'createRecord': {
        const target = tables.find((x) => x.id === action.table)
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
        let next = tables.map((x) => (x.id === target.id ? { ...x, data: [...x.data, row] } : x))
        next = syncAllInverses(next, target.id)
        options.apply(next, depth + 1, target.id)
        void handle({ type: 'created', table: target.id, record: row, depth: depth + 1 })
        const name = String(row[primaryOf(target)] ?? '') || 'a record'
        return { action: 'Create record', detail: `${name} in ${target.name}` }
      }
      case 'run':
        return runAppAction(a, action, t, rec)
      case 'webhook':
        return { action: 'Webhook', detail: await callWebhook(action, outbound(a, t, rec)) }
      case 'email':
        // The browser has no mail sender: this fails and says to run it on the server.
        return { action: 'Email', detail: await sendEmailAction(action, outbound(a, t, rec), undefined) }
    }
  }

  /** Run the scheduled automations of every table again from now on (after a change to them). */
  function schedule() {
    scheduler?.stop()
    scheduler = null
    const list = options.getTables() ?? []
    const due: Array<Schedule & { table: string; automation: BaseAutomation }> = []
    for (const t of list) for (const a of automationsOf(t)) if (a.trigger.type === 'scheduled') due.push({ id: `${t.id}:${a.id}`, cron: a.trigger.cron, table: t.id, automation: a })
    if (!due.length) return
    scheduler = createScheduler({
      schedules: due,
      now,
      onFire: (s) => void runScheduled(s.id),
    })
    scheduler.start()
  }

  /** A scheduled automation, now: once per record matching its condition, or once with no record. */
  function runScheduled(key: string): Promise<void> {
    const [tableId, automationId] = key.split(':') as [string, string]
    const t = tableOf(tableId)
    const a = t?.automations?.find((x) => x.id === automationId)
    if (!t || !a) return chain
    if (!a.condition) chain = chain.then(() => runOne(a, t.id, null, 0))
    else for (const r of t.data) if (r && matches(t, a.condition, r)) chain = chain.then(() => runOne(a, t.id, rowIdOf(t, r), 0))
    return chain
  }

  return {
    handle,
    schedule,
    runScheduled,
    /** Run one automation now for a record (or none), as its trigger would. */
    /** Run one automation now for a record (or none), as its trigger would; a record that does not match its condition is reported, not run. */
    runNow: (a: BaseAutomation, tableId: string, recordId: string | null) =>
      (chain = chain.then(() => {
        const t = tableOf(tableId)
        const rec = t && recordId != null ? recordNow(t, recordId) : null
        if (t && rec && a.condition && !matches(t, a.condition, rec)) {
          record({ id: ++runSeq, automationId: a.id, name: a.name, table: t.name, record: String(rec[primaryOf(t)] ?? recordId), at: now().getTime(), status: 'stopped', steps: [{ action: 'Not run', detail: 'The record does not match the condition' }] })
          return
        }
        return runOne(a, tableId, recordId, 0)
      })),
    get runs() {
      return runs
    },
    clearRuns: () => (runs = []),
    settled: () => chain,
    stop: () => scheduler?.stop(),
  }
}

export type AutomationRunner = ReturnType<typeof createAutomationRunner>

// ---- Words --------------------------------------------------------------------------

/** "Status: Done", "Done: checked": a field of a record as a run lists it. */
function said(c: FieldColumn | undefined, field: string, record: Row): string {
  if (!c) return `${field}: ${String(record[field] ?? '')}`
  if (c.fieldType === 'checkbox') return `${c.header}: ${record[c.field] ? 'checked' : 'unchecked'}`
  return `${c.header}: ${fieldText(c, record) || 'empty'}`
}

/** Which of a table's automations an event sets off, for the runner on one side. */
export function automationsFor(t: BaseTable, e: AutomationEvent, side: 'browser' | 'server'): BaseAutomation[] {
  return (t.automations ?? []).filter((a) => {
    if (!a.enabled || (a.runOn === 'server') !== (side === 'server')) return false
    const tr = a.trigger
    switch (tr.type) {
      case 'recordCreated':
        return e.type === 'created' && matches(t, a.condition, e.record)
      case 'recordUpdated':
        return e.type === 'updated' && (!tr.fields?.length || tr.fields.some((f) => e.fields.includes(f))) && matches(t, a.condition, e.record)
      case 'recordMatches':
        if (!a.condition) return false
        if (e.type === 'created') return matches(t, a.condition, e.record)
        if (e.type === 'updated') return matches(t, a.condition, e.record) && !matches(t, a.condition, e.before)
        return false
      case 'formSubmitted':
        return e.type === 'form' && (!tr.view || tr.view === e.view) && matches(t, a.condition, e.record)
      case 'button':
        return e.type === 'button' && e.field === tr.field && matches(t, a.condition, e.record)
      default:
        return false
    }
  })
}

/** What a webhook or an email reads of the record. */
export function outbound(a: BaseAutomation, t: BaseTable, rec: Row | null, extra: Partial<OutboundContext> = {}): OutboundContext {
  return {
    automation: a.name,
    table: t.name,
    record: rec,
    fill: (template) => fillTokens(t, rec, template),
    fields: () => {
      const out: Record<string, string> = {}
      if (rec) for (const c of tableFields(t).values()) out[c.header] = c.fieldType === 'checkbox' ? String(!!rec[c.field]) : fieldText(c, rec)
      return out
    },
    ...extra,
  }
}

/** An action the app registered, run on a record. */
export async function runAppAction(a: BaseAutomation, action: Extract<AutomationAction, { type: 'run' }>, t: BaseTable, rec: Row | null): Promise<AutomationStep> {
  const app = appActions.get(action.action)
  if (!app) throw new Error(`No action "${action.action}" is registered`)
  const out = await app.run({ automation: a, table: t, record: rec, text: (name) => fillTokens(t, rec, `{${name}}`), options: action.options ?? {} })
  return { action: app.label, detail: typeof out === 'string' ? out : 'Done' }
}

export function actionLabel(a: AutomationAction): string {
  switch (a.type) {
    case 'updateRecord':
      return 'Update record'
    case 'createRecord':
      return 'Create record'
    case 'notify':
      return 'Show a notice'
    case 'highlight':
      return 'Color the record'
    case 'run':
      return appActions.get(a.action)?.label ?? a.action
    case 'webhook':
      return 'Call a webhook'
    case 'email':
      return 'Send an email'
  }
}

/** "When a record matches: Status is Blocked", for the list of automations. */
export function triggerText(t: BaseTable | undefined, a: BaseAutomation): string {
  const name = (id: string) => (t ? (tableFields(t).get(id)?.header ?? id) : id)
  const cond = a.condition ? describeFieldFilter(a.condition, name) : ''
  const tr = a.trigger
  switch (tr.type) {
    case 'recordCreated':
      return `When a record is created${cond && cond !== 'every record' ? `, where ${cond}` : ''}`
    case 'recordUpdated':
      return `When ${tr.fields?.length ? tr.fields.map(name).join(' or ') : 'a record'} changes${cond && cond !== 'every record' ? `, where ${cond}` : ''}`
    case 'recordMatches':
      return `When a record matches: ${cond || 'no condition yet'}`
    case 'formSubmitted':
      return `When a form is sent${cond && cond !== 'every record' ? `, where ${cond}` : ''}`
    case 'button':
      return `When ${name(tr.field)} is pressed`
    case 'scheduled':
      return `On a schedule (${tr.cron})${cond && cond !== 'every record' ? `, for records where ${cond}` : ''}`
  }
}
