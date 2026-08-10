/**
 * Grid chrome localization. Every user-visible UI string the grid renders itself
 * (empty state, tool panel, pager, status bar, group labels, filter operators,
 * context-menu items, upsell notes) lives here as a flat message map with English
 * defaults. Pass `localeText` on `<SvGrid>` to override any subset; unset keys
 * fall back to English, so omitting `localeText` is a no-op.
 *
 * This mirrors the editor kit's `resolveMessages` pattern (editor-contract.ts) so
 * chrome and editors share one localization idiom.
 */
import { resolveMessages } from './editor-contract'

/** Every localizable chrome string, grouped by area in the comments. */
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

/** English defaults - the literal strings the grid shipped before localization. */
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

/**
 * Merge a consumer's `localeText` over the English defaults. Undefined/empty
 * values fall back to the default (via `resolveMessages`), so a partial map only
 * replaces the keys it sets.
 */
export function resolveGridMessages(overrides?: Partial<GridMessages> | null): GridMessages {
  return resolveMessages(defaultGridMessages, overrides)
}
