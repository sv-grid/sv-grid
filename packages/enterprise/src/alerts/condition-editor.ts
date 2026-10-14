/**
 * The condition editor an alert rule shows, when a module brings its own.
 *
 * `SvAlertRuleEditor` edits a rule's predicate with the expression editor.
 * SvGrid Base sets this context around its grid so a rule there is written
 * with the view bar's filter ("Where Status is Done and Due date is before
 * today"), stored as an `ext` node, and read with the field types' meaning.
 */
import { getContext, setContext, type Component } from 'svelte'
import type { PredicateExpr } from '../expressions/expression-types'

export type AlertConditionEditor = {
  /** Draws a predicate and reports each change. */
  component: Component<{ value: PredicateExpr; onChange: (next: PredicateExpr) => void }>
  /** The predicate a new rule starts with. */
  initial: () => PredicateExpr
  /** Whether it can show this predicate; one it cannot goes to the expression editor. */
  accepts: (expr: PredicateExpr) => boolean
  /** The tokens a message can name, for the hint under the message box. */
  tokens?: () => string[]
}

const KEY = Symbol('sv-alert-condition-editor')

/** Call during a component's init: rules authored under it use this editor. */
export function setAlertConditionEditor(editor: AlertConditionEditor): void {
  setContext(KEY, editor)
}

export function getAlertConditionEditor(): AlertConditionEditor | undefined {
  return getContext<AlertConditionEditor | undefined>(KEY)
}
