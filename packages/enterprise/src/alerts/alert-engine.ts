/**
 * The pure alert engine - no DOM, no timers. It turns rules + data snapshots
 * into `AlertEvent`s, with true-edge de-duplication so a `dataChange` rule fires
 * once when a row starts matching (not on every re-evaluation while it keeps
 * matching). The reactive/observing wrapper lives in `alert-engine-attach.ts`.
 */
import { evaluateChange, evaluatePredicate } from '../expressions/evaluate'
import { collectColumnRefs } from '../expressions/parse'
import type { EvalContext } from '../expressions/expression-types'
import type { AlertEvent, AlertRule } from './alert-types'

export type AlertEngineOptions<TData> = {
  rules: AlertRule[]
  getRowId: (row: TData) => string
  /** Resolve a column id to a value (defaults to `row[id]`). */
  getValue?: (row: TData, columnId: string) => unknown
  locale?: string | ReadonlyArray<string>
  /** Clock for `firedAt` (injectable for deterministic tests). */
  now?: () => number
}

export type ValidateEditResult = {
  vetoed: boolean
  events: AlertEvent[]
}

export type AlertEngine<TData> = {
  setRules(rules: AlertRule[]): void
  getRules(): AlertRule[]
  /** Full-snapshot pass: fires `dataChange`/`scheduled`/aggregate edges. */
  evaluate(rows: ReadonlyArray<TData>): AlertEvent[]
  /** Prev -> next pass: fires `relativeChange` plus `dataChange` edges. */
  evaluateTransition(prev: ReadonlyArray<TData>, next: ReadonlyArray<TData>): AlertEvent[]
  /** Would editing `(row, columnId) -> nextValue` trip a validation rule? */
  validateEdit(row: TData, columnId: string, nextValue: unknown): ValidateEditResult
  /**
   * True iff some enabled rule reads a row's PREVIOUS value (a `relativeChange`
   * trigger). When false, the observer can skip cloning prev-snapshots entirely
   * - the hot-path saver for `dataChange`/aggregate-only rule sets over big feeds.
   */
  needsPrev(): boolean
  /** True iff some enabled rule is aggregate-scope (needs the full row set). */
  needsFullSet(): boolean
  /** Forget edge memory so matching rows can fire again. */
  reset(): void
}

const AGG_ROW_KEY = '*'

/** Fill message-template tokens from the firing context. */
export function renderTemplate(
  template: string,
  ctx: { rule: AlertRule; row?: Record<string, unknown>; columnId?: string; value?: unknown },
): string {
  const { rule, row, columnId, value } = ctx
  return template
    .replace(/\{rule\}/g, rule.name)
    .replace(/\{severity\}/g, rule.severity)
    .replace(/\{column\}/g, columnId ?? '')
    .replace(/\{value\}/g, value == null ? '' : String(value))
    .replace(/\{row\.([\w$]+)\}/g, (_m, key: string) => fmt(row?.[key]))
    .replace(/\{([\w$]+)\}/g, (m, key: string) => (row && key in row ? fmt(row[key]) : m))
}

function fmt(v: unknown): string {
  return v == null ? '' : String(v)
}

function defaultMessage(rule: AlertRule): string {
  return rule.name
}

export function createAlertEngine<TData = Record<string, unknown>>(
  options: AlertEngineOptions<TData>,
): AlertEngine<TData> {
  let rules = options.rules
  const getValue = options.getValue
  const now = options.now ?? (() => Date.now())
  // Edge memory: keys currently satisfying a `dataChange`/aggregate predicate.
  const active = new Set<string>()

  const ctxFor = (row: TData, rows?: ReadonlyArray<TData>, prev?: TData): EvalContext<TData> => ({
    row,
    prev,
    rows,
    getValue,
    locale: options.locale,
  })

  const val = (row: TData, columnId?: string): unknown =>
    columnId == null
      ? undefined
      : getValue
        ? getValue(row, columnId)
        : (row as Record<string, unknown>)?.[columnId]

  // A representative column for the message `{value}`/`{column}` tokens: the
  // rule's explicit target, else the first column its predicate references.
  const primaryColumn = (rule: AlertRule): string | undefined =>
    rule.columns?.[0] ?? collectColumnRefs(rule.predicate)[0]

  function buildEvent(
    rule: AlertRule,
    opts: { row?: TData; rowId?: string; columnId?: string; value?: unknown },
  ): AlertEvent {
    const msgAction = rule.actions.find((a) => a.message)
    const template = msgAction?.message ?? defaultMessage(rule)
    const message = renderTemplate(template, {
      rule,
      row: opts.row as Record<string, unknown> | undefined,
      columnId: opts.columnId,
      value: opts.value,
    })
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      scope: rule.scope,
      triggerType: rule.trigger.type,
      rowId: opts.rowId,
      columnId: opts.columnId,
      value: opts.value,
      message,
      actions: rule.actions,
      firedAt: now(),
    }
  }

  /** Aggregate-scope: one edge event when the predicate over all rows flips true. */
  function evaluateAggregate(rule: AlertRule, rows: ReadonlyArray<TData>): AlertEvent[] {
    const key = `${rule.id}::${AGG_ROW_KEY}`
    const first = rows[0]
    const matches = first != null && evaluatePredicate(rule.predicate, ctxFor(first, rows))
    if (matches && !active.has(key)) {
      active.add(key)
      return [buildEvent(rule, {})]
    }
    if (!matches) active.delete(key)
    return []
  }

  /** Row/cell dataChange: edge event when a row newly satisfies the predicate. */
  function evaluateDataChangeRow(
    rule: AlertRule,
    row: TData,
    rows: ReadonlyArray<TData>,
  ): AlertEvent[] {
    const id = options.getRowId(row)
    const key = `${rule.id}::${id}`
    const matches = evaluatePredicate(rule.predicate, ctxFor(row, rows))
    if (matches && !active.has(key)) {
      active.add(key)
      const source = primaryColumn(rule)
      // Expose the column on the event only for cell scope; still surface its
      // value for the message tokens regardless of scope.
      const columnId = rule.scope === 'cell' ? source : undefined
      return [buildEvent(rule, { row, rowId: id, columnId, value: val(row, source) })]
    }
    if (!matches) active.delete(key)
    return []
  }

  /** relativeChange: fires whenever the change test holds for a prev->next row. */
  function evaluateRelative(
    rule: AlertRule,
    row: TData,
    prev: TData | undefined,
    rows: ReadonlyArray<TData>,
  ): AlertEvent[] {
    if (rule.trigger.type !== 'relativeChange' || prev == null) return []
    const changed = evaluateChange(rule.trigger.expr, ctxFor(row, rows, prev))
    if (!changed) return []
    // Gate on the predicate too, so "price jumped AND price > 100" is expressible.
    if (!evaluatePredicate(rule.predicate, ctxFor(row, rows, prev))) return []
    const columnId = rule.trigger.expr.column
    return [
      buildEvent(rule, {
        row,
        rowId: options.getRowId(row),
        columnId,
        value: val(row, columnId),
      }),
    ]
  }

  function activeRules(): AlertRule[] {
    return rules.filter((r) => r.enabled)
  }

  return {
    setRules(next) {
      rules = next
    },
    getRules() {
      return rules
    },
    needsPrev() {
      return rules.some((r) => r.enabled && r.trigger.type === 'relativeChange')
    },
    needsFullSet() {
      return rules.some((r) => r.enabled && r.scope === 'aggregate')
    },
    reset() {
      active.clear()
    },

    evaluate(rows) {
      const events: AlertEvent[] = []
      for (const rule of activeRules()) {
        if (rule.scope === 'aggregate') {
          events.push(...evaluateAggregate(rule, rows))
        } else if (rule.trigger.type === 'dataChange' || rule.trigger.type === 'scheduled') {
          for (const row of rows) events.push(...evaluateDataChangeRow(rule, row, rows))
        }
      }
      return events
    },

    evaluateTransition(prev, next) {
      const prevById = new Map<string, TData>()
      for (const row of prev) prevById.set(options.getRowId(row), row)
      const events: AlertEvent[] = []
      for (const rule of activeRules()) {
        if (rule.scope === 'aggregate') {
          events.push(...evaluateAggregate(rule, next))
          continue
        }
        for (const row of next) {
          const before = prevById.get(options.getRowId(row))
          if (rule.trigger.type === 'relativeChange') {
            events.push(...evaluateRelative(rule, row, before, next))
          } else if (rule.trigger.type === 'dataChange') {
            events.push(...evaluateDataChangeRow(rule, row, next))
          }
        }
      }
      return events
    },

    validateEdit(row, columnId, nextValue) {
      const candidate = { ...(row as Record<string, unknown>), [columnId]: nextValue } as TData
      const events: AlertEvent[] = []
      let vetoed = false
      for (const rule of activeRules()) {
        if (rule.trigger.type !== 'validation') continue
        if (!evaluatePredicate(rule.predicate, ctxFor(candidate))) continue
        events.push(
          buildEvent(rule, {
            row: candidate,
            rowId: options.getRowId(candidate),
            columnId,
            value: nextValue,
          }),
        )
        if (rule.actions.some((a) => a.kind === 'preventEdit')) vetoed = true
      }
      return { vetoed, events }
    },
  }
}
