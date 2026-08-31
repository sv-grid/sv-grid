# `@svgrid/grid` · `filtering/filter-operator-catalogue.ts`

Auto-generated. Source: `packages\grid\src\filtering\filter-operator-catalogue.ts`.

### `type FilterValueType`

Coarse value type used to decide which operators a column offers. */

```ts
export type FilterValueType = 'text' | 'number' | 'date' | 'datetime' | 'boolean'
```

### `const ALL_FILTER_OPERATORS`

Every filter operator, in the grid's filter-menu order. Any surface that
presents operators should be able to account for all of these.

```ts
export const ALL_FILTER_OPERATORS: ReadonlyArray<ExcelFilterOperator> = [
  'contains',
  'notContains',
  'equals',
  'notEquals',
  'startsWith',
  'endsWith',
  'regex',
  'in',
  'notIn',
  'greaterThan',
  'lessThan',
  'between',
  'isBlank',
  'isNotBlank',
]
```

### `const SET_OPERATOR_IDS`

Operators whose predicate is a set-membership test over a token list.
 A filter UI renders a multi-value chip input for these. */

```ts
export const SET_OPERATOR_IDS: ReadonlyArray<ExcelFilterOperator> = ['in', 'notIn']
```

### `const VALUELESS_OPERATOR_IDS`

Operators that need no value input - they act on emptiness alone. */

```ts
export const VALUELESS_OPERATOR_IDS: ReadonlyArray<ExcelFilterOperator> = [
  'isBlank',
  'isNotBlank',
]
```

### `const RANGE_OPERATOR_IDS`

Operators that need a second value (`valueTo`). */

```ts
export const RANGE_OPERATOR_IDS: ReadonlyArray<ExcelFilterOperator> = ['between']
```

### `function isSetOperator`

Whether an operator takes a multi-value token list. */

```ts
export function isSetOperator(op: ExcelFilterOperator): boolean {
  return SET_OPERATOR_IDS.includes(op)
}
```

### `function isValuelessOperator`

Whether an operator needs no value input. */

```ts
export function isValuelessOperator(op: ExcelFilterOperator): boolean {
  return VALUELESS_OPERATOR_IDS.includes(op)
}
```

### `function isRangeOperator`

Whether an operator needs a second (`valueTo`) value. */

```ts
export function isRangeOperator(op: ExcelFilterOperator): boolean {
  return RANGE_OPERATOR_IDS.includes(op)
}
```
