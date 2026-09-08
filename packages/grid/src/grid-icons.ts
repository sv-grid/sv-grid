/**
 * Grid chrome icons. Every glyph `<SvGrid>` draws for its own UI - sort
 * indicators, the filter funnel, expanders, the pager arrows, tool-panel
 * buttons - has a name here, and the `icons` prop replaces any subset of them.
 *
 * This mirrors `grid-messages.ts`: a name-keyed map with built-in defaults,
 * where an unset name keeps the default. A partial map is all a consumer ever
 * needs, so `icons` is safe to pass without knowing the full catalogue. That
 * matters more than it looks - a single catch-all snippet would make the
 * consumer responsible for every name the grid can ask for, and missing one
 * renders an empty box. The `op-between` comment in SvGrid.svelte records what
 * that looks like when it ships.
 *
 * Deliberately NOT in here:
 *   - the scrollbar stepper arrows. `sv-grid-scrollbar.ts` is a custom element
 *     that builds its SVG with `createElementNS` inside a shadow root, on
 *     purpose, so it stays compatible with strict CSP / Trusted Types. A Svelte
 *     snippet cannot render there. Theme it with the `--sg-scrollbar-*` tokens.
 *   - the checkbox tick and its indeterminate dash. Both are `::after`
 *     pseudo-elements drawn from borders (SvGrid.css), a form-control
 *     affordance rather than an icon, and they render once per visible row.
 *   - conditional formatting's `iconSet`. Those are value-driven data glyphs a
 *     consumer already chooses; a different concept that shares the word.
 */
import type { Snippet } from 'svelte'

/**
 * Every icon `<SvGrid>` draws for its own chrome. Pass any subset of these to
 * the `icons` prop to swap the built-in glyph for your own markup.
 */
export type GridIconName =
  // ---- Header + column menu ----
  | 'sort'
  | 'sort-asc'
  | 'sort-desc'
  | 'filter'
  | 'menu'
  | 'group'
  | 'x'
  | 'chevron-down'
  | 'chevron-right'
  | 'autosize'
  | 'columns'
  | 'reset'
  // ---- Filter operators (mirror `iconName` in filter-operators.ts) ----
  | 'op-contains'
  | 'op-notContains'
  | 'op-equals'
  | 'op-notEquals'
  | 'op-startsWith'
  | 'op-endsWith'
  | 'op-regex'
  | 'op-in'
  | 'op-notIn'
  | 'op-greaterThan'
  | 'op-lessThan'
  | 'op-between'
  | 'op-isBlank'
  | 'op-isNotBlank'
  // ---- Pinning. Their defaults borrow the operator glyphs above, but they get
  // their own names so overriding a filter operator does not silently repaint
  // the pin menu. ----
  | 'pin-left'
  | 'pin-right'
  | 'unpin'
  // ---- Toolbar + overlays ----
  | 'search'
  | 'tool-panel'
  | 'chart'
  | 'advanced-filter'
  | 'column-group-caret'
  // ---- Glyph icons: the built-in is a character, not a path ----
  | 'close'
  | 'clear'
  | 'remove'
  | 'row-number'
  | 'pinned-row-top'
  | 'pinned-row-bottom'
  | 'find-prev'
  | 'find-next'
  | 'move-up'
  | 'move-down'
  | 'group-add'
  | 'page-first'
  | 'page-prev'
  | 'page-next'
  | 'page-last'
  | 'page-size-caret'
  | 'drag-handle'
  | 'breadcrumb-separator'

/**
 * Consumer icon overrides, keyed by name. Any subset; names you leave out keep
 * their built-in glyph, so `icons` never has to be exhaustive.
 */
export type GridIcons = Partial<Record<GridIconName, Snippet>>

/**
 * Icons whose built-in form is a character rather than an SVG path. Kept as
 * data so `<SvGrid>`, its footer and the standalone `SvRowGroupPanel` render
 * the same defaults instead of three copies drifting apart.
 *
 * Each is the exact character that shipped inline before, so a grid that sets
 * no `icons` renders byte-for-byte what it always did.
 */
export const GRID_ICON_GLYPHS: Partial<Record<GridIconName, string>> = {
  close: '✕', // multiplication X
  clear: '✕',
  remove: '×', // multiplication sign
  'row-number': '#',
  'pinned-row-top': '↑', // upwards arrow
  'pinned-row-bottom': '↓', // downwards arrow
  'find-prev': '↑',
  'find-next': '↓',
  'move-up': '↑',
  'move-down': '↓',
  'group-add': '⊞', // squared plus
  'page-first': '⇤', // leftwards arrow to bar
  'page-prev': '‹', // single left-pointing angle quote
  'page-next': '›', // single right-pointing angle quote
  'page-last': '⇥', // rightwards arrow to bar
  'page-size-caret': '▾', // black down-pointing small triangle
  'drag-handle': '⠿', // braille pattern dots-123456, the grip
  'breadcrumb-separator': '›',
}

/**
 * Every icon name, in catalogue order. Exported for tests and docs generation;
 * the grid itself never reads it, so it costs a consumer's bundle nothing.
 */
export const GRID_ICON_NAMES: ReadonlyArray<GridIconName> = [
  'sort',
  'sort-asc',
  'sort-desc',
  'filter',
  'menu',
  'group',
  'x',
  'chevron-down',
  'chevron-right',
  'autosize',
  'columns',
  'reset',
  'op-contains',
  'op-notContains',
  'op-equals',
  'op-notEquals',
  'op-startsWith',
  'op-endsWith',
  'op-regex',
  'op-in',
  'op-notIn',
  'op-greaterThan',
  'op-lessThan',
  'op-between',
  'op-isBlank',
  'op-isNotBlank',
  'pin-left',
  'pin-right',
  'unpin',
  'search',
  'tool-panel',
  'chart',
  'advanced-filter',
  'column-group-caret',
  'close',
  'clear',
  'remove',
  'row-number',
  'pinned-row-top',
  'pinned-row-bottom',
  'find-prev',
  'find-next',
  'move-up',
  'move-down',
  'group-add',
  'page-first',
  'page-prev',
  'page-next',
  'page-last',
  'page-size-caret',
  'drag-handle',
  'breadcrumb-separator',
]
