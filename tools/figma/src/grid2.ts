/**
 * The rest of the grid: utility columns (row numbers, detail toggle), column
 * group headers, pinned rows, footers, the status bar, find bar, tool panel,
 * context/operator/choose-columns menus, tooltip, cell decorations, loading
 * and empty states, and the Enterprise selection bar. Values cite SvGrid.css
 * (CSS:<line>), GridMenus.svelte, grid-messages.ts and, for the selection
 * bar, packages/enterprise/src/SvGridSelectionBar.svelte (SELBAR:<line>).
 */
import {
  absolute,
  bindNum,
  component,
  frame,
  icon,
  put,
  rect,
  setFill,
  setStroke,
  shadow,
  text,
  textProp,
  variantSet,
} from './lib'
import { GRID_ICONS, SELBAR_ICONS, type GridIcon } from './icons'
import { example, matrix, section, type DocInfo } from './doc'

const vname = (props: Record<string, string>) => Object.entries(props).map(([k, val]) => `${k}=${val}`).join(', ')
const ROW_H = 'density/row-height'
const HEAD_H = 'density/header-height'
const CELL_PX = 'density/cell-px'

// ============================================================ utility columns

/** Row-number column, CSS:1098-1110 and 3211-3214: 56px, right aligned, fused with the header color. */
function rowNumberCell(row: 'Header' | 'Body' | 'Drag'): ComponentNode {
  const header = row === 'Header'
  const content = frame(
    { name: 'Content', align: 'center', justify: 'end', pad: [0, 8], w: 'fill', h: header ? 22 : 'fill' },
    text(header ? '#' : '12', { name: 'Number', size: 13, color: '--sg-muted', weight: header ? 'medium' : 'regular' }),
  )
  const c = component(
    { name: vname({ Row: row }), dir: 'v', w: 56, h: header ? 'hug' : 30, fill: '--sg-header-bg', stroke: '--sg-header-bg', strokeWeight: header ? { right: 1 } : { right: 1, bottom: 1 } },
    content,
  )
  if (header) {
    bindNum(content, 'height', HEAD_H)
    const line = rect('Bottom border', 55, 1, '--sg-header-border')
    put(c, line)
    line.layoutSizingHorizontal = 'FILL'
  } else {
    bindNum(c, 'height', ROW_H)
    // The bottom line between rows stays the grid border.
    c.strokes = []
    const line = rect('Bottom border', 56, 1, '--sg-border')
    absolute(c, line, 0, 29)
    line.constraints = { horizontal: 'STRETCH', vertical: 'MAX' }
  }
  if (row === 'Drag') {
    // Managed row drag grip, CSS:789-802: U+2807, 13px, muted at 0.4, left 3px.
    const grip = text('⠇', { name: 'Grip', size: 13, color: '--sg-muted', opacity: 0.4 })
    absolute(c, grip, 3, 7)
  }
  return c
}

/** Detail toggle column, CSS:1056-1094: 36px, a 24px button with a 12px chevron. */
function detailToggleCell(open: boolean): ComponentNode {
  const chev = icon('Chevron', GRID_ICONS['chevron-right'], 12, open ? '--sg-accent' : '--sg-muted')
  // rotate(90deg) clockwise in CSS is -90 in Figma.
  if (open) chev.rotation = -90
  const c = component(
    { name: vname({ Open: open ? 'True' : 'False' }), dir: 'v', w: 36, h: 30, fill: '--sg-header-bg', stroke: '--sg-border', strokeWeight: { right: 1, bottom: 1 } },
    frame(
      { name: 'Content', align: 'center', justify: 'center', w: 'fill', h: 'fill' },
      frame({ name: 'Button', w: 24, h: 24, radius: 5, align: 'center', justify: 'center', fill: open ? ['--sg-accent', 0.12] : null }, chev),
    ),
  )
  bindNum(c, 'height', ROW_H)
  return c
}

// ================================================================ header

/**
 * Column group header, CSS:880-939 and 728-742: the leaf header's type wins
 * the cascade, so it reads like a leaf header, centered, 4px 8px padding.
 */
function groupHeaderCell(toggle: 'None' | 'Expanded' | 'Collapsed'): ComponentNode {
  const label = text('Sales', { name: 'Label', size: 13, weight: 'medium', color: '--sg-header-label-color' })
  let content: FrameNode
  if (toggle === 'None') {
    content = frame({ name: 'Content', align: 'center', justify: 'center', pad: [4, 8], w: 'fill', h: 22 }, label)
  } else {
    const caret = icon('Caret', GRID_ICONS['chevron-down'], 10, '--sg-fg')
    // rotate(-90deg) when collapsed: counter-clockwise, +90 in Figma.
    if (toggle === 'Collapsed') caret.rotation = 90
    content = frame({ name: 'Content', align: 'center', justify: 'center', pad: [4, 8], w: 'fill', h: 22 }, frame({ name: 'Toggle', gap: 5, align: 'center', pad: [0, 4, 0, 0], radius: 5 }, caret, label))
  }
  bindNum(content, 'height', HEAD_H)
  const c = component(
    { name: vname({ Toggle: toggle }), dir: 'v', w: 280, fill: '--sg-header-bg', stroke: '--sg-border', strokeWeight: { right: 1 } },
    content,
    rect('Bottom border', 279, 1, '--sg-header-border'),
  )
  ;(c.children[1] as RectangleNode).layoutSizingHorizontal = 'FILL'
  return c
}

/** Inline column filter in the header (showInlineColumnFilter), CSS:1774-1815. */
function headerFilterInput(): ComponentNode {
  return component(
    { name: 'Grid header filter input', dir: 'v', w: 140, pad: [4, 7], fill: '--sg-header-bg', stroke: '--sg-border', strokeWeight: { right: 1, bottom: 1 }, description: 'showInlineColumnFilter: a 28px input inside the header cell.' },
    frame(
      { name: 'Input', align: 'center', h: 28, w: 'fill', pad: [0, 8], fill: '--sg-input-bg', stroke: '--sg-input-border', radius: 5 },
      text('Filter...', { name: 'Placeholder', size: 13, color: '--sg-muted', opacity: 0.7 }),
    ),
  )
}

/** Column reorder drop marker, CSS:747-767: 3px indigo gradient bar with a glow. Hard-coded, not themed. */
function reorderIndicator(): ComponentNode {
  const bar = rect('Bar', 3, 22, null, 2)
  bar.fills = [
    {
      type: 'GRADIENT_LINEAR',
      gradientTransform: [
        [0, 1, 0],
        [-1, 0, 1],
      ],
      gradientStops: [
        { position: 0, color: { r: 0x63 / 255, g: 0x66 / 255, b: 0xf1 / 255, a: 1 } },
        { position: 1, color: { r: 0x8b / 255, g: 0x5c / 255, b: 0xf6 / 255, a: 1 } },
      ],
    },
  ]
  bar.effects = [{ type: 'DROP_SHADOW', color: { r: 0x63 / 255, g: 0x66 / 255, b: 0xf1 / 255, a: 1 }, offset: { x: 0, y: 0 }, radius: 6, spread: 0, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false }]
  return component({ name: 'Grid reorder indicator', pad: [4, 0], description: 'Column reorder drop marker. Literal indigo in the CSS, not a token.' }, bar)
}

// ================================================================== rows

/** Pinned rows, CSS:832-849: pinned bg, weight 600, a pinned-border line on the inner edge. */
function pinnedRowCell(position: 'Top' | 'Bottom', align: 'Left' | 'Right'): ComponentNode {
  const content = frame(
    { name: 'Content', align: 'center', w: 'fill', h: 'fill' },
    text(align === 'Right' ? '128,430.10' : 'Totals', { name: 'Value', size: 13, weight: 'semibold', w: 'fill', align: align === 'Right' ? 'RIGHT' : 'LEFT', truncate: true }),
  )
  bindNum(content, align === 'Right' ? 'paddingRight' : 'paddingLeft', CELL_PX)
  const c = component(
    {
      name: vname({ Position: position, Align: align }),
      dir: 'v',
      w: 140,
      h: 30,
      fill: '--sg-pinned-bg',
      stroke: '--sg-pinned-border',
      strokeWeight: position === 'Top' ? { bottom: 1 } : { top: 1, bottom: 1 },
    },
    content,
  )
  bindNum(c, 'height', ROW_H)
  return c
}

/** tfoot summary cell, CSS:941-946: base cell look, browser th defaults (bold, centered). */
function summaryCell(): ComponentNode {
  const c = component(
    { name: 'Grid summary cell', dir: 'v', w: 140, h: 30, fill: '--sg-bg', stroke: '--sg-border', strokeWeight: { right: 1, bottom: 1 }, description: 'Summary row (tfoot). No grid rule sets its type; a th is bold and centered by default.' },
    frame({ name: 'Content', align: 'center', justify: 'center', w: 'fill', h: 'fill' }, text('128,430.10', { name: 'Value', size: 13, weight: 'bold' })),
  )
  bindNum(c, 'height', ROW_H)
  return c
}

/** Group footer and grand total rows, CSS:2697-2724. */
function footerRow(kind: 'Group footer' | 'Grand total'): ComponentNode {
  const grand = kind === 'Grand total'
  const c = component(
    { name: vname({ Kind: kind }), dir: 'v', w: 720, fill: '--sg-header-bg' },
    // Grand total: border-top 3px double, drawn as two 1px lines.
    grand ? frame({ name: 'Double border', dir: 'v', gap: 1, w: 'fill' }, rect('Line', 720, 1, '--sg-border'), rect('Line', 720, 1, '--sg-border')) : rect('Border', 720, 1, '--sg-border'),
    frame(
      { name: 'Content', align: 'center', justify: 'between', pad: [0, 12], w: 'fill', h: 29 },
      text(grand ? 'Grand total' : 'Total', { name: 'Label', size: 13, weight: grand ? 'bold' : 'semibold' }),
      text(grand ? '$128,430.10' : '$47,010.25', { name: 'Value', size: 13, weight: grand ? 'bold' : 'semibold' }),
    ),
  )
  for (const l of c.findAll((n) => n.type === 'RECTANGLE')) (l as RectangleNode).layoutSizingHorizontal = 'FILL'
  return c
}

// ================================================================ chrome

/** Status bar, CSS:2055-2076 and GridFooter.svelte:71-102. Labels from grid-messages.ts. */
function statusBar(): ComponentNode {
  const item = (label: string, value: string) =>
    frame({ name: label, gap: 5, align: 'center' }, text(label, { size: 12, color: '--sg-muted' }), text(value, { size: 12, weight: 'semibold' }))
  return component(
    { name: 'Grid status bar', gap: 18, align: 'center', wrap: true, pad: [6, 14], w: 720, fill: '--sg-header-bg', stroke: '--sg-border', strokeWeight: { left: 1, right: 1, bottom: 1 }, description: 'statusBar: aggregates of the selected cells.' },
    item('Count', '6'),
    item('Sum', '61,281.15'),
    item('Avg', '10,213.53'),
    item('Min', '640.00'),
    item('Max', '31,780.25'),
  )
}

/** Advanced filter chip in the toolbar, CSS:156-188. */
function advancedFilterChip(): ComponentNode {
  return component(
    { name: 'Grid advanced filter chip', gap: 6, align: 'center', pad: [5, 6, 5, 11], radius: 999, fill: ['--sg-accent', 0.12], stroke: ['--sg-accent', 0.35], description: 'Shown in the toolbar while an advanced filter is applied.' },
    icon('Icon', GRID_ICONS['advanced-filter'], 13, '--sg-accent'),
    text('Advanced filter', { name: 'Label', size: 12.5, weight: 'semibold', color: '--sg-accent' }),
    frame({ name: 'Clear', w: 18, h: 18, radius: 999, align: 'center', justify: 'center' }, text('✕', { size: 11, color: '--sg-accent' })),
  )
}

/** Find-in-grid bar (Ctrl+F), CSS:2921-2974. */
function findBar(): ComponentNode {
  const btn = (glyph: string) => frame({ name: glyph, w: 22, h: 22, radius: 4, align: 'center', justify: 'center' }, text(glyph, { size: 12, color: '--sg-fg' }))
  const c = component(
    { name: 'Grid find bar', gap: 4, align: 'center', pad: [6, 8], w: 300, fill: '--sg-bg', stroke: '--sg-border', radius: 8, description: 'Find in grid (Ctrl+F), pinned to the top right of the grid.' },
    icon('Search', GRID_ICONS.search, 14, '--sg-muted'),
    frame({ name: 'Input', pad: [2, 6], w: 'fill' }, text('Northwind', { name: 'Query', size: 13 })),
    text('2 of 5', { name: 'Count', size: 11, color: '--sg-muted' }),
    btn('↑'),
    btn('↓'),
    btn('✕'),
  )
  shadow(c, 'Find bar')
  return c
}

/** Tool panel (columns and filters side panel), CSS:189-370. */
function toolPanel(): ComponentNode {
  const tab = (label: string, active: boolean) =>
    frame(
      { name: label, pad: [8, 10], stroke: active ? '--sg-accent' : undefined, strokeWeight: { bottom: 2 } },
      text(label, { size: 12, weight: 'semibold', color: active ? '--sg-accent' : '--sg-muted' }),
    )
  const box = (on: boolean) => {
    const b = frame({ name: 'Checkbox', dir: 'none', w: 14, h: 14, radius: 3, fill: on ? '--sg-accent' : '--sg-input-bg', stroke: on ? '--sg-accent' : '--sg-input-border', strokeInLayout: false })
    if (on) absolute(b, icon('Tick', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 7.2l1.9 2 3.3-4.4"/></svg>', 14, '--sg-on-accent'), 0, 0)
    return b
  }
  const row = (label: string, on: boolean, hover = false) =>
    frame(
      { name: label, gap: 8, align: 'center', pad: [3, 6], w: 'fill', radius: 5, fill: hover ? '--sg-row-hover-bg' : null },
      box(on),
      text(label, { size: 13, w: 'fill' }),
      frame({ name: 'Move', gap: 2 }, ...['↑', '↓'].map((g) => frame({ name: g, w: 22, h: 22, radius: 4, align: 'center', justify: 'center' }, text(g, { size: 13, color: '--sg-muted' })))),
    )
  const c = component(
    { name: 'Grid tool panel', dir: 'v', w: 250, h: 420, fill: '--sg-bg', stroke: '--sg-border', strokeWeight: { left: 1 }, description: 'Columns & Filters panel opened from the toolbar.' },
    frame({ name: 'Head', pad: [8, 12], w: 'fill' }, text('Columns & filters', { size: 12, weight: 'bold', upper: true, letterSpacing: 0.6, color: '--sg-muted' })),
    frame({ name: 'Tabs', gap: 2, pad: [0, 8], w: 'fill', stroke: '--sg-border', strokeWeight: { bottom: 1 } }, tab('Columns', true), tab('Filters', false)),
    frame(
      { name: 'Rows', dir: 'v', gap: 2, pad: 8, w: 'fill' },
      row('Customer', true),
      row('Company', true),
      row('Country', true, true),
      row('Status', true),
      row('Orders', true),
      row('Revenue', true),
      row('Last order', false),
    ),
  )
  shadow(c, 'Tool panel')
  return c
}

/** Grid cell tooltip, CSS:2844-2859: literal slate colors, inverted under data-theme="dark". */
function gridTooltip(): ComponentNode {
  const c = component(
    { name: 'Grid tooltip', pad: [8, 10], radius: '--sg-radius', fill: '#0f172a', description: 'Tooltip for truncated cells. Literal #0f172a / #f1f5f9; the CSS swaps them under data-theme="dark".' },
    text('Wide World Importers, Rotterdam warehouse', { name: 'Text', size: 12, lineHeight: 17.4, color: '#f1f5f9' }),
  )
  shadow(c, 'Grid tooltip')
  return c
}

// ================================================================== menus

function menuShell(name: string, width: number, description: string): ComponentNode {
  const c = component({ name, dir: 'v', pad: 4, w: width, fill: '--sg-bg', stroke: '--sg-border', radius: 8, description })
  shadow(c, 'Grid menu')
  return c
}

function menuRow(label: string, opts: { icon?: GridIcon; checked?: boolean; hover?: boolean; disabled?: boolean; gutter?: boolean } = {}): FrameNode {
  const f = frame(
    {
      name: label,
      gap: 8,
      align: 'center',
      pad: [7, 10],
      w: 'fill',
      radius: 5,
      fill: opts.checked ? '--sg-selection-bg' : opts.hover ? '--sg-row-hover-bg' : null,
      opacity: opts.disabled ? 0.4 : undefined,
    },
    opts.icon ? icon('Icon', GRID_ICONS[opts.icon], 13, opts.checked ? '--sg-accent' : '--sg-muted') : opts.gutter ? frame({ name: 'Gutter', w: 16, h: 16 }) : null,
    text(label, { size: 13, w: 'fill', color: opts.checked ? '--sg-accent' : '--sg-fg' }),
  )
  return f
}

function sep(): FrameNode {
  const f = frame({ name: 'Separator', pad: [4, 6], w: 'fill' }, rect('Line', 100, 1, '--sg-border'))
  ;(f.children[0] as RectangleNode).layoutSizingHorizontal = 'FILL'
  return f
}

/** Cell context menu: labels from grid-messages.ts (menuCut ... menuEditComment), 16px icon gutter (CSS:2364-2381). */
function contextMenu(): ComponentNode {
  const c = menuShell('Grid context menu', 200, 'Right-click on a cell. min-width 180px with a 16px icon gutter.')
  const rows: (FrameNode | null)[] = [
    menuRow('Cut', { gutter: true }),
    menuRow('Copy', { gutter: true, hover: true }),
    menuRow('Paste', { gutter: true }),
    menuRow('Clear', { gutter: true }),
    sep(),
    menuRow('Insert row above', { gutter: true }),
    menuRow('Insert row below', { gutter: true }),
    sep(),
    menuRow('Remove row', { gutter: true }),
    menuRow('Remove column', { gutter: true }),
    sep(),
    menuRow('Edit comment', { gutter: true }),
  ]
  for (const r of rows) {
    put(c, r)
    r!.layoutSizingHorizontal = 'FILL'
  }
  return c
}

/** Filter operator menu, 184px (CSS:2360-2362), op-* icons at 13px; labels from grid-messages.ts. */
function operatorMenu(): ComponentNode {
  const c = menuShell('Grid operator menu', 184, 'Opened from the filter row operator button.')
  const ops: [string, GridIcon][] = [
    ['Contains', 'op-contains'],
    ['Not contains', 'op-notContains'],
    ['Equals', 'op-equals'],
    ['Not equals', 'op-notEquals'],
    ['Starts with', 'op-startsWith'],
    ['Ends with', 'op-endsWith'],
    ['Regex', 'op-regex'],
    ['In', 'op-in'],
    ['Not in', 'op-notIn'],
    ['Greater than', 'op-greaterThan'],
    ['Less than', 'op-lessThan'],
    ['Between', 'op-between'],
    ['Blank', 'op-isBlank'],
    ['Not blank', 'op-isNotBlank'],
  ]
  ops.forEach(([label, ic], i) => {
    const r = menuRow(label, { icon: ic, checked: i === 0, hover: i === 2 })
    put(c, r)
    r.layoutSizingHorizontal = 'FILL'
  })
  return c
}

/** Choose columns submenu, 240px (CSS:3155-3157), facet checkboxes 14px (CSS:2614-2635). */
function chooseColumnsMenu(): ComponentNode {
  const c = menuShell('Grid choose columns menu', 240, 'Column menu > Choose columns.')
  const box = (on: boolean) => {
    const b = frame({ name: 'Checkbox', dir: 'none', w: 14, h: 14, radius: 3, fill: on ? '--sg-accent' : '--sg-input-bg', stroke: on ? '--sg-accent' : '--sg-input-border', strokeInLayout: false })
    if (on) absolute(b, icon('Tick', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 7.2l1.9 2 3.3-4.4"/></svg>', 14, '--sg-on-accent'), 0, 0)
    return b
  }
  const cols: [string, boolean][] = [
    ['Customer', true],
    ['Company', true],
    ['Country', true],
    ['Status', true],
    ['Orders', false],
    ['Revenue', true],
    ['Last order', false],
  ]
  for (const [label, on] of cols) {
    const r = frame({ name: label, gap: 8, align: 'center', pad: [4, 8], w: 'fill', radius: 5, fill: label === 'Country' ? '--sg-row-hover-bg' : null }, box(on), text(label, { size: 13 }))
    put(c, r)
    r.layoutSizingHorizontal = 'FILL'
  }
  return c
}

// ======================================================== cell decorations

/** Decorations a body cell can carry: fill handle, note, chips, flash, placeholder. */
function cellExtra(kind: string): ComponentNode {
  const c = component({ name: vname({ Kind: kind }), dir: 'v', w: 140, h: 30, fill: '--sg-bg', stroke: '--sg-border', strokeWeight: { right: 1, bottom: 1 } })
  bindNum(c, 'height', ROW_H)
  const content = frame({ name: 'Content', align: 'center', gap: 4, w: 'fill', h: 'fill' })
  bindNum(content, 'paddingLeft', CELL_PX)
  put(c, content)
  if (kind === 'Chips') {
    // CSS:2085-2098: padding 2px 8px, 0.85em, accent 18% fill, 35% border.
    const chip = (t: string) => frame({ name: t, pad: [2, 8], radius: 999, fill: ['--sg-accent', 0.18], stroke: ['--sg-accent', 0.35] }, text(t, { size: 11, lineHeight: 15.4 }))
    put(content, chip('Retail'), chip('B2B'))
  } else if (kind === 'Placeholder') {
    // Server-loading placeholder bar, CSS:472-541: 72% wide, 9px, radius 5, fg 8%.
    const bar = rect('Bar', 95, 9, ['--sg-fg', 0.08], 5)
    put(content, bar)
  } else {
    put(content, text(kind === 'Fill handle' ? 'Alpine Ski House' : 'Northwind Traders', { name: 'Value', size: 13, w: 'fill', truncate: true }))
  }
  if (kind === 'Fill handle') {
    // Active ring plus the 9px handle at the bottom-right corner, CSS:1387-1399, 1506-1526.
    const ringNode = frame({ name: 'Active ring', dir: 'none', w: 139, h: 29, stroke: '--sg-accent', strokeWeight: 2 })
    absolute(c, ringNode, 0, 0)
    ringNode.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' }
    const handle = rect('Fill handle', 9, 9, '--sg-accent')
    setStroke(handle, '--sg-bg', 1, 'INSIDE')
    absolute(c, handle, 139 - 9, 29 - 9)
    handle.constraints = { horizontal: 'MAX', vertical: 'MAX' }
  }
  if (kind === 'Note') {
    // CSS:1488-1497: 12px top-right triangle in --sg-note-corner (#f59e0b, no theme sets it).
    const tri = icon('Note corner', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="M0 0h12v12z" fill="currentColor"/></svg>', 12, '#f59e0b')
    absolute(c, tri, 139 - 12, 0)
    tri.constraints = { horizontal: 'MAX', vertical: 'MIN' }
  }
  if (kind === 'Flash') setFill(c, ['--sg-accent', 0.42])
  c.clipsContent = false
  return c
}

// ======================================================== loading and empty

/** First-load skeleton row, CSS:84-116: 36px rows, 12px padding, a 10px bar at 70%. */
function skeletonRow(): ComponentNode {
  const cell = (w: number) => frame({ name: 'Cell', w, h: 36, pad: [0, 12], align: 'center' }, rect('Bar', Math.round((w - 24) * 0.7), 10, ['--sg-muted', 0.18], 4))
  return component(
    { name: 'Grid skeleton row', w: 720, h: 36, stroke: '--sg-border', strokeWeight: { bottom: 1 }, description: 'First-load skeleton. The shimmer is motion; the kit shows the base fill.' },
    cell(170),
    cell(180),
    cell(120),
    cell(130),
    cell(120),
  )
}

/** Empty row, SvGrid.svelte:2828-2839: a plain spanning cell with the noRows message. */
function emptyRow(): ComponentNode {
  return component(
    { name: 'Grid empty row', w: 720, pad: [1, 1], fill: '--sg-bg', stroke: '--sg-border', strokeWeight: { bottom: 1 }, description: 'No CSS rule styles it; it is a base cell spanning all columns.' },
    text('No rows to display.', { name: 'Message', size: 13 }),
  )
}

// ============================================================ selection bar

/** SvGridSelectionBar (Enterprise), SELBAR:248-441. */
function selectionBar(): ComponentNode {
  const action = (label: string, danger = false) =>
    frame({ name: label, gap: 7, align: 'center', pad: [5, 9], radius: 6 }, text(label, { size: 13, color: danger ? '--sg-danger' : '--sg-fg' }))
  const c = component(
    { name: 'Grid selection bar', gap: 2, align: 'center', pad: [6, 8], fill: '--sg-bg', stroke: '--sg-border', radius: 8, description: 'Enterprise. Floats 16px above the bottom edge while rows are selected.' },
    frame(
      { name: 'Count', gap: 7, align: 'center', pad: [0, 6, 0, 4] },
      frame({ name: 'Chip', h: 20, pad: [0, 6], radius: 4, fill: '--sg-accent', align: 'center', justify: 'center' }, text('3', { name: 'Number', size: 12, weight: 'bold', color: '--sg-on-accent' })),
      text('selected', { size: 13, color: '--sg-muted' }),
    ),
    rect('Separator', 1, 20, '--sg-border'),
    action('Export'),
    action('Edit fields'),
    action('Delete', true),
    frame({ name: 'More', pad: [5, 7], radius: 6, align: 'center' }, icon('More', SELBAR_ICONS.more, 15, '--sg-fg')),
    frame({ name: 'Clear', w: 26, h: 26, radius: 6, align: 'center', justify: 'center' }, icon('Clear', SELBAR_ICONS.clear, 14, '--sg-muted')),
  )
  shadow(c, 'Selection bar')
  return c
}

// ================================================================= build

export type MoreGridParts = Record<string, ComponentNode | ComponentSetNode>

export function buildMoreGridParts(): { sections: FrameNode[]; parts: MoreGridParts } {
  const sections: FrameNode[] = []
  const sec = (title: string, source: string, note: string | undefined, doc: DocInfo) => {
    const s = section(title, source, note, doc)
    sections.push(s)
    return s
  }
  const parts: MoreGridParts = {}

  const util = sec('Row numbers and detail toggle', 'SvGrid.css:789-802, 1056-1110, 3211-3214', 'The row-number column takes the header color and its right border fuses with it. The drag variant shows the managed row-drag grip.', {
    summary: 'Utility columns before the data: a row-number column and the master-detail toggle.',
    usage: '<SvGrid data={rows} {columns}\n  showRowNumbers />',
    props: [
      ['showRowNumbers', 'boolean'],
      ['rowNumberWidth', 'number = 56'],
      ['showDetailToggle', 'boolean (36px column)'],
    ],
  })
  const rn = variantSet('Grid row number cell', util, (['Header', 'Body', 'Drag'] as const).map(rowNumberCell))
  textProp(rn, 'Number', 'Number', '12')
  matrix(rn, [], ['Row'])
  const dt = variantSet('Grid detail toggle cell', util, [false, true].map(detailToggleCell))
  matrix(dt, [], ['Open'])
  Object.assign(parts, { rowNumber: rn, detailToggle: dt })

  const hdr = sec('Column groups and header extras', 'SvGrid.css:747-767, 880-939, 1774-1815', 'In the CSS the group cell declares 11.5px uppercase type, but the leaf header rule wins the cascade, so it renders like a leaf header.', {
    summary: 'Multi-level headers over a group of columns, the inline column filter, and the drop marker shown while a column is dragged.',
    usage: "const columns = [\n  { header: 'Sales', columns: [\n    { field: 'orders', header: 'Orders' },\n    { field: 'revenue', header: 'Revenue' },\n  ] },\n]",
    props: [['columns[].columns', 'nested column definitions (group)']],
  })
  const gh = variantSet('Grid column group header', hdr, (['None', 'Expanded', 'Collapsed'] as const).map(groupHeaderCell))
  textProp(gh, 'Label', 'Label', 'Sales')
  matrix(gh, [], ['Toggle'])
  const hf = headerFilterInput()
  const ri = reorderIndicator()
  put(hdr, frame({ name: 'Extras', gap: 48, align: 'start' }, example('Inline column filter', hf), example('Reorder drop marker', ri)))
  Object.assign(parts, { groupHeader: gh, headerFilter: hf, reorder: ri })

  const rows = sec('Pinned rows, summary and totals', 'SvGrid.css:832-849, 941-946, 2697-2724', 'The summary row has no grid rule for its type: a th is bold and centered by default. The grand total border is 3px double.', {
    summary: 'Rows that stay put or close a set: pinned top and bottom rows, the summary row, group footers and the grand total.',
    usage: '<SvGrid data={rows} {columns}\n  pinnedTopRows={[totals]} />',
    props: [
      ['pinnedTopRows', 'Row[]'],
      ['pinnedBottomRows', 'Row[]'],
      ['groupFooters', 'boolean'],
      ['grandTotalRow', 'boolean'],
    ],
  })
  const pr = variantSet('Grid pinned row cell', rows, (['Top', 'Bottom'] as const).flatMap((p) => (['Left', 'Right'] as const).map((a) => pinnedRowCell(p, a))))
  textProp(pr, 'Value', 'Value', 'Totals')
  matrix(pr, ['Position'], ['Align'])
  const sc = summaryCell()
  textProp(sc, 'Value', 'Value', '128,430.10')
  put(rows, example('Summary cell', sc))
  const fr = variantSet('Grid footer row', rows, (['Group footer', 'Grand total'] as const).map(footerRow))
  textProp(fr, 'Label', 'Label', 'Total')
  textProp(fr, 'Value', 'Value', '$47,010.25')
  matrix(fr, ['Kind'], [])
  Object.assign(parts, { pinnedRow: pr, summary: sc, footerRow: fr })

  const chrome = sec('Status bar, find and tool panel', 'SvGrid.css:156-370, 2055-2076, 2921-2974', 'Status bar labels come from grid-messages.ts (Count, Sum, Avg, Min, Max).', {
    summary: 'Grid chrome around the cells: selection aggregates, the advanced-filter chip, find in grid, and the columns and filters panel.',
    usage: '<SvGrid data={rows} {columns}\n  statusBar />',
    props: [
      ['statusBar', "boolean | { aggregates?: ('count' | 'sum' | 'avg' | 'min' | 'max')[] }"],
      ['find (Ctrl+F)', 'built in'],
    ],
  })
  const sb = statusBar()
  const af = advancedFilterChip()
  const fb = findBar()
  const tp = toolPanel()
  put(chrome, example('Status bar', sb), frame({ name: 'Row', gap: 48, align: 'start' }, example('Advanced filter chip', af), example('Find bar', fb)), example('Tool panel', tp))
  Object.assign(parts, { statusBar: sb, advancedFilter: af, findBar: fb, toolPanel: tp })

  const menus = sec('More menus and tooltip', 'GridMenus.svelte; grid-messages.ts; SvGrid.css:2306-2381, 2844-2859, 3155-3157', 'All grid menus share one shell: 4px padding, 8px radius, 13px items, the Grid menu shadow.', {
    summary: 'The cell context menu, the filter operator menu, the choose-columns submenu and the cell tooltip.',
  })
  const cm = contextMenu()
  const om = operatorMenu()
  const ch = chooseColumnsMenu()
  const tt = gridTooltip()
  put(menus, frame({ name: 'Menus', gap: 40, align: 'start' }, example('Context menu', cm), example('Operator menu', om), example('Choose columns', ch), example('Tooltip', tt)))
  Object.assign(parts, { contextMenu: cm, operatorMenu: om, chooseColumns: ch, tooltip: tt })

  const deco = sec('Cell decorations', 'SvGrid.css:472-541, 1376-1382, 1488-1526, 2085-2098', 'The note corner is #f59e0b (--sg-note-corner, which no theme sets). The flash fades out over 0.7s; the kit shows its first frame.', {
    summary: 'What a cell can carry beyond its value: the fill handle, a note, chips, a change flash, and the placeholder bar while server rows load.',
  })
  const ce = variantSet('Grid cell extra', deco, ['Fill handle', 'Note', 'Chips', 'Flash', 'Placeholder'].map(cellExtra))
  matrix(ce, [], ['Kind'])
  parts.cellExtra = ce

  const load = sec('Loading and empty', 'SvGrid.css:53-116; SvGrid.svelte:2828-2839', 'The skeleton overlay resolves 40px for the header and 36px rows: it sits outside the shell that sets the real values.', {
    summary: 'First-load skeleton rows and the empty row. The loading bar sits on the Filter row, scrollbar, loading card.',
  })
  const sk = skeletonRow()
  const er = emptyRow()
  put(load, example('Skeleton row', sk), example('Empty row', er))
  Object.assign(parts, { skeleton: sk, empty: er })

  const sel = sec('Selection bar', 'packages/enterprise/src/SvGridSelectionBar.svelte', 'Enterprise. Without the Enterprise pack the grid shows an upsell note in its place.', {
    summary: 'Bulk actions for the selected rows, floating over the bottom of the grid.',
  })
  const sbar = selectionBar()
  put(sel, sbar)
  parts.selectionBar = sbar

  return { sections, parts }
}

