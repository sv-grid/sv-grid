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
  // Selection bar
  selectionBarLabel: string
  selectionBarCount: string
  selectionBarClear: string
  selectionBarMore: string
  selectionBarSelectAll: string
  selectionBarEditFields: string
  // Bulk edit dialog
  bulkEditTitle: string
  bulkEditLead: string
  bulkEditMixed: string
  bulkEditApply: string
  bulkEditCancel: string
  bulkEditNoFields: string
  chartRange: string
  // Upsell notes (enterprise views not installed)
  pivotUpsellTitle: string
  pivotUpsellBody: string
  /** Shared licensing line under every Enterprise upsell note. */
  upsellLicense: string
  upsellLicenseLink: string
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
  selectionBarLabel: 'Selection actions',
  /** Label beside the count CHIP, which carries the number itself. */
  selectionBarCount: 'selected',
  selectionBarClear: 'Clear selection',
  selectionBarMore: 'More actions',
  selectionBarSelectAll: 'Select all',
  selectionBarEditFields: 'Edit fields',
  bulkEditTitle: 'Edit fields',
  bulkEditLead:
    'Changes apply to all {count} selected items. Fields you leave alone keep their existing values.',
  bulkEditMixed: 'Multiple values',
  bulkEditApply: 'Apply to {count} items',
  bulkEditCancel: 'Cancel',
  bulkEditNoFields: 'No editable fields on this grid.',
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
  upsellLicense:
    'A license key is required for production use. Without one the feature still works, but the grid renders an unlicensed watermark.',
  upsellLicenseLink: 'View licensing',
}

/**
 * Merge a consumer's `localeText` over the English defaults. Undefined/empty
 * values fall back to the default (via `resolveMessages`), so a partial map only
 * replaces the keys it sets.
 */
export function resolveGridMessages(overrides?: Partial<GridMessages> | null): GridMessages {
  return resolveMessages(defaultGridMessages, overrides)
}
