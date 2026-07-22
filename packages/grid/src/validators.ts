/**
 * validators - a declarative, framework-free validation-rule library for SvForm
 * (and any editor). Each rule builder returns a `Validator`: a pure function
 * `(value, allValues?) => errorMessage | null`. Compose them per field; the form
 * runs them in order and shows the first failure. Parity: Smart `smart.validator`
 * (required / email / pattern / min / max / range / stringLength / compare ...).
 *
 * ```ts
 * import { rules } from '@svgrid/grid'
 * const field = { name: 'email', label: 'Email', rules: [rules.required(), rules.email()] }
 * ```
 */
export type Validator = (value: any, values?: Record<string, any>) => string | null | undefined
export type RuleOptions = { message?: string }
export type CompareOp = '==' | '===' | '!=' | '<' | '<=' | '>' | '>='

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i
const ZIP_RE = /^\d{5}(-\d{4})?$/

/** Empty for validation purposes: null/undefined, '', or an empty array. */
export function isEmptyValue(v: any): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0)
}

function compareOk(a: any, b: any, op: CompareOp): boolean {
  switch (op) {
    case '==': return a == b // eslint-disable-line eqeqeq
    case '===': return a === b
    case '!=': return a != b // eslint-disable-line eqeqeq
    case '<': return Number(a) < Number(b)
    case '<=': return Number(a) <= Number(b)
    case '>': return Number(a) > Number(b)
    case '>=': return Number(a) >= Number(b)
  }
}

/** The declarative rule builders. Every builder skips empty values (except
 *  `required`) so optional fields validate format only when filled. */
export const rules = {
  required: (o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) ? o?.message ?? 'This field is required' : null,

  email: (o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || EMAIL_RE.test(String(v)) ? null : o?.message ?? 'Enter a valid email address',

  url: (o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || URL_RE.test(String(v)) ? null : o?.message ?? 'Enter a valid URL',

  zipCode: (o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || ZIP_RE.test(String(v)) ? null : o?.message ?? 'Enter a valid ZIP code',

  pattern: (re: RegExp, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || re.test(String(v)) ? null : o?.message ?? 'Invalid format',

  numeric: (o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || !isNaN(Number(v)) ? null : o?.message ?? 'Must be a number',

  integer: (o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || Number.isInteger(Number(v)) ? null : o?.message ?? 'Must be a whole number',

  min: (n: number, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || Number(v) >= n ? null : o?.message ?? `Must be at least ${n}`,

  max: (n: number, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || Number(v) <= n ? null : o?.message ?? `Must be at most ${n}`,

  range: (lo: number, hi: number, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || (Number(v) >= lo && Number(v) <= hi) ? null : o?.message ?? `Must be between ${lo} and ${hi}`,

  minLength: (n: number, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || String(v).length >= n ? null : o?.message ?? `Must be at least ${n} characters`,

  maxLength: (n: number, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || String(v).length <= n ? null : o?.message ?? `Must be at most ${n} characters`,

  stringLength: (lo: number, hi: number, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || (String(v).length >= lo && String(v).length <= hi)
      ? null
      : o?.message ?? `Must be ${lo}-${hi} characters`,

  oneOf: (allowed: ReadonlyArray<string | number>, o?: RuleOptions): Validator => (v) =>
    isEmptyValue(v) || allowed.includes(v) ? null : o?.message ?? 'Invalid choice',

  /** Compare against another field's value (cross-field): e.g. confirm password. */
  compare: (otherField: string, op: CompareOp = '===', o?: RuleOptions): Validator => (v, values) =>
    compareOk(v, values?.[otherField], op) ? null : o?.message ?? 'Values do not match',

  /** Wrap an arbitrary predicate/function as a rule. */
  custom: (fn: Validator): Validator => fn,
}

/** Run a list of rules against a value; return the first error message, or null. */
export function runRules(
  value: any,
  ruleList: ReadonlyArray<Validator> | undefined,
  values?: Record<string, any>,
): string | null {
  if (!ruleList) return null
  for (const rule of ruleList) {
    const err = rule(value, values)
    if (err) return err
  }
  return null
}
