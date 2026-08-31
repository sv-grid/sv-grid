# `@svgrid/grid` · `grid-messages.ts`

Auto-generated. Source: `packages\grid\src\grid-messages.ts`.

### `type GridMessages`

Every localizable chrome string, grouped by area in the comments. */

```ts
export type GridMessages = {
  // Empty / loading state
  noRows: string
  loading: string
  // Tool panel
  columns: string
  filters: string
  clearFilter: string
  // Pagination
  pageSize: string
  page: string
  of: string
  firstPage: string
  prevPage: string
  nextPage: string
  lastPage: string
  // Status bar aggregate labels
  statCount: string
  statSum: string
  statAvg: string
  statMin: string
  statMax: string
  // Grouping chrome
  group: string
  grandTotal: string
  total: string
  rowsSuffix: string
  rowSuffix: string
  // Screen-reader announcements. Unlike the labels above these are whole
  // sentences, so they take `{placeholders}` - a translator needs to control
  // word order, which assembling atoms in English order does not allow.
  announceFilterResults: string
  announceNoMatches: string
  announceFiltersCleared: string
  announceRowsSelected: string
  announceSelectionCleared: string
  // Advanced-filter toolbar chip
  advancedFilterActive: string
  advancedFilterClear: string
  // Filter operator labels (mirror filterOperatorOptions ids)
  opContains: string
  opNotContains: string
  opEquals: string
  opNotEquals: string
  opStartsWith: string
  opEndsWith: string
  opRegex: string
  opIn: string
  opNotIn: string
  opGreaterThan: string
  opLessThan: string
  opBetween: string
  opIsBlank: string
  opIsNotBlank: string
  // Date-column relabels for less/greater than
  opBefore: string
  opAfter: string
  // Context menu
  menuCopy: string
  menuCut: string
  menuPaste: string
  menuClear: string
  menuInsertRowAbove: string
  menuInsertRowBelow: string
  menuRemoveRow: string
  menuRemoveColumn: string
  menuEditComment: string
  chartRange: string
  // Upsell notes (enterprise views not installed)
  pivotUpsellTitle: string
  pivotUpsellBody: string
}
```

### `const defaultGridMessages`

English defaults - the literal strings the grid shipped before localization. */

```ts
export const defaultGridMessages: GridMessages = {
  noRows: 'No rows to display.',
  loading: 'Loading grid data...',
  columns: 'Columns',
  filters: 'Filters',
  clearFilter: 'Clear filter',
  pageSize: 'Page Size:',
  page: 'Page',
  of: 'of',
  firstPage: 'First page',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  statCount: 'Count',
  statSum: 'Sum',
  statAvg: 'Avg',
  statMin: 'Min',
  statMax: 'Max',
  group: 'Group',
  grandTotal: 'Grand total',
  total: 'Total',
  rowsSuffix: 'rows',
  rowSuffix: 'row',
  announceFilterResults: '{visible} of {total} rows match the current filters',
  announceNoMatches: 'No rows match the current filters',
  announceFiltersCleared: 'Filters cleared, showing all {total} rows',
  announceRowsSelected: '{count} rows selected',
  announceSelectionCleared: 'Selection cleared',
  advancedFilterActive: 'Advanced filter',
  advancedFilterClear: 'Clear advanced filter',
  menuCopy: 'Copy',
  menuCut: 'Cut',
  menuPaste: 'Paste',
  menuClear: 'Clear',
  menuInsertRowAbove: 'Insert row above',
  menuInsertRowBelow: 'Insert row below',
  menuRemoveRow: 'Remove row',
  menuRemoveColumn: 'Remove column',
  menuEditComment: 'Edit comment',
  opContains: 'Contains',
  opNotContains: 'Not contains',
  opEquals: 'Equals',
  opNotEquals: 'Not equals',
  opStartsWith: 'Starts with',
  opEndsWith: 'Ends with',
  opRegex: 'Regex',
  opIn: 'In',
  opNotIn: 'Not in',
  opGreaterThan: 'Greater than',
  opLessThan: 'Less than',
  opBetween: 'Between',
  opIsBlank: 'Blank',
  opIsNotBlank: 'Not blank',
  opBefore: 'Before',
  opAfter: 'After',
  chartRange: 'Chart selected range',
  pivotUpsellTitle: 'Pivot mode',
  pivotUpsellBody: 'Pivot mode is an Enterprise feature. Install @svgrid/enterprise and call enablePivot() to use it.',
}
```

### `function resolveGridMessages`

Merge a consumer's `localeText` over the English defaults. Undefined/empty
values fall back to the default (via `resolveMessages`), so a partial map only
replaces the keys it sets.

```ts
export function resolveGridMessages(overrides?: Partial<GridMessages> | null): GridMessages {
  return resolveMessages(defaultGridMessages, overrides)
}
```
