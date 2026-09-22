/**
 * One glyph per demo category, so the gallery sidebar scans by shape before
 * the eye reads the label. 24x24 stroke paths (no fill), drawn with the same
 * pen as the per-component glyphs of the SvGrid UI lane; the shells render
 * them at 14px in a group head and 12px in a chip.
 *
 * Both galleries read this file: the standalone shell through the registry,
 * svgrid.com through website/src/lib/demos.ts. A category missing here falls
 * back to the plain grid glyph rather than to nothing, so a new category
 * shows up with a placeholder until someone draws it.
 */
export const CATEGORY_ICON_PATHS: Record<string, string> = {
  // SvGrid lane
  'Getting Started': 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  'Editing': 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  'Filtering & Search': 'M3 5h18l-7 8v6l-4 2v-8z',
  'Sorting & Grouping': 'M4 6h9 M4 12h6 M4 18h3 M17 5v14 M13.5 15.5 17 19l3.5-3.5',
  'Selection & Clipboard': 'M9 4h6v3H9z M9 5H6v16h12V5h-3 M9 13l2 2 4-4',
  'Columns': 'M3 4h18v16H3z M9 4v16 M15 4v16',
  'Rows & Cells': 'M3 4h18v16H3z M3 10h18 M3 16h18',
  'Tree & Hierarchy': 'M5 3h6v4H5z M13 10h6v4h-6z M13 17h6v4h-6z M8 7v10h5 M8 12h5',
  'Master-Detail & Forms': 'M4 4h16v4H4z M4 12h16v8H4z M8 16h8',
  'Server-Side Data': 'M3 5h18v5H3z M3 14h18v5H3z M7 7.5h.01 M7 16.5h.01',
  'Server-Side Row Model': 'M12 3c5 0 8 1.3 8 3s-3 3-8 3-8-1.3-8-3 3-3 8-3z M4 6v12c0 1.7 3 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3 3 8 3s8-1.3 8-3',
  'Real-time & Streaming': 'M3 12h4l3-8 4 16 3-8h4',
  'Spreadsheet': 'M3 4h18v16H3z M3 9h18 M3 14h18 M9 4v16 M15 4v16',
  'Themes & Styling': 'M12 3a9 9 0 1 0 2.5 17.6 1.8 1.8 0 0 0-1.2-3.1H12a2 2 0 0 1 0-4h2a4 4 0 0 0 4-4 6.5 6.5 0 0 0-6-6.5z M7.5 12h.01 M10 8h.01 M15 9h.01',
  'Keyboard & Accessibility': 'M3 6h18v12H3z M7 10h.01 M11 10h.01 M15 10h.01 M7 14h10',
  'Mobile & Responsive': 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2',
  'Integrations': 'M9 3v4 M15 3v4 M6 7h12v4a6 6 0 0 1-12 0z M12 17v4',
  'Industry Templates': 'M3 8h18v12H3z M8 8V5h8v3 M3 13h18',
  'Headless': 'M8 6l-5 6 5 6 M16 6l5 6-5 6',
  'AI': 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  'Charts': 'M3 3v18h18 M8 16v-5 M13 16V8 M18 16v-3',
  'Data Export & Import': 'M12 3v12 M8 11l4 4 4-4 M4 17v3h16v-3',
  'Studio': 'M3 4h18v4H3z M3 12h6v8H3z M13 12h8v8h-8z',
  'Alerts': 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21h4',
  'Pivot Grid': 'M3 3h8v8H3z M13 7h8 M18 4l3 3-3 3 M7 13v8 M4 18l3 3 3-3',
  'Kanban': 'M4 4h4v16H4z M10 4h4v10h-4z M16 4h4v7h-4z',
  'Scheduler': 'M7 2v3 M17 2v3 M3 9h18 M4 5h16v16H4z M9 14l2 2 4-4',
  'Gantt': 'M3 5h9v3H3z M8 10.5h10v3H8z M13 16h8v3h-8z',
  'Community': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  // SvGrid UI lane
  'Recipes': 'M3 6h18v12H3z M3 10h18 M6 15h4',
  'Date & Time': 'M4 5h16v5H4z M7 2v3 M17 2v3 M4 10h16 M15.5 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M15.5 16v2l1.4 1',
  'Buttons & Toggles': 'M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z M16 12a1 1 0 1 0 .01 0',
  'Inputs': 'M4 7h16v10H4z M8 10v4 M8 12h5',
  'Selection': 'M4 7h16v5H4z M15 15.5l3 3 3-3',
  'Range & Feedback': 'M3 12h6 M15 12h6 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'Layout': 'M3 4h18v16H3z M3 10h18 M10 10v10',
  'Blocks': 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  'Headless Editors': 'M8 6l-5 6 5 6 M16 6l5 6-5 6',
}

/** The plain grid: what a category without a glyph of its own shows. */
export const CATEGORY_ICON_FALLBACK = 'M3 4h18v16H3z M3 10h18 M9 4v16'

/**
 * One glyph per product of the switcher the demos gallery and the docs share
 * (SvGrid / SvGrid UI / Enterprise / Spreadsheet / Studio), same pen as the
 * category glyphs: a header-row table for the grid, a 2x2 of tiles for the
 * component kit, a stack of layers for the modules on top of the grid, and
 * the Spreadsheet and Studio categories' own glyphs for the two views.
 */
export const PRODUCT_ICON_PATHS = {
  grid: 'M3 4h18v16H3z M3 10h18 M3 15h18 M10 10v10',
  ui: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  enterprise: 'M12 4.5 3 9.5l9 5 9-5-9-5z M3 14.5l9 5 9-5',
  sheet: CATEGORY_ICON_PATHS['Spreadsheet']!,
  studio: CATEGORY_ICON_PATHS['Studio']!,
} as const

/** The 24x24 stroke path for a category's glyph. */
export function categoryIcon(category: string): string {
  return CATEGORY_ICON_PATHS[category] ?? CATEGORY_ICON_FALLBACK
}
