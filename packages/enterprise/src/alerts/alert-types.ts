/**
 * Alert Rules engine - the model layer.
 *
 * An alert rule is a declarative "when this predicate holds (or this value
 * moves), do these things": raise a toast, paint a badge/highlight, flash the
 * cell, veto the edit, or log it. Rules are authored by end users at runtime,
 * persisted, and shareable - the AdapTable-style alerting surface, built on the
 * grid's own filter/conditional-format engines.
 *
 * Predicates and change tests come from the expression layer (`../expressions`).
 */
import type { ChangeExpr, PredicateExpr } from '../expressions/expression-types'
import type { Schedule } from '../scheduling'

/** Maps onto the toast variants + conditional-format intent. */
export type AlertSeverity = 'info' | 'success' | 'warning' | 'error'

/** What the rule watches over. */
export type AlertScope = 'row' | 'cell' | 'aggregate'

/**
 * When a rule fires:
 * - `dataChange`   - a row newly satisfies `predicate` after an edit/update.
 * - `relativeChange` - a value moved (delta / percent / crossed a threshold).
 * - `validation`   - evaluated on edit; may veto the change (`preventEdit`).
 * - `scheduled`    - re-checked on a cron/one-off schedule (reuses the enterprise
 *                    scheduler); surfaces rows currently matching `predicate`.
 */
export type AlertTrigger =
  | { type: 'dataChange' }
  | { type: 'relativeChange'; expr: ChangeExpr }
  | { type: 'validation' }
  | { type: 'scheduled'; schedule: Schedule }

/** A thing the rule does when it fires. */
export type AlertActionKind =
  | 'toast'
  | 'badge'
  | 'cellFlash'
  | 'highlight'
  | 'preventEdit'
  | 'log'

/** Visual styling for `badge` / `highlight` actions. */
export type AlertActionStyle = {
  background?: string
  color?: string
  /** A short glyph/emoji shown as a badge. */
  icon?: string
}

export type AlertAction = {
  kind: AlertActionKind
  /**
   * Message template. Tokens: `{rule}`, `{severity}`, `{column}`, `{value}`,
   * and `{field}` / `{row.field}` for any row field.
   */
  message?: string
  style?: AlertActionStyle
  /** Columns the badge/highlight/flash targets (defaults to the rule's). */
  columns?: string[]
}

export type AlertRule = {
  id: string
  name: string
  enabled: boolean
  severity: AlertSeverity
  scope: AlertScope
  predicate: PredicateExpr
  trigger: AlertTrigger
  actions: AlertAction[]
  /** Columns in scope for cell-level styling (badge/highlight/flash). */
  columns?: string[]
  createdAt: number
}

/** A single firing of a rule. */
export type AlertEvent = {
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  scope: AlertScope
  triggerType: AlertTrigger['type']
  /** The row that matched (absent for aggregate-scope events). */
  rowId?: string
  /** The column that triggered/targets the event, when applicable. */
  columnId?: string
  value?: unknown
  message: string
  actions: AlertAction[]
  firedAt: number
  acknowledged?: boolean
}
