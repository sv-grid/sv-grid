/**
 * The words of the grid's menus and find bar: the column menu, the filter
 * panel, the column chooser, the comment editor. Pass any subset through
 * `localization.text` on `<SvGrid>`; unset keys stay English.
 *
 * A module of its own for the reason chart-panel-messages.ts is: the defaults in
 * grid-messages.ts are base-bundle code every grid pays for, and these load with
 * the menus and the find bar, which are lazy chunks. The type joins
 * `GridMessages` so `localization.text` accepts the keys.
 */
import { resolveMessages } from './editor-contract'

/** Every localizable menu and find-bar string. */
export type GridMenuMessages = typeof defaultGridMenuMessages

export const defaultGridMenuMessages = {
  // Column menu
  menuSortAscending: 'Sort ascending',
  menuSortDescending: 'Sort descending',
  /** `{label}` is the field's own sort wording, such as "A → Z". */
  menuSortBy: 'Sort {label}',
  menuRemoveSort: 'Remove sort',
  menuPinLeft: 'Pin to left',
  menuPinRight: 'Pin to right',
  menuUnpin: 'Unpin column',
  menuAutosize: 'Autosize this column',
  menuAutosizeAll: 'Autosize all columns',
  menuGroupBy: 'Group by this column',
  menuRemoveGrouping: 'Remove grouping',
  menuChooseColumns: 'Choose columns',
  menuResetColumns: 'Reset columns',
  menuTabGeneral: 'General',
  menuTabFilter: 'Filter',
  menuTabColumns: 'Columns',
  menuVisibleColumns: 'Visible columns',
  // Filter panel
  filterCondition: 'Filter condition',
  filterSecondCondition: 'Second filter condition',
  filterCombine: 'Combine conditions',
  filterAnd: 'AND',
  filterOr: 'OR',
  filterRemoveSecond: 'Remove second condition',
  filterAddCondition: '+ Add condition',
  filterValue: 'Filter value...',
  filterValues: 'value, value...',
  filterPattern: 'Pattern...',
  filterFrom: 'From',
  filterTo: 'To',
  filterPickRange: 'Pick a range...',
  filterSearchValues: 'Search values...',
  filterValuesLabel: 'Filter values',
  filterSelectAll: '(Select all)',
  filterSelectAllResults: '(Select all results)',
  filterNoValues: 'No values',
  /** `{shown}` of `{total}` values listed. */
  filterShowing: 'Showing {shown} of {total}',
  filterDone: 'Done',
  // Comment editor
  commentPlaceholder: 'Add a comment…',
  commentRemove: 'Remove',
  commentCancel: 'Cancel',
  commentSave: 'Save',
  // Find bar
  findLabel: 'Find in grid',
  findPlaceholder: 'Find in grid…',
  findNoMatches: 'No matches',
  /** `{at}` of `{total}` matches. */
  findCount: '{at} of {total}',
  findPrevious: 'Previous match',
  findNext: 'Next match',
  findClose: 'Close find',
}

/** The defaults with what `localization.text` sets over them. */
export function resolveGridMenuMessages(overrides?: Partial<GridMenuMessages> | null): GridMenuMessages {
  return resolveMessages(defaultGridMenuMessages, overrides)
}
