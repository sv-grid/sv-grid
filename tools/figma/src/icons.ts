/**
 * SVG sources for the icons the kit draws, copied from the components that
 * render them. Grid icons share one root (SvGrid.svelte:839-848): 24x24
 * viewBox, stroke currentColor, stroke-width 2.2, round caps and joins.
 */

const grid = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** SvGrid.svelte:849-967 */
export const GRID_ICONS = {
  sort: grid('<path d="M8 10l4-4 4 4"/><path d="M8 14l4 4 4-4"/>'),
  'sort-asc': grid('<path d="M6 14l6-6 6 6"/>'),
  'sort-desc': grid('<path d="M6 10l6 6 6-6"/>'),
  filter: grid('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
  menu: grid('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
  group: grid('<path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16.5l8 4.5 8-4.5"/>'),
  x: grid('<path d="M18 6L6 18"/><path d="M6 6l12 12"/>'),
  'chevron-down': grid('<path d="M6 9l6 6 6-6"/>'),
  'chevron-right': grid('<path d="m9 18 6-6-6-6"/>'),
  search: grid('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  'op-contains': grid('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  'pin-left': grid('<path d="M5 5v14"/><path d="M9 9h10"/><path d="M9 15h7"/>'),
  'pin-right': grid('<path d="M8 5l9 7-9 7"/>'),
  autosize: grid('<path d="M3 12h18"/><path d="M3 12l4-4"/><path d="M3 12l4 4"/><path d="M21 12l-4-4"/><path d="M21 12l-4 4"/>'),
  columns: grid('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>'),
  reset: grid('<path d="M3 4v6h6"/><path d="M3.5 10A9 9 0 1 0 6 5.3"/>'),
  'tool-panel': grid('<rect x="3" y="4" width="6" height="16" rx="1"/><rect x="11" y="4" width="4" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>'),
  chart: grid('<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>'),
  'advanced-filter': grid('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
  'op-notContains': grid('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/><path d="M7 11h8"/>'),
  'op-equals': grid('<path d="M5 9.5h14"/><path d="M5 14.5h14"/>'),
  'op-notEquals': grid('<path d="M5 9.5h14"/><path d="M5 14.5h14"/><path d="M16 5l-8 14"/>'),
  'op-startsWith': grid('<path d="M5 5v14"/><path d="M9 9h10"/><path d="M9 15h7"/>'),
  'op-endsWith': grid('<path d="M19 5v14"/><path d="M15 9H5"/><path d="M15 15H8"/>'),
  'op-regex': grid('<path d="M12 5v9"/><path d="M8.1 7.4l7.8 4.5"/><path d="M15.9 7.4l-7.8 4.5"/><circle cx="6" cy="18" r="1.4" fill="currentColor" stroke="none"/>'),
  'op-in': grid('<path d="M14 5a7 7 0 1 0 0 14"/><path d="M6 12h9"/><path d="M12 9l3 3-3 3"/>'),
  'op-notIn': grid('<path d="M14 5a7 7 0 1 0 0 14"/><path d="M15 12H6"/><path d="M9 9l-3 3 3 3"/>'),
  'op-greaterThan': grid('<path d="M8 5l9 7-9 7"/>'),
  'op-lessThan': grid('<path d="M16 5l-9 7 9 7"/>'),
  'op-between': grid('<path d="M5 5v14"/><path d="M19 5v14"/><path d="M9 12h6"/>'),
  'op-isBlank': grid('<circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/>'),
  'op-isNotBlank': grid('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>'),
} as const

/** Selection bar (Enterprise) icons, SvGridSelectionBar.svelte:197-237. */
export const SELBAR_ICONS = {
  clear: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  more: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
} as const

export type GridIcon = keyof typeof GRID_ICONS

/** Scrollbar arrow, sv-grid-scrollbar.ts:12-24 (stroke-width 3). */
export const SCROLL_ARROW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'

/** UI kit icons, each from the file in its comment. */
export const UI_ICONS = {
  /** SvDropDownList.svelte:243 */
  'select-chevron':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  /** SvCheckBox.svelte:71 */
  check:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  /** SvCheckBox.svelte:69 */
  indeterminate:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><path d="M4 8h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  /** SvTabs.svelte:149 */
  'tab-close':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  /** SvMenuList.svelte:101 */
  'menu-chevron':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  /** SvDateTimePicker.svelte:198 */
  calendar:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  /** SvCalendar.svelte:254 */
  'month-prev':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  /** SvCalendar.svelte:258 */
  'month-next':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
} as const

/**
 * Placeholder glyph for a button's optional icon slot. SvButton imposes no
 * icon; this is the grid's own `+`-free set, so the kit uses `columns`.
 */
export const BUTTON_ICON = GRID_ICONS.columns
