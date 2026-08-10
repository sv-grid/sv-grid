/**
 * Column metadata for the expression layer - the small, self-contained operator
 * catalogue the editor draws from, plus name <-> id resolution for the
 * `[Bracketed Name]` reference syntax.
 *
 * The operator set mirrors the grid's own filter row (text / number / date),
 * so an expression's operators line up with what a user already knows from the
 * column menu. We keep a local copy rather than importing the grid's internal
 * `filter-operators` module (which is not part of the public surface).
 */
import type { ExcelFilterOperator } from '@svgrid/grid'

/** Coarse value type used to decide which operators a column offers. */
export type ExprColumnType = 'text' | 'number' | 'date' | 'datetime' | 'boolean'

/** A column as the expression layer sees it. */
export type ExprColumn = {
  /** Canonical id (the field key stored in the AST). */
  id: string
  /** Human label; also the token used inside `[Bracketed Name]` references. */
  name?: string
  type?: ExprColumnType
}

/** One operator entry: its label and which column types it applies to. */
export type OperatorMeta = {
  value: ExcelFilterOperator
  label: string
  types: ReadonlyArray<ExprColumnType>
  /** No value input (acts on emptiness alone). */
  valueless?: boolean
  /** Multi-value set membership (renders a token/chip input). */
  set?: boolean
  /** Needs a second value (`valueTo`). */
  range?: boolean
}

const TEXT: ExprColumnType[] = ['text']
const NUM: ExprColumnType[] = ['number']
const DATES: ExprColumnType[] = ['date', 'datetime']
const ALL: ExprColumnType[] = ['text', 'number', 'date', 'datetime', 'boolean']

/** The full operator catalogue, ordered as the editor should present it. */
export const OPERATORS: ReadonlyArray<OperatorMeta> = [
  { value: 'equals', label: 'Equals', types: ALL },
  { value: 'notEquals', label: 'Not equals', types: ALL },
  { value: 'contains', label: 'Contains', types: TEXT },
  { value: 'notContains', label: 'Not contains', types: TEXT },
  { value: 'startsWith', label: 'Starts with', types: TEXT },
  { value: 'endsWith', label: 'Ends with', types: TEXT },
  { value: 'regex', label: 'Matches regex', types: TEXT },
  { value: 'greaterThan', label: 'Greater than', types: [...NUM, ...DATES] },
  { value: 'lessThan', label: 'Less than', types: [...NUM, ...DATES] },
  { value: 'between', label: 'Between', types: [...NUM, ...DATES], range: true },
  { value: 'in', label: 'In', types: ['text', 'number'], set: true },
  { value: 'notIn', label: 'Not in', types: ['text', 'number'], set: true },
  { value: 'isBlank', label: 'Is blank', types: ALL, valueless: true },
  { value: 'isNotBlank', label: 'Is not blank', types: ALL, valueless: true },
]

const BY_VALUE = new Map<ExcelFilterOperator, OperatorMeta>(
  OPERATORS.map((op) => [op.value, op]),
)

/** Metadata for one operator (falls back to a plain `equals`). */
export function operatorMeta(op: ExcelFilterOperator): OperatorMeta {
  return BY_VALUE.get(op) ?? { value: 'equals', label: 'Equals', types: ALL }
}

/** Operators valid for a column type (defaults to the text set). */
export function operatorsForType(type: ExprColumnType | undefined): OperatorMeta[] {
  const t = type ?? 'text'
  return OPERATORS.filter((op) => op.types.includes(t))
}

/** Whether an operator needs no value input. */
export function isValueless(op: ExcelFilterOperator): boolean {
  return operatorMeta(op).valueless === true
}

/** Whether an operator takes a multi-value token list. */
export function isSetOperator(op: ExcelFilterOperator): boolean {
  return operatorMeta(op).set === true
}

/** Whether an operator needs a second (`valueTo`) value. */
export function isRangeOperator(op: ExcelFilterOperator): boolean {
  return operatorMeta(op).range === true
}

/** Look a column up by its canonical id. */
export function columnById(
  columns: ReadonlyArray<ExprColumn>,
  id: string,
): ExprColumn | undefined {
  return columns.find((c) => c.id === id)
}

/**
 * Resolve a reference (as written in an expression) to a column id. A reference
 * matches a column id first, then a column name (case-insensitive) - so both
 * `price` and `[Unit Price]` resolve. Returns the raw ref unchanged when
 * nothing matches, leaving `validateExpression` to flag it.
 */
export function resolveColumnRef(
  columns: ReadonlyArray<ExprColumn>,
  ref: string,
): string {
  if (columnById(columns, ref)) return ref
  const lc = ref.toLowerCase()
  const byName = columns.find((c) => (c.name ?? '').toLowerCase() === lc)
  return byName ? byName.id : ref
}

/** The display label for a column id (its name, or the id itself). */
export function columnLabel(
  columns: ReadonlyArray<ExprColumn>,
  id: string,
): string {
  return columnById(columns, id)?.name ?? id
}

/**
 * How a column id should be written inside an expression: `[Name]` when the
 * label has spaces or non-word characters, otherwise the bare id.
 */
export function columnRefText(
  columns: ReadonlyArray<ExprColumn>,
  id: string,
): string {
  const label = columnLabel(columns, id)
  return /^[A-Za-z_$][\w$]*$/.test(label) ? label : `[${label}]`
}
