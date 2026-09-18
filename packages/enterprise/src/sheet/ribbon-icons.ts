/**
 * The ribbon's icons, as path data on a 16 x 16 grid.
 *
 * Drawn here rather than pulled from an icon font or a package: the ribbon
 * is the one place in the library that needs a coordinated set of command
 * glyphs (a clipboard, scissors, a paint bucket, a funnel), and an icon set
 * that is part of the source can be read, tested and tuned like anything
 * else. `SvRibbonIcon.svelte` renders one by name; a large button draws the
 * same paths at twice the size, which is why they are vectors.
 *
 * One style, one colour. These are line icons - a 1.4px stroke with round
 * caps and joins, the way Excel's own monochrome set is drawn - and every
 * one of them is `currentColor`, so they are black on a light ribbon and
 * white on a dark one and never carry a colour of their own. The only fills
 * are the small solid parts Excel also fills: a dot, a corner, the head of
 * an arrow. Colour belongs to the colour bar under Fill Colour and Font
 * Colour, which shows the colour the face will apply, not to the glyph.
 */

export type IconPath = {
  d: string
  /** Solid shape in the icon colour instead of a stroked outline. */
  fill?: boolean
  /** Stroke width when not the default 1.4. */
  width?: number
  /** Dashed stroke, for the "no border" sides. */
  dash?: string
}

export type RibbonIconName =
  | 'undo' | 'redo'
  | 'paste' | 'cut' | 'copy' | 'paste-special'
  | 'font-grow' | 'font-shrink'
  | 'borders' | 'border-none' | 'border-bottom' | 'border-top' | 'border-left' | 'border-right'
  | 'border-all' | 'border-outside' | 'border-thick-bottom'
  | 'fill-colour' | 'font-colour'
  | 'align-left' | 'align-center' | 'align-right' | 'wrap'
  | 'dec-more' | 'dec-less'
  | 'insert-cells' | 'delete-cells' | 'freeze' | 'unfreeze'
  | 'autosum' | 'fill-down' | 'fill-right' | 'clear' | 'find' | 'filter'
  | 'sort-asc' | 'sort-desc' | 'sort'
  | 'chart' | 'table' | 'function' | 'new-sheet'
  | 'file-new' | 'file-open' | 'file-save' | 'file-csv'
  | 'cf-formula'
  | 'trace-precedents' | 'trace-dependents' | 'remove-arrows'
  | 'name-manager' | 'show-formulas' | 'calculate' | 'goal-seek'
  | 'text-to-columns' | 'remove-duplicates'
  | 'chevron-down' | 'format-cells'
  | 'format-painter'
  | 'protect' | 'unprotect' | 'lock' | 'edit-ranges'
  | 'print' | 'page-setup' | 'margins' | 'orientation' | 'paper' | 'print-area' | 'print-titles'
  | 'comment' | 'comment-delete' | 'comment-prev' | 'comment-next' | 'comments-all'
  | 'validation'
  | 'cf' | 'cf-greater' | 'cf-less' | 'cf-between' | 'cf-equal' | 'cf-text' | 'cf-duplicates'
  | 'cf-top' | 'cf-bottom' | 'cf-above' | 'cf-below' | 'cf-bar' | 'cf-scale' | 'cf-icons'
  | 'merge' | 'unmerge'
  | 'gridlines' | 'formula-bar' | 'headings'
  | 'font' | 'number'
  | 'clear-formats' | 'column-width' | 'row-height' | 'hide' | 'unhide'

const SQUARE = 'M2.5 2.5h11v11h-11z'
const CROSS = 'M2.5 8h11M8 2.5v11'
const DASHED = '1.6 1.6'

/** A clipboard: the board, then the clip on top. */
const CLIPBOARD = [
  { d: 'M5.5 3H4.5A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 11.5 3h-1' },
  { d: 'M6 1.5h4a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z' },
]

/** A speech bubble with its tail at the bottom left. */
const BUBBLE = 'M3.5 2.5h9a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H7l-3 2.5v-2.5h-.5A1.5 1.5 0 0 1 2 10V4a1.5 1.5 0 0 1 1.5-1.5z'

/** A sheet of paper with a folded corner. */
const SHEET = [{ d: 'M4 1.5h5.5l3 3v10H4z' }, { d: 'M9.5 1.5v3h3' }]

export const RIBBON_ICONS: Record<RibbonIconName, ReadonlyArray<IconPath>> = {
  /* The curved arrows: an open arc, the head at its tip pointing back down
     to the lower-left (or right); closing the arc any further reads as a
     refresh glyph. */
  undo: [
    { d: 'M3.3 6.6A5.6 5.6 0 1 1 9.6 13.9', width: 1.6 },
    { d: 'M3.3 6.6V2.8M3.3 6.6h3.8', width: 1.6 },
  ],
  redo: [
    { d: 'M12.7 6.6A5.6 5.6 0 1 0 6.4 13.9', width: 1.6 },
    { d: 'M12.7 6.6V2.8M12.7 6.6h-3.8', width: 1.6 },
  ],

  paste: [
    ...CLIPBOARD,
    { d: 'M6 7h4M6 9.5h4M6 12h2.5' },
  ],
  cut: [
    { d: 'M4.5 14a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM11.5 14a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z' },
    { d: 'M6.1 10.2L12.5 2M9.9 10.2L3.5 2' },
  ],
  copy: [
    { d: 'M6 5.5h6.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z' },
    { d: 'M10 5.5V3.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1V9a1 1 0 0 0 1 1H5' },
  ],
  'paste-special': [
    ...CLIPBOARD,
    { d: 'M8 6.5v5M5.5 9h5' },
  ],
  // A brush: the head as a tilted block, the handle running down-left.
  'format-painter': [
    { d: 'M9.2 2.4l4.4 4.4-3.2 3.2-4.4-4.4z' },
    { d: 'M6 5.6L3.2 8.4a1.6 1.6 0 0 0 0 2.3l2.1 2.1a1.6 1.6 0 0 0 2.3 0l2.8-2.8' },
  ],

  'font-grow': [
    { d: 'M2 12.5L5.5 4l3.5 8.5M3.2 9.5h4.6' },
    { d: 'M12.5 3.5v7M10.5 5.5l2-2 2 2' },
  ],
  'font-shrink': [
    { d: 'M2 12.5L5.5 4l3.5 8.5M3.2 9.5h4.6' },
    { d: 'M12.5 3.5v7M10.5 8.5l2 2 2-2' },
  ],

  borders: [{ d: SQUARE, dash: DASHED }, { d: CROSS, dash: DASHED }, { d: 'M2.5 13.5h11', width: 2 }],
  'border-none': [{ d: SQUARE, dash: DASHED }, { d: CROSS, dash: DASHED }],
  'border-bottom': [{ d: SQUARE, dash: DASHED }, { d: CROSS, dash: DASHED }, { d: 'M2.5 13.5h11', width: 2 }],
  'border-top': [{ d: SQUARE, dash: DASHED }, { d: CROSS, dash: DASHED }, { d: 'M2.5 2.5h11', width: 2 }],
  'border-left': [{ d: SQUARE, dash: DASHED }, { d: CROSS, dash: DASHED }, { d: 'M2.5 2.5v11', width: 2 }],
  'border-right': [{ d: SQUARE, dash: DASHED }, { d: CROSS, dash: DASHED }, { d: 'M13.5 2.5v11', width: 2 }],
  'border-all': [{ d: SQUARE, width: 1.6 }, { d: CROSS, width: 1.6 }],
  'border-outside': [{ d: SQUARE, width: 2 }, { d: CROSS, dash: DASHED }],
  'border-thick-bottom': [{ d: SQUARE, dash: DASHED }, { d: CROSS, dash: DASHED }, { d: 'M2.5 13h11', width: 3 }],

  'fill-colour': [
    // A tipped paint bucket with a spilling drop, the shape Excel uses.
    { d: 'M7.5 2.5l5 5-4.3 4.3a1.5 1.5 0 0 1-2.1 0L3 8.7a1 1 0 0 1 0-1.4z' },
    { d: 'M3.2 8h8.6' },
    { d: 'M7.5 2.5L6 1' },
    { d: 'M13.2 9.3c.9 1.1 1.3 1.9 1.3 2.5a1.3 1.3 0 0 1-2.6 0c0-.6.4-1.4 1.3-2.5z', fill: true },
  ],
  'font-colour': [
    { d: 'M3 12.5L7.5 2l4.5 10.5M4.6 9h5.8', width: 1.6 },
  ],

  'align-left': [{ d: 'M2.5 3.5h11M2.5 6.5h7M2.5 9.5h11M2.5 12.5h7' }],
  'align-center': [{ d: 'M2.5 3.5h11M4.5 6.5h7M2.5 9.5h11M4.5 12.5h7' }],
  'align-right': [{ d: 'M2.5 3.5h11M6.5 6.5h7M2.5 9.5h11M6.5 12.5h7' }],
  wrap: [
    { d: 'M2.5 4h11M2.5 8h8a2.25 2.25 0 0 1 0 4.5H8.5M2.5 12h3' },
    { d: 'M10 10.5l-2 2 2 2' },
  ],

  'dec-more': [
    { d: 'M2.6 13h.01', width: 2.2 },
    { d: 'M6 13a1.6 2.2 0 1 0 0-.01M11.2 13a1.6 2.2 0 1 0 0-.01', width: 1.3 },
    { d: 'M7.5 4h6M11.5 2l2 2-2 2' },
  ],
  'dec-less': [
    { d: 'M2.6 13h.01', width: 2.2 },
    { d: 'M6 13a1.6 2.2 0 1 0 0-.01', width: 1.3 },
    { d: 'M13.5 4h-6M9.5 2l-2 2 2 2' },
  ],

  'insert-cells': [
    { d: 'M2.5 2.5h6M2.5 2.5v11h11V8' },
    { d: 'M2.5 8h11M8 2.5v11' },
    { d: 'M12.5 1.5v4M10.5 3.5h4', width: 1.7 },
  ],
  'delete-cells': [
    { d: 'M2.5 2.5h6M2.5 2.5v11h11V6' },
    { d: 'M2.5 8h11M8 2.5v11' },
    { d: 'M10.5 3.5h4', width: 1.7 },
  ],
  freeze: [
    { d: SQUARE },
    { d: 'M2.5 6h11M6 2.5v11', width: 1.6 },
    { d: 'M2.5 2.5h3.5v3.5H2.5z', fill: true },
  ],
  /* An A, for the folded Font group. */
  font: [{ d: 'M3 13.5L8 2.5l5 11M4.9 9.5h6.2' }],
  /* A number sign, for the folded Number group. */
  number: [{ d: 'M6 2.5L4.5 13.5M11.5 2.5L10 13.5M3 6h11M2 10.5h11' }],
  /* A 3x3 of cells: the lines the Gridlines toggle shows and hides. */
  gridlines: [
    { d: SQUARE },
    { d: 'M2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11', width: 1.1 },
  ],
  /* The bar itself: a long box with fx in it. */
  'formula-bar': [
    { d: 'M1.5 5h13v6h-13z' },
    { d: 'M4.8 9.6V7.4a1.1 1.1 0 0 1 1.1-1.1M3.9 8.2h2', width: 1.3 },
    { d: 'M8.3 6.9l3 2.8M11.3 6.9l-3 2.8', width: 1.1 },
  ],
  /* The header band and the row gutter framing a sheet. */
  headings: [
    { d: SQUARE },
    { d: 'M2.5 5.5h11M5.5 2.5v11' },
    { d: 'M7.5 4h.01M9.8 4h.01M12 4h.01M4 7.5h.01M4 9.8h.01M4 12h.01', width: 1.6 },
  ],
  /* The frozen lines dotted, and struck through. */
  unfreeze: [
    { d: SQUARE },
    { d: 'M2.5 6h11M6 2.5v11', dash: DASHED },
    { d: 'M3.5 12.5l9-9' },
  ],

  autosum: [{ d: 'M12 3.5H4l4.5 4.5L4 12.5h8', width: 1.7 }],
  'fill-down': [
    { d: 'M2.5 13.5h11' },
    { d: 'M8 2.5v8M5 7.5l3 3 3-3' },
  ],
  'fill-right': [
    { d: 'M13.5 2.5v11' },
    { d: 'M2.5 8h8M7.5 5l3 3-3 3' },
  ],
  clear: [
    // An eraser on its side: the body, the split between rubber and grip,
    // and the line it is wiping.
    { d: 'M9.5 2.5l4 4-6.5 6.5H4.5L2.5 11l7-8.5z' },
    { d: 'M6 6l4 4' },
    { d: 'M4 14.5h9.5' },
  ],
  /* The eraser, smaller, over an A: formats wiped, the text kept. */
  'clear-formats': [
    { d: 'M2.5 13.5L6 5l3.5 8.5M3.8 10.5h4.4' },
    { d: 'M11.5 2.5l2.5 2.5-4 4-2.5-2.5z' },
    { d: 'M9.5 6.5l2.5 2.5' },
  ],
  /* A column's two edges and the arrow that sets the gap between them. */
  'column-width': [
    { d: 'M4 2v12M12 2v12' },
    { d: 'M5 8h6M6.6 6.4L5 8l1.6 1.6M9.4 6.4L11 8l-1.6 1.6' },
  ],
  'row-height': [
    { d: 'M2 4h12M2 12h12' },
    { d: 'M8 5v6M6.4 6.6L8 5l1.6 1.6M6.4 9.4L8 11l1.6-1.6' },
  ],
  /* An eye, open for Unhide and struck through for Hide. */
  hide: [
    { d: 'M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4-6.2-4-6.2-4z' },
    { d: 'M8 9.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z' },
    { d: 'M3 13L13 3' },
  ],
  unhide: [
    { d: 'M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4-6.2-4-6.2-4z' },
    { d: 'M8 9.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z' },
  ],
  find: [
    { d: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z' },
    { d: 'M10.3 10.3L14 14', width: 1.8 },
  ],
  filter: [
    { d: 'M2.5 3h11l-4.3 5.3v3.9L6.8 13.5V8.3z' },
  ],
  'sort-asc': [
    { d: 'M3 6.5l2-4 2 4M3.6 5.3h2.8', width: 1.2 },
    { d: 'M3.2 9.5h3.6l-3.6 4h3.6', width: 1.2 },
    { d: 'M12 2.5v11M9.5 11l2.5 2.5 2.5-2.5' },
  ],
  'sort-desc': [
    { d: 'M3.2 2.5h3.6l-3.6 4h3.6', width: 1.2 },
    { d: 'M3 13.5l2-4 2 4M3.6 12.3h2.8', width: 1.2 },
    { d: 'M12 2.5v11M9.5 11l2.5 2.5 2.5-2.5' },
  ],
  // Excel's Sort: an arrow each way beside three bars of falling length.
  sort: [
    { d: 'M4 2.5v11M1.5 5L4 2.5 6.5 5', width: 1.3 },
    { d: 'M9 3.5h5.5M9 8h4M9 12.5h2.5', width: 1.3 },
  ],

  chart: [
    { d: 'M2.5 2.5v11h11' },
    { d: 'M4.5 13.5V8h2.5v5.5M8 13.5V4.5h2.5v9M11.5 13.5V10h2v3.5' },
  ],
  /* A table: the header row is the one drawn heavier. */
  table: [
    { d: 'M2.5 3h11v10h-11z' },
    { d: 'M2.5 9.5h11M6.2 6.5v6.5M9.8 6.5v6.5' },
    { d: 'M2.5 6.5h11', width: 2 },
  ],
  function: [
    { d: 'M2.5 3h11v10h-11z' },
    { d: 'M6.8 11V6.5a1.4 1.4 0 0 1 1.4-1.4M5.6 8h2.6', width: 1.5 },
    { d: 'M9 8l2.7 3M11.7 8L9 11', width: 1.3 },
  ],
  'new-sheet': [
    ...SHEET,
    { d: 'M8.2 6.5v5M5.7 9h5', width: 1.7 },
  ],
  // Formula auditing: a dot and an arrow between two cells, and the arrow
  // struck out.
  'trace-precedents': [
    { d: 'M2.5 3.5h4v4h-4zM9.5 8.5h4v4h-4z' },
    { d: 'M4.5 7.5v3h4.5M7.5 9l1.5 1.5L7.5 12', width: 1.3 },
  ],
  'trace-dependents': [
    { d: 'M2.5 3.5h4v4h-4zM9.5 8.5h4v4h-4z' },
    { d: 'M6.5 5.5h5v2.5M10 6.5l1.5 1.5L13 6.5', width: 1.3 },
  ],
  'remove-arrows': [
    { d: 'M2.5 8h9M9.5 6l2 2-2 2', width: 1.3 },
    { d: 'M11 3l3 3M14 3l-3 3', width: 1.3 },
  ],
  // A formula rule: an fx over a shaded cell.
  'cf-formula': [
    { d: 'M2 10.5h12v3.5H2z', fill: true },
    { d: 'M5 8V4.5a1.5 1.5 0 0 1 3 0M3.5 6h3M9.5 3.5l3 4.5M12.5 3.5l-3 4.5', width: 1.3 },
  ],
  // The File tab: a blank page, an opening folder, a floppy, a page of
  // commas.
  'file-new': [
    ...SHEET,
  ],
  'file-open': [
    { d: 'M1.5 4.5v9h11l2-6H4l-2 6' },
    { d: 'M1.5 4.5v-2h4l1.5 1.5h5.5v2.5' },
  ],
  'file-save': [
    { d: 'M2.5 2.5h9l2 2v9h-11z' },
    { d: 'M5 2.5v3.5h5V2.5M4.5 13.5V9h7v4.5' },
  ],
  'file-csv': [
    ...SHEET,
    { d: 'M6 8.5h1M9 8.5h1M6 11h1M9 11h1', width: 1.7 },
  ],
  // A printer: the tray, the page going in, the page coming out.
  print: [
    { d: 'M4.5 6V2.5h7V6' },
    { d: 'M2.5 6h11v5h-2.5v3h-6v-3H2.5z' },
    { d: 'M5 11h6' },
  ],
  // Page Layout: a page with its margins marked, and the same page in
  // each of the other guises.
  'page-setup': [
    { d: 'M3.5 1.5h9v13h-9z' },
    { d: 'M5.5 3.5h5v9h-5z', width: 1 },
  ],
  margins: [
    { d: 'M3.5 1.5h9v13h-9z' },
    { d: 'M5.5 1.5v13M10.5 1.5v13M3.5 3.5h9M3.5 12.5h9', width: 1 },
  ],
  orientation: [
    { d: 'M2 4.5h7v9H2z' },
    { d: 'M9 2.5h5v5H9z' },
  ],
  paper: [
    { d: 'M3.5 1.5h9v13h-9z' },
    { d: 'M5.5 5h5M5.5 8h5M5.5 11h3', width: 1.3 },
  ],
  'print-area': [
    { d: 'M2.5 2.5h11v11h-11z' },
    { d: 'M5 5h6v6H5z', fill: true },
  ],
  'print-titles': [
    { d: 'M2.5 2.5h11v11h-11z' },
    { d: 'M2.5 5.5h11', width: 2 },
    { d: 'M2.5 8.5h11M2.5 11.5h11', width: 1 },
  ],

  'name-manager': [
    { d: 'M2.5 3.5A1 1 0 0 1 3.5 2.5h4.6l5.4 5.4-4.9 4.9L3.5 8.4a1 1 0 0 1-1-1z' },
    { d: 'M5.6 5.6h.01', width: 2.2 },
  ],
  'show-formulas': [
    { d: 'M2.5 3.5h11v9h-11z' },
    { d: 'M6.3 10.5V7a1.2 1.2 0 0 1 1.2-1.2M5.2 8h2.4', width: 1.4 },
    { d: 'M8.6 8l2.4 2.5M11 8l-2.4 2.5', width: 1.2 },
  ],
  calculate: [
    { d: 'M4 1.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z' },
    { d: 'M5 3.5h6v2.5H5z' },
    { d: 'M5.5 8.5h.01M8 8.5h.01M10.5 8.5h.01M5.5 11h.01M8 11h.01M10.5 11h.01', width: 1.8 },
  ],
  'goal-seek': [
    { d: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12z' },
    { d: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
    { d: 'M8 8h.01', width: 2.4 },
  ],

  'text-to-columns': [
    { d: 'M2.5 3.5h11v9h-11z' },
    { d: 'M8 3.5v9', dash: DASHED },
    { d: 'M6.5 8H4M5 6.5L3.5 8 5 9.5M9.5 8H12M11 6.5L12.5 8 11 9.5' },
  ],
  /* Two rows the same, the second crossed out. */
  'remove-duplicates': [
    { d: 'M2.5 3h11v3.5h-11zM2.5 9.5h11v3.5h-11z' },
    { d: 'M5 4.75h6M5 11.25h6', width: 1.2 },
    { d: 'M11 8.5l3 3M14 8.5l-3 3', width: 1.5 },
  ],

  'chevron-down': [{ d: 'M4 6.5l4 4 4-4' }],
  /* Four cells, one of them shaded by hatching rather than a slab. */
  'format-cells': [
    { d: SQUARE },
    { d: CROSS },
    { d: 'M9.5 11.5l2-2M9.5 13.5l4-4M11.5 13.5l2-2', width: 1 },
  ],

  // A padlock: the body, the shackle, the keyhole dot.
  lock: [
    { d: 'M3.5 7.5h9v6.5h-9z' },
    { d: 'M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5' },
    { d: 'M8 10.2a.7.7 0 1 0 0 .1z', fill: true },
  ],
  // A sheet with a padlock over its corner: locked cells hold.
  protect: [
    { d: 'M2.5 2.5h7v3h-7zM2.5 5.5v8h5' },
    { d: 'M2.5 5.5h7M5.5 2.5v11' },
    { d: 'M9 10h5v4H9z' },
    { d: 'M10 10V8.8a1.5 1.5 0 0 1 3 0V10' },
  ],
  // The same sheet, the shackle open.
  unprotect: [
    { d: 'M2.5 2.5h7v3h-7zM2.5 5.5v8h5' },
    { d: 'M2.5 5.5h7M5.5 2.5v11' },
    { d: 'M9 10h5v4H9z' },
    { d: 'M10 10V8.8a1.5 1.5 0 0 1 3 0' },
  ],
  // A sheet with a block picked out and a pencil over it: the ranges that take an edit.
  'edit-ranges': [
    { d: 'M2.5 2.5h11v11h-11z' },
    { d: 'M2.5 6h11M6 2.5v11' },
    { d: 'M7.5 7.5h4.5v4.5H7.5z', fill: true },
    { d: 'M10.5 13.5l3-3 1 1-3 3h-1z' },
  ],

  // A speech bubble, and the same bubble with a mark inside or beside it.
  comment: [
    { d: BUBBLE },
    { d: 'M8 5v3', width: 1.5 },
    { d: 'M8 10.5a.5.5 0 1 0 0 .1z', fill: true },
  ],
  'comment-delete': [
    { d: BUBBLE },
    { d: 'M6 5.5l4 4M10 5.5l-4 4' },
  ],
  'comment-prev': [
    { d: BUBBLE },
    { d: 'M9.5 5l-3 2.5 3 2.5' },
  ],
  'comment-next': [
    { d: BUBBLE },
    { d: 'M6.5 5l3 2.5-3 2.5' },
  ],
  'comments-all': [
    { d: 'M2.5 2.5h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6l-2 2v-2H2.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z' },
    { d: 'M12 6.5h1.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H13v2l-2-2H7.5a1 1 0 0 1-1-1v-1' },
  ],
  // Conditional formatting: a table with its bottom-right cell filled.
  /* Conditional formatting: cells, one of them carrying a bar. */
  cf: [
    { d: SQUARE },
    { d: CROSS },
    { d: 'M3.8 4.5h2.4M3.8 6h1.4M9.3 10h3.4M9.3 11.5h2', width: 1.6 },
  ],
  'cf-greater': [{ d: 'M4 3.5l7 4.5-7 4.5' }],
  'cf-less': [{ d: 'M12 3.5L5 8l7 4.5' }],
  'cf-between': [{ d: 'M3 4v8M13 4v8M5.5 8h5' }, { d: 'M5.5 8l2-2M5.5 8l2 2M10.5 8l-2-2M10.5 8l-2 2' }],
  'cf-equal': [{ d: 'M3.5 6h9M3.5 10h9' }],
  'cf-text': [{ d: 'M3 12.5L6.5 3.5l3.5 9M4.2 9.5h4.6' }, { d: 'M12.5 8v4.5' }],
  'cf-duplicates': [{ d: 'M2.5 2.5h7v7h-7z' }, { d: 'M6.5 6.5h7v7h-7z' }],
  'cf-top': [{ d: 'M8 13V4M4.5 7.5L8 4l3.5 3.5' }, { d: 'M3 2.5h10' }],
  'cf-bottom': [{ d: 'M8 3v9M4.5 8.5L8 12l3.5-3.5' }, { d: 'M3 13.5h10' }],
  'cf-above': [{ d: 'M2.5 9.5h11', dash: '2 1.5' }, { d: 'M8 8V3M5.5 5.5L8 3l2.5 2.5' }],
  'cf-below': [{ d: 'M2.5 6.5h11', dash: '2 1.5' }, { d: 'M8 8v5M5.5 10.5L8 13l2.5-2.5' }],
  /* Data bars: three rows, the bar in each a heavier stroke. */
  'cf-bar': [{ d: SQUARE }, { d: 'M2.5 6.2h11M2.5 9.8h11' }, { d: 'M4 4.3h7M4 8h3.5M4 11.7h8.5', width: 2 }],
  /* Colour scale: three rows, dotted more densely down the stack. */
  'cf-scale': [{ d: SQUARE }, { d: 'M2.5 6.2h11M2.5 9.8h11' }, { d: 'M6 4.3h.01M10 4.3h.01M4.7 8h.01M8 8h.01M11.3 8h.01M4 11.7h.01M6.5 11.7h.01M9.5 11.7h.01M12 11.7h.01', width: 1.6 }],
  /* Icon set: a circle, a triangle, a diamond, in outline. */
  'cf-icons': [{ d: 'M4.5 5.6a1.7 1.7 0 1 0 0-.01' }, { d: 'M8 3.6l1.9 3.4H6.1z' }, { d: 'M11.6 3.5l1.9 2.1-1.9 2.1-1.9-2.1z' }, { d: 'M3 12.5h10', width: 1 }],
  // Merge: a table whose middle cells have become one, arrows meeting.
  merge: [
    { d: SQUARE },
    { d: 'M2.5 6h11M2.5 10h11' },
    { d: 'M5 8h6M5 8l1.5-1.5M5 8l1.5 1.5M11 8l-1.5-1.5M11 8l-1.5 1.5' },
  ],
  // Unmerge: the same table, the middle cell split again, arrows parting.
  unmerge: [
    { d: SQUARE },
    { d: 'M2.5 6h11M2.5 10h11M8 6v4' },
    { d: 'M3.5 8h2.5M6 8L4.8 6.8M6 8l-1.2 1.2M12.5 8H10M10 8l1.2-1.2M10 8l1.2 1.2' },
  ],
  // A cell with a tick and a cross beside it: what passes, what does not.
  validation: [
    { d: SQUARE },
    { d: 'M2.5 6.5h11M8 2.5v11' },
    { d: 'M3.8 10.3l1.4 1.4 2.2-2.6' },
    { d: 'M9.6 9.1l2.3 2.3M11.9 9.1l-2.3 2.3' },
  ],
}

/** The names, for tests and for anyone building their own toolbar. */
export const RIBBON_ICON_NAMES = Object.keys(RIBBON_ICONS) as RibbonIconName[]
