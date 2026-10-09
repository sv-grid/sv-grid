/**
 * Data grid parts and the example grids composed from them. Geometry comes
 * from SvGrid.css (cited as CSS:<line>) and the measured defaults described in
 * tokens.mjs (DENSITY). Row height, header height and cell padding bind to the
 * `SvGrid density` variables; colors bind to the theme variables.
 */
import {
  type Ink,
  absolute,
  bindNum,
  boolProp,
  component,
  frame,
  icon,
  iconComponent,
  inst,
  put,
  rect,
  recolor,
  setFill,
  setMode,
  themeAs,
  setWidth,
  shadow,
  swapProp,
  text,
  textProp,
  v,
  variantSet,
  KIT,
} from './lib'
import { GRID_ICONS, SCROLL_ARROW, type GridIcon } from './icons'
import { example, matrix, section, type DocInfo } from './doc'
import type { UiKit } from './ui'

const vname = (props: Record<string, string>) => Object.entries(props).map(([k, val]) => `${k}=${val}`).join(', ')
const ROW_H = 'density/row-height'
const HEAD_H = 'density/header-height'
const CELL_PX = 'density/cell-px'

/** An overlay drawn inside a box (inset box-shadow, ::after rings). Follows the box on resize. */
function overlay(box: FrameNode | ComponentNode, o: { name: string; x: number; y: number; w: number; h: number; stroke: Ink; weight: number }): FrameNode {
  const f = frame({ name: o.name, dir: 'none', w: Math.max(o.w, 1), h: Math.max(o.h, 1), stroke: o.stroke, strokeWeight: o.weight })
  absolute(box, f, o.x, o.y)
  f.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' }
  box.clipsContent = false
  return f
}

/** A 22x22 header button (CSS:2236-2279). */
function headerButton(name: string, svg: string, ink: Ink, hovered = false): FrameNode {
  return frame(
    { name, w: 22, h: 22, radius: 4, align: 'center', justify: 'center', fill: hovered ? '--sg-row-hover-bg' : null },
    icon('Icon', svg, 15, ink),
  )
}

// ------------------------------------------------------------ header cell

type HeaderProps = { Sort: string; Filter: string; Align: string; Pinned: string; State: string }

/**
 * th.sv-grid-column (CSS:401-421, 728-742, 2146-2279). Content height is the
 * header-height variable; the 1px line under it is --sg-header-border, the
 * right edge --sg-border.
 */
function headerCell(p: HeaderProps): ComponentNode {
  const right = p.Align === 'Right'
  const pinned = p.Pinned === 'Yes'
  const hover = p.State === 'Hover'

  const label = text('Column', { name: 'Label', size: 13, weight: pinned ? 'semibold' : 'medium', color: '--sg-header-label-color', truncate: true })
  // Pinned headers force 600 (CSS:570-574); others follow --sg-header-weight.
  if (!pinned) label.setBoundVariable('fontWeight', v('--sg-header-weight'))

  const sortSvg = p.Sort === 'Asc' ? GRID_ICONS['sort-asc'] : p.Sort === 'Desc' ? GRID_ICONS['sort-desc'] : GRID_ICONS.sort
  const sortIcon = p.Sort !== 'None' || hover ? icon('Sort', sortSvg, 13, '--sg-muted') : null
  // Unsorted hint shows at 0.4 on column hover (CSS:2214-2221).
  if (sortIcon && p.Sort === 'None') sortIcon.opacity = 0.4

  const sortBtn = frame({ name: 'Sort button', gap: 4, pad: 2, align: 'center', justify: right ? 'end' : 'start', w: 'fill' }, label, sortIcon)
  const filterActive = p.Filter === 'On'
  const content = frame(
    { name: 'Content', gap: 2, align: 'center', w: 'fill', h: 22 },
    sortBtn,
    filterActive || hover ? headerButton('Filter button', GRID_ICONS.filter, filterActive ? '--sg-accent' : '--sg-muted') : null,
    hover ? headerButton('Menu button', GRID_ICONS.menu, '--sg-muted') : null,
  )
  bindNum(content, 'height', HEAD_H)
  bindNum(content, right ? 'paddingRight' : 'paddingLeft', CELL_PX)

  const c = component(
    {
      name: vname(p),
      dir: 'v',
      w: 140,
      fill: pinned ? '--sg-pinned-header-bg' : '--sg-header-bg',
      stroke: '--sg-border',
      strokeWeight: { right: 1 },
    },
    content,
    rect('Bottom border', 139, 1, '--sg-header-border'),
  )
  ;(c.children[1] as RectangleNode).layoutSizingHorizontal = 'FILL'
  if (pinned) pinnedEdge(c)
  if (hover) {
    // Resize handle line: 2px, fg at 0.3 on column hover (CSS:663-690).
    const line = rect('Resize handle', 2, c.height, ['--sg-fg', 0.3])
    absolute(c, line, 140 - 5 + 2, 0)
    line.constraints = { horizontal: 'MAX', vertical: 'STRETCH' }
  }
  return c
}

/** Pinned-left edge: inset 1px divider plus the cast shadow (CSS:557-559). */
function pinnedEdge(c: ComponentNode): void {
  const d = rect('Pinned divider', 1, c.height, '--sg-pinned-divider')
  absolute(c, d, c.width - 2, 0)
  d.constraints = { horizontal: 'MAX', vertical: 'STRETCH' }
  shadow(c, 'Pinned column')
}

// -------------------------------------------------------------- body cell

type CellProps = { State: string; Align: string; Pinned: string }

/** td.sv-grid-cell (CSS:401-429, 1387-1463, 1638-1677, 2048-2054, 554-608). */
function bodyCell(p: CellProps): ComponentNode {
  const right = p.Align === 'Right'
  const pinned = p.Pinned === 'Yes'
  const s = p.State
  const base: Ink = pinned ? '--sg-pinned-bg' : '--sg-bg'

  const editing = s === 'Editing'
  const value = text(right ? '12,055.75' : 'Northwind Traders', {
    name: 'Value',
    size: 13,
    truncate: true,
    w: 'fill',
    align: right ? 'RIGHT' : 'LEFT',
    color: s === 'Invalid' ? '--sg-invalid-fg' : '--sg-fg',
  })
  const content = frame(
    { name: 'Content', align: 'center', w: 'fill', h: 'fill', fill: editing ? '--sg-input-bg' : null, pad: editing ? [0, 8] : undefined },
    value,
    editing ? rect('Caret', 1, 15, '--sg-fg') : null,
  )
  if (!editing) bindNum(content, right ? 'paddingRight' : 'paddingLeft', CELL_PX)

  const c = component({
    name: vname(p),
    dir: 'v',
    w: 140,
    h: 30,
    stroke: '--sg-border',
    strokeWeight: { right: 1, bottom: 1 },
  })
  put(c, content)
  bindNum(c, 'height', ROW_H)

  // Fills stack bottom to top, like the CSS layers.
  const fills: SolidPaint[] = []
  const add = (ink: Ink) => {
    const tmp = figma.createRectangle()
    setFill(tmp, ink)
    fills.push(...(tmp.fills as SolidPaint[]))
    tmp.remove()
  }
  add(base)
  if (s === 'Hover') add(pinned ? ['--sg-row-hover-bg', 0.55] : '--sg-row-hover-bg')
  if (s === 'Selected' || s === 'Range') add(pinned ? ['--sg-selection-bg', 0.65] : '--sg-selection-bg')
  if (s === 'Invalid') add('--sg-invalid-bg')
  c.fills = fills

  const w = 139
  const h = 29
  if (s === 'Active') overlay(c, { name: 'Active ring', x: 0, y: 0, w, h, stroke: '--sg-accent', weight: 2 })
  if (s === 'Editing') overlay(c, { name: 'Editing ring', x: -1, y: -1, w: w + 2, h: h + 2, stroke: '--sg-accent', weight: 2 })
  if (s === 'Invalid') overlay(c, { name: 'Invalid ring', x: 0, y: 0, w, h, stroke: '--sg-invalid-border', weight: 1 })
  if (pinned) pinnedEdge(c)
  return c
}

// ---------------------------------------------------------- select column

/** The 44px selection column and its 16px checkbox (CSS:1044-1050, 1262-1362). */
function selectCell(row: 'Header' | 'Body', checked: string): ComponentNode {
  const on = checked !== 'False'
  const box = frame({
    name: 'Checkbox',
    dir: 'none',
    w: 16,
    h: 16,
    radius: 4,
    fill: on ? '--sg-accent' : '--sg-input-bg',
    stroke: on ? '--sg-accent' : '--sg-input-border',
    strokeInLayout: false,
  })
  if (checked === 'True') {
    // ::after tick: 5x9 box, 2px right + bottom border, rotated 40deg.
    const tick = icon('Tick', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M5 8.4l2.3 2.4 4-5.4"/></svg>', 16, '--sg-on-accent')
    absolute(box, tick, 0, 0)
  }
  if (checked === 'Mixed') absolute(box, rect('Bar', 8, 2, '--sg-on-accent', 1), 4, 7)

  const content = frame({ name: 'Content', align: 'center', justify: 'center', w: 'fill', h: 'fill', pad: [0, 6] }, box)
  const header = row === 'Header'
  const c = component(
    {
      name: vname({ Row: row, Checked: checked }),
      dir: 'v',
      w: 44,
      h: header ? 'hug' : 30,
      fill: header ? '--sg-header-bg' : checked === 'True' ? '--sg-selection-bg' : '--sg-bg',
      stroke: '--sg-border',
      strokeWeight: header ? { right: 1 } : { right: 1, bottom: 1 },
    },
    content,
  )
  if (header) {
    content.layoutSizingVertical = 'FIXED'
    bindNum(content, 'height', HEAD_H)
    const line = rect('Bottom border', 43, 1, '--sg-header-border')
    put(c, line)
    line.layoutSizingHorizontal = 'FILL'
  } else {
    bindNum(c, 'height', ROW_H)
  }
  return c
}

// -------------------------------------------------------------- group row

/** Row-group banner (CSS:2683-2836, SvGrid.svelte:1459-1505). */
function groupRow(expanded: boolean, level: number): ComponentNode {
  const c = component(
    {
      name: vname({ Expanded: expanded ? 'True' : 'False', Level: String(level) }),
      gap: 6,
      align: 'center',
      w: 720,
      h: 30,
      pad: [0, 12, 0, 12 + level * 20],
      fill: '--sg-header-bg',
      stroke: '--sg-border',
      strokeWeight: { bottom: 1 },
    },
    frame({ name: 'Toggle', pad: [0, 4, 0, 0], align: 'center' }, icon('Chevron', expanded ? GRID_ICONS['chevron-down'] : GRID_ICONS['chevron-right'], 12, '--sg-fg')),
    text('Country: Germany', { name: 'Label', size: 13, weight: 'semibold', color: '--sg-header-fg' }),
    frame({ name: 'Count', pad: [0, 0, 0, 6] }, text('12 rows', { name: 'Count text', size: 12, color: '--sg-muted' })),
    frame(
      { name: 'Aggregate', pad: [0, 0, 0, 10], gap: 4, align: 'center' },
      text('Revenue:', { name: 'Aggregate label', size: 12, color: '--sg-muted' }),
      text('$84,210.40', { name: 'Aggregate value', size: 12, weight: 'semibold' }),
    ),
  )
  bindNum(c, 'height', ROW_H)
  return c
}

/** Tree data first cell (CSS:2729-2794): 12px indent per level, 14px toggle. */
function treeCell(kind: string, level: number): ComponentNode {
  const toggle =
    kind === 'Leaf'
      ? frame({ name: 'Spacer', w: 14, h: 14 })
      : frame({ name: 'Toggle', w: 14, h: 14, radius: 3, align: 'center', justify: 'center' }, icon('Chevron', kind === 'Expanded' ? GRID_ICONS['chevron-down'] : GRID_ICONS['chevron-right'], 12, '--sg-muted'))
  const content = frame(
    { name: 'Content', align: 'center', w: 'fill', h: 'fill' },
    level > 0 ? frame({ name: 'Indent', w: level * 12, h: 1 }) : null,
    frame({ name: 'Toggle slot', pad: [0, 3, 0, 0] }, toggle),
    text(kind === 'Leaf' ? 'Q3 forecast.xlsx' : 'Finance', { name: 'Label', size: 13, truncate: true, w: 'fill' }),
  )
  bindNum(content, 'paddingLeft', CELL_PX)
  const c = component(
    { name: vname({ Kind: kind, Level: String(level) }), dir: 'v', w: 220, h: 30, fill: '--sg-bg', stroke: '--sg-border', strokeWeight: { right: 1, bottom: 1 } },
    content,
  )
  bindNum(c, 'height', ROW_H)
  return c
}

// ------------------------------------------------------------------ pager

/** .sv-grid-pagination-btn (CSS:3073-3097). */
function pagerButton(state: string): ComponentNode {
  return component(
    {
      name: vname({ State: state }),
      w: 28,
      h: 28,
      radius: 5,
      align: 'center',
      justify: 'center',
      fill: state === 'Hover' ? '--sg-input-bg' : null,
      opacity: state === 'Disabled' ? 0.4 : undefined,
    },
    text('›', { name: 'Glyph', size: 16, lineHeight: 16, color: state === 'Hover' ? '--sg-accent' : state === 'Disabled' ? '--sg-muted' : '--sg-fg' }),
  )
}

/** .sv-grid-pagination (CSS:2980-3101, GridFooter.svelte:115-189). */
function pager(btn: ComponentSetNode, width: number, total = 248, pageSize = 10): ComponentNode {
  const pages = Math.ceil(total / pageSize)
  const range = `1 to ${pageSize} of ${total}`
  const bold = (s: string) => {
    // Bold the three numbers, as GridFooter wraps them in <strong>.
    const out: { start: number; end: number; weight: 'semibold' }[] = []
    const re = /\d+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) out.push({ start: m.index, end: m.index + m[0].length, weight: 'semibold' })
    return out
  }
  const pageLabel = `Page 1 of ${pages}`
  const c = component(
    {
      name: 'Pager',
      gap: 24,
      align: 'center',
      justify: 'end',
      w: width,
      pad: [12, 16],
      fill: '--sg-header-bg',
      stroke: '--sg-border',
      strokeWeight: { left: 1, right: 1, bottom: 1 },
      description: 'Grid pager. Default page sizes 10, 25, 50, 100.',
    },
    frame(
      { name: 'Page size', gap: 8, align: 'center' },
      text('Page Size:', { size: 13, color: '--sg-muted' }),
      frame(
        { name: 'Page size select', gap: 6, align: 'center', h: 28, pad: [0, 8], fill: '--sg-input-bg', stroke: '--sg-input-border', radius: 5 },
        text(String(pageSize), { name: 'Value', size: 13, w: 'fill' }),
        text('▾', { name: 'Caret', size: 10, lineHeight: 10, opacity: 0.7 }),
      ),
    ),
    text(range, { name: 'Range', size: 13, ranges: bold(range) }),
    frame(
      { name: 'Nav', gap: 4, align: 'center' },
      inst(btn, { State: 'Disabled' }, { Glyph: '⇤' }),
      inst(btn, { State: 'Disabled' }, { Glyph: '‹' }),
      frame({ name: 'Page', pad: [0, 8] }, text(pageLabel, { name: 'Page label', size: 13, ranges: bold(pageLabel) })),
      inst(btn, { State: 'Default' }, { Glyph: '›' }),
      inst(btn, { State: 'Default' }, { Glyph: '⇥' }),
    ),
  )
  const select = c.findOne((n) => n.name === 'Page size select') as FrameNode
  select.minWidth = 62
  // Bottom corners only: 0 0 var(--sg-radius) var(--sg-radius).
  c.setBoundVariable('bottomLeftRadius', v('--sg-radius'))
  c.setBoundVariable('bottomRightRadius', v('--sg-radius'))
  return c
}

// ------------------------------------------------------------------- menus

/** .sv-grid-menu-item (CSS:2431-2465, 2673-2681). The icon is an instance of a 13px grid icon. */
function menuItem(state: string, defaultIcon: ComponentNode): ComponentNode {
  const checked = state === 'Checked'
  const ic = defaultIcon.createInstance()
  ic.name = 'Icon'
  if (checked) recolor(ic, '--sg-accent')
  const chev = icon('Submenu', GRID_ICONS['chevron-down'], 13, '--sg-fg')
  // CSS rotate(-90deg) is counter-clockwise; Figma rotation is counter-clockwise when positive.
  chev.rotation = 90
  chev.opacity = 0.55
  return component(
    {
      name: vname({ State: state }),
      gap: 8,
      align: 'center',
      pad: [7, 10],
      w: 250,
      radius: 5,
      fill: state === 'Hover' ? '--sg-row-hover-bg' : checked ? '--sg-selection-bg' : null,
      opacity: state === 'Disabled' ? 0.4 : undefined,
    },
    ic,
    text('Menu item', { name: 'Label', size: 13, w: 'fill', color: checked ? '--sg-accent' : '--sg-fg' }),
    chev,
  )
}

/** Column menu items and their icons (GridMenus.svelte:618-762). */
const ITEM_ICONS: Record<string, GridIcon> = {
  'Sort ascending': 'sort-asc',
  'Sort descending': 'sort-desc',
  'Remove sort': 'x',
  'Pin to left': 'pin-left',
  'Pin to right': 'pin-right',
  'Unpin column': 'x',
  'Autosize this column': 'autosize',
  'Autosize all columns': 'autosize',
  'Group by this column': 'group',
  'Remove grouping': 'x',
  'Choose columns': 'columns',
  'Reset columns': 'reset',
}

function menuSeparator(): FrameNode {
  const f = frame({ name: 'Separator', pad: [4, 6], w: 'fill' }, rect('Line', 238, 1, '--sg-border'))
  ;(f.children[0] as RectangleNode).layoutSizingHorizontal = 'FILL'
  return f
}

/** Column menu, GridMenus.svelte:618-762, width 260 (CSS:2313-2332). */
function columnMenu(itemSet: ComponentSetNode, icons: Record<string, ComponentNode>): ComponentNode {
  const c = component({ name: 'Column menu', dir: 'v', pad: 4, w: 260, fill: '--sg-bg', stroke: '--sg-border', radius: 8, description: 'Grid column menu (flat layout).' })
  const groups = [
    ['Sort ascending', 'Sort descending', 'Remove sort'],
    ['Pin to left', 'Pin to right', 'Unpin column'],
    ['Autosize this column', 'Autosize all columns'],
    ['Group by this column', 'Remove grouping'],
    ['Choose columns', 'Reset columns'],
  ]
  groups.forEach((g, gi) => {
    if (gi > 0) put(c, menuSeparator())
    for (const label of g) {
      const state = label === 'Sort ascending' ? 'Hover' : label === 'Unpin column' || label === 'Remove grouping' ? 'Disabled' : 'Default'
      const i = inst(itemSet, { State: state }, { Label: label, Submenu: label === 'Choose columns', Icon: icons[ITEM_ICONS[label]!]!.id })
      put(c, i)
      i.layoutSizingHorizontal = 'FILL'
    }
  })
  shadow(c, 'Grid menu')
  return c
}

/** Filter popover, GridMenus.svelte:340-570, width 260 (CSS:2473-2671, 3121-3203). */
function filterMenu(): ComponentNode {
  const input = (name: string, placeholder: string, extra?: SceneNode, padLeft = 8) =>
    frame(
      { name, align: 'center', gap: 6, h: 28, w: 'fill', pad: [0, 8, 0, padLeft], fill: '--sg-input-bg', stroke: '--sg-input-border', radius: 5 },
      extra ?? null,
      text(placeholder, { name: 'Placeholder', size: 13, color: '--sg-muted', w: 'fill', truncate: true }),
    )
  const head = (label: string, withIcon: boolean) =>
    frame(
      { name: `${label} head`, gap: 6, align: 'center', pad: [2, 0, 6, 0], w: 'fill' },
      withIcon ? icon('Icon', GRID_ICONS.filter, 13, '--sg-muted') : null,
      text(label, { size: 13, weight: 'semibold', color: '--sg-muted' }),
    )
  const operator = frame(
    { name: 'Operator', align: 'center', justify: 'between', h: 28, w: 'fill', pad: [0, 8], fill: '--sg-input-bg', stroke: '--sg-input-border', radius: 5 },
    text('Contains', { size: 13 }),
    icon('Caret', GRID_ICONS['chevron-down'], 9, '--sg-fg'),
  )
  const addCondition = frame(
    { name: 'Add condition', pad: [3, 8], stroke: '--sg-border', radius: 5 },
    text('+ Add condition', { size: 11.5, weight: 'semibold', color: '--sg-accent' }),
  )
  addCondition.dashPattern = [4, 3]
  const check = (on: boolean) => {
    const b = frame({ name: 'Checkbox', dir: 'none', w: 14, h: 14, radius: 3, fill: on ? '--sg-accent' : '--sg-input-bg', stroke: on ? '--sg-accent' : '--sg-input-border', strokeInLayout: false })
    if (on) absolute(b, icon('Tick', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 7.2l1.9 2 3.3-4.4"/></svg>', 14, '--sg-input-bg'), 0, 0)
    return b
  }
  const valueRow = (label: string, on: boolean) =>
    frame({ name: label, gap: 8, align: 'center', h: 24, pad: [0, 10], w: 'fill', radius: 6, fill: label === 'France' ? '--sg-row-hover-bg' : null }, check(on), text(label, { size: 12 }))
  const list = frame(
    { name: 'Values', dir: 'v', pad: 4, w: 'fill', fill: '--sg-input-bg', stroke: '--sg-input-border', radius: '--sg-radius' },
    valueRow('Austria', true),
    valueRow('Czechia', false),
    valueRow('France', true),
    valueRow('Germany', true),
    valueRow('Italy', true),
    valueRow('Netherlands', false),
    valueRow('Portugal', true),
  )
  const btn = (label: string, primary: boolean) =>
    frame(
      { name: label, pad: [5, 10], radius: 5, fill: primary ? '--sg-accent' : '--sg-input-bg', stroke: primary ? '--sg-accent' : '--sg-input-border' },
      // .sv-grid-menu-btn-primary hard-codes #fff (CSS:2667-2671).
      text(label, { size: 13, color: primary ? '#ffffff' : '--sg-fg' }),
    )
  const body = frame(
    { name: 'Body', dir: 'v', gap: 6, pad: [4, 6, 6, 6], w: 'fill' },
    head('Filter condition', true),
    operator,
    input('Condition value', 'Value'),
    addCondition,
    head('Values', false),
    input('Search', 'Search values...', icon('Search', GRID_ICONS.search, 14, '--sg-muted'), 8),
    frame({ name: 'Select all', gap: 8, align: 'center', pad: [4, 8, 4, 3] }, check(true), text('(Select all)', { size: 13, weight: 'semibold' })),
    list,
    frame({ name: 'Actions', gap: 6, justify: 'end', pad: [8, 0, 0, 0], w: 'fill' }, btn('Clear filter', false), btn('Done', true)),
  )
  const c = component({ name: 'Filter menu', dir: 'v', pad: 4, w: 260, fill: '--sg-bg', stroke: '--sg-border', radius: 8, description: 'Grid column filter popover (funnel button).' }, body)
  shadow(c, 'Grid menu')
  return c
}

// --------------------------------------------------------------- misc parts

/** .sv-grid-toolbar-btn (CSS:130-152). */
function toolbarButton(state: string): ComponentNode {
  const active = state === 'Active'
  const ink: Ink = active ? '#ffffff' : state === 'Hover' ? '--sg-accent' : '--sg-fg'
  return component(
    {
      name: vname({ State: state }),
      gap: 6,
      align: 'center',
      pad: [6, 12],
      radius: '--sg-radius',
      fill: active ? '--sg-accent' : '--sg-bg',
      stroke: active || state === 'Hover' ? '--sg-accent' : '--sg-border',
    },
    icon('Icon', GRID_ICONS['tool-panel'], 12.5, ink),
    text('Columns & Filters', { name: 'Label', size: 12.5, weight: 'semibold', color: ink }),
  )
}

/** Filter row cell (CSS:1115-1157, 2281-2304, 1774-1815). */
function filterRowCell(): ComponentNode {
  const op = frame(
    { name: 'Operator', gap: 2, align: 'center', h: 24, pad: [0, 4], fill: '--sg-input-bg', stroke: '--sg-input-border', radius: 4, opacity: 0.85 },
    icon('Operator icon', GRID_ICONS['op-contains'], 13, '--sg-muted'),
    icon('Caret', GRID_ICONS['chevron-down'], 9, '--sg-muted'),
  )
  const value = frame(
    { name: 'Value', align: 'center', h: 24, w: 'fill', pad: [0, 8], fill: '--sg-input-bg', stroke: '--sg-input-border', radius: 5 },
    text('Filter...', { name: 'Placeholder', size: 13, color: '--sg-muted', opacity: 0.7, w: 'fill', truncate: true }),
  )
  return component(
    { name: 'Filter row cell', dir: 'v', w: 140, fill: '--sg-header-bg', stroke: '--sg-border', strokeWeight: { right: 1 }, description: 'Cell of the filter row (showFilterRow). The CSS splits operator:value 2:3; here the value fills.' },
    frame({ name: 'Content', gap: 4, align: 'center', pad: [5, 7], w: 'fill' }, op, value),
    rect('Bottom border', 139, 1, '--sg-header-border'),
  )
}

/** <sv-grid-scrollbar> (sv-grid-scrollbar.ts:32-140): 16px track, 10px thumb. */
function scrollbar(vertical: boolean): ComponentNode {
  const len = 200
  const c = component({ name: vname({ Orientation: vertical ? 'Vertical' : 'Horizontal' }), dir: 'none', w: vertical ? 16 : len, h: vertical ? len : 16, fill: '--sg-scrollbar-bg' })
  absolute(c, rect('Edge', vertical ? 1 : len, vertical ? len : 1, '--sg-scrollbar-border'), 0, 0)
  const arrow = (rot: number) => {
    const f = frame({ name: 'Arrow', w: 16, h: 16, radius: 3, align: 'center', justify: 'center' }, icon('Chevron', SCROLL_ARROW, 10, '--sg-scrollbar-arrow'))
    ;(f.children[0] as FrameNode).rotation = rot
    return f
  }
  absolute(c, arrow(vertical ? 180 : -90), 0, 0)
  absolute(c, arrow(vertical ? 0 : 90), vertical ? 0 : len - 16, vertical ? len - 16 : 0)
  absolute(c, rect('Thumb', vertical ? 10 : 70, vertical ? 70 : 10, '--sg-scrollbar-thumb', 6), vertical ? 3 : 40, vertical ? 40 : 3)
  return c
}

/** Loading bar (CSS:62-82): 3px accent track at 18%, a 40% segment. */
function loadingBar(): ComponentNode {
  const c = component({ name: 'Loading bar', dir: 'none', w: 720, h: 3, fill: ['--sg-accent', 0.18], description: 'Indeterminate loading bar at the top of the grid.' })
  absolute(c, rect('Segment', 288, 3, '--sg-accent'), 120, 0)
  return c
}

// -------------------------------------------------------------- badge cell

const TONE_OF: Record<string, string> = {
  Active: 'Success',
  Paid: 'Success',
  Shipped: 'Info',
  Pending: 'Warning',
  Inactive: 'Neutral',
  Refunded: 'Neutral',
  Failed: 'Danger',
}

/**
 * A body cell holding an SvBadge, the usual way a grid shows row status (a
 * cell snippet in the app). The badge is an exposed nested instance, so its
 * label and tone stay editable from the cell instance.
 */
function badgeCell(tone: string, state: string, badgeSet: ComponentSetNode): ComponentNode {
  const badge = inst(badgeSet, { Tone: tone, Size: 'md', Dot: 'True' }, { Label: tone === 'Success' ? 'Active' : tone })
  const content = frame({ name: 'Content', align: 'center', w: 'fill', h: 'fill' }, badge)
  bindNum(content, 'paddingLeft', CELL_PX)
  const c = component({ name: vname({ Tone: tone, State: state }), dir: 'v', w: 140, h: 30, stroke: '--sg-border', strokeWeight: { right: 1, bottom: 1 } })
  put(c, content)
  bindNum(c, 'height', ROW_H)
  setFill(c, state === 'Hover' ? '--sg-row-hover-bg' : state === 'Selected' ? '--sg-selection-bg' : '--sg-bg')
  badge.isExposedInstance = true
  return c
}

// ------------------------------------------------------------------- build

export type GridParts = {
  header: ComponentSetNode
  cell: ComponentSetNode
  badgeCell: ComponentSetNode
  select: ComponentSetNode
  group: ComponentSetNode
  tree: ComponentSetNode
  pagerButton: ComponentSetNode
  pager: ComponentNode
  menuItem: ComponentSetNode
  columnMenu: ComponentNode
  filterMenu: ComponentNode
  toolbarButton: ComponentSetNode
  filterRowCell: ComponentNode
  scrollbar: ComponentSetNode
  loadingBar: ComponentNode
}

export function buildGridParts(ui: UiKit): { sections: FrameNode[]; parts: GridParts } {
  const sections: FrameNode[] = []
  const sec = (title: string, source: string, note: string | undefined, doc: DocInfo = {}) => {
    const s = section(title, source, note, doc)
    sections.push(s)
    return s
  }

  const hHost = sec(
    'Header cell',
    'packages/grid/src/SvGrid.css:401-742, 2146-2279',
    'Content height binds to grid/header-height: 22px by default, because the column-menu button keeps the row at 22px even while collapsed. Sort, filter and menu buttons show on column hover; an active filter stays visible.',
    {
      summary: 'One per column. Shows the label, the sort direction and, on hover, the filter and column-menu buttons.',
      usage: "const columns: GridColumns<Customer> = [\n  { field: 'name', header: 'Customer', width: 170 },\n  { field: 'revenue', header: 'Revenue',\n    width: 120, align: 'right' },\n]",
      props: [
        ['header', 'string'],
        ['width', 'number = 140'],
        ['align', "'left' | 'center' | 'right' (numbers and dates default to right)"],
        ['sortable', 'boolean'],
        ['headerHeight', 'number (grid prop; content-sized by default)'],
      ],
    },
  )
  const headers: ComponentNode[] = []
  for (const Pinned of ['No', 'Yes'])
    for (const Align of ['Left', 'Right'])
      for (const Filter of ['Off', 'On'])
        for (const Sort of ['None', 'Asc', 'Desc']) for (const State of ['Default', 'Hover']) headers.push(headerCell({ Sort, Filter, Align, Pinned, State }))
  const header = variantSet('Grid header cell', hHost, headers, { description: 'th.sv-grid-column. Width is the column width (default 140).' })
  textProp(header, 'Label', 'Label', 'Column')
  matrix(header, ['Pinned', 'Align', 'Filter'], ['Sort', 'State'])

  const cHost = sec(
    'Body cell',
    'packages/grid/src/SvGrid.css:401-429, 1387-1463, 1638-1677, 2048-2054',
    'Height binds to grid/row-height. Ember sets row/alt-bg to the plain background, so zebra rows are invisible in Ember.',
    {
      summary: 'Every data cell. Active is the keyboard cell; Range is part of a drag selection; Editing hosts the inline editor.',
      usage: '<SvGrid\n  data={rows}\n  {columns}\n  rowHeight={30}\n  enableRowHover\n  enableCellSelection\n  enableInlineEditing\n/>',
      props: [
        ['rowHeight', 'number = 30'],
        ['zebraRows', 'boolean = false'],
        ['enableRowHover', 'boolean = false'],
        ['enableCellSelection', 'boolean'],
        ['enableInlineEditing', 'boolean'],
        ['initialColumnPinning', "{ left?: string[]; right?: string[] }"],
      ],
    },
  )
  const cells: ComponentNode[] = []
  for (const Pinned of ['No', 'Yes'])
    for (const Align of ['Left', 'Right'])
      for (const State of ['Default', 'Hover', 'Selected', 'Active', 'Editing', 'Invalid', 'Range']) cells.push(bodyCell({ State, Align, Pinned }))
  const cell = variantSet('Grid cell', cHost, cells, { description: 'td.sv-grid-cell.' })
  textProp(cell, 'Value', 'Value', 'Northwind Traders')
  matrix(cell, ['Pinned', 'Align'], ['State'])

  const badgeSet = ui.Badge as ComponentSetNode
  const badgeCells: ComponentNode[] = []
  for (const Tone of ['Success', 'Info', 'Warning', 'Danger', 'Neutral']) for (const State of ['Default', 'Hover', 'Selected']) badgeCells.push(badgeCell(Tone, State, badgeSet))
  const badgeCellSet = variantSet('Grid badge cell', cHost, badgeCells, { description: 'Body cell with an SvBadge, for status columns.' })
  matrix(badgeCellSet, ['Tone'], ['State'])

  const sHost = sec('Selection column', 'packages/grid/src/SvGrid.css:1044-1050, 1262-1362', 'A fixed 44px column. The tick is a CSS border pseudo-element in the grid, drawn here as a path.', {
    summary: 'Row checkboxes. The header box selects every row on the page and shows a dash when only some are selected.',
    usage: '<SvGrid data={rows} {columns} showRowSelection />',
    props: [['showRowSelection', 'boolean']],
  })
  const selects: ComponentNode[] = []
  for (const row of ['Header', 'Body'] as const) for (const checked of ['False', 'True', 'Mixed']) selects.push(selectCell(row, checked))
  const select = variantSet('Grid select cell', sHost, selects)
  matrix(select, ['Row'], ['Checked'])

  const gHost = sec('Group and tree rows', 'packages/grid/src/SvGrid.css:2683-2841, 2729-2794', 'Group rows indent 20px per level; tree rows indent 12px per level (treeData.indentPx).', {
    summary: 'Group banners with a count and aggregates, and the expander cell of tree data.',
    usage: "<SvGrid data={rows} {columns}\n  groupBy={['country']} />\n\n<SvGrid data={rows} {columns}\n  treeData={{ parentField: 'parentId' }} />",
    props: [
      ['groupBy', 'string[]'],
      ['treeData', '{ parentField, idField?, column?, indentPx? = 12 }'],
    ],
  })
  const group = variantSet('Grid group row', gHost, [true, false].flatMap((e) => [0, 1].map((l) => groupRow(e, l))))
  textProp(group, 'Label', 'Label', 'Country: Germany')
  textProp(group, 'Count', 'Count text', '12 rows')
  textProp(group, 'Aggregate label', 'Aggregate label', 'Revenue:')
  textProp(group, 'Aggregate value', 'Aggregate value', '$84,210.40')
  boolProp(group, 'Show aggregate', 'Aggregate', true)
  matrix(group, ['Expanded', 'Level'], [])
  const tree = variantSet('Grid tree cell', gHost, ['Expanded', 'Collapsed', 'Leaf'].flatMap((k) => [0, 1, 2].map((l) => treeCell(k, l))))
  textProp(tree, 'Label', 'Label', 'Finance')
  matrix(tree, ['Kind'], ['Level'])

  const pHost = sec('Pager and toolbar', 'packages/grid/src/SvGrid.css:124-152, 2980-3101; GridFooter.svelte', 'The range reads "1 to 10 of 248", with the word "to". Pager arrows are text glyphs.', {
    summary: 'The footer pager and the toolbar button that opens the columns and filters panel.',
    usage: '<SvGrid data={rows} {columns}\n  pageable pageSize={25} />',
    props: [
      ['pageable', 'boolean = false'],
      ['pageSize', 'number = 10 (menu: 10, 25, 50, 100)'],
    ],
  })
  const pagerButtonSet = variantSet('Grid pager button', pHost, ['Default', 'Hover', 'Disabled'].map(pagerButton))
  textProp(pagerButtonSet, 'Glyph', 'Glyph', '›')
  matrix(pagerButtonSet, [], ['State'])
  const toolbarButtonSet = variantSet('Grid toolbar button', pHost, ['Default', 'Hover', 'Active'].map(toolbarButton))
  textProp(toolbarButtonSet, 'Label', 'Label', 'Columns & Filters')
  matrix(toolbarButtonSet, [], ['State'])
  const pagerComp = pager(pagerButtonSet, 720)
  put(pHost, example('Pager', pagerComp))

  const mHost = sec('Menus', 'packages/grid/src/GridMenus.svelte; SvGrid.css:2306-2671', 'The menus render outside .sv-grid-root, so they take the page font, not --sg-font. Menu icons are 13px instances of the Grid icon components; swap them with the Icon property.', {
    summary: 'The column menu and the filter popover the header buttons open.',
    usage: '<SvGrid data={rows} {columns}\n  filterMode="menu" />',
    props: [['filterMode', "'menu' | ... (see the filtering docs)"]],
  })
  const iconRow = frame({ name: 'Grid icons', gap: 20, wrap: true, w: 560 })
  const icons: Record<string, ComponentNode> = {}
  for (const name of Object.keys(GRID_ICONS) as GridIcon[]) {
    const c = iconComponent(`Grid icon/${name}`, GRID_ICONS[name], 13, '--sg-muted')
    put(iconRow, c)
    icons[name] = c
  }
  put(mHost, example('Grid icons', iconRow))
  const menuItemSet = variantSet('Grid menu item', mHost, ['Default', 'Hover', 'Checked', 'Disabled'].map((s) => menuItem(s, icons['sort-asc']!)))
  textProp(menuItemSet, 'Label', 'Label', 'Menu item')
  boolProp(menuItemSet, 'Submenu', 'Submenu', false)
  swapProp(menuItemSet, 'Icon', 'Icon', icons['sort-asc']!)
  matrix(menuItemSet, ['State'], [])
  const col = columnMenu(menuItemSet, icons)
  const flt = filterMenu()
  put(mHost, frame({ name: 'Open menus', gap: 40, align: 'start' }, example('Column menu', col), example('Filter popover', flt)))

  const xHost = sec('Filter row, scrollbar, loading', 'SvGrid.css:62-82, 1115-1157; sv-grid-scrollbar.ts', undefined, {
    summary: 'The inline filter row under the header, the grid scrollbar, and the loading bar shown while data refreshes.',
    usage: '<SvGrid data={rows} {columns} showFilterRow />',
    props: [['showFilterRow', 'boolean']],
  })
  const frc = filterRowCell()
  put(xHost, example('Filter row cell', frc))
  const sb = variantSet('Grid scrollbar', xHost, [scrollbar(true), scrollbar(false)])
  matrix(sb, [], ['Orientation'])
  const lb = loadingBar()
  put(xHost, example('Loading bar', lb))

  return {
    sections,
    parts: {
      header,
      cell,
      badgeCell: badgeCellSet,
      select,
      group,
      tree,
      pagerButton: pagerButtonSet,
      pager: pagerComp,
      menuItem: menuItemSet,
      columnMenu: col,
      filterMenu: flt,
      toolbarButton: toolbarButtonSet,
      filterRowCell: frc,
      scrollbar: sb,
      loadingBar: lb,
    },
  }
}

// ---------------------------------------------------------------- examples

type Col = { name: string; w: number; align?: 'Left' | 'Right'; pinned?: boolean; sort?: 'Asc' | 'Desc'; filter?: boolean; badge?: boolean }

const COLS: Col[] = [
  { name: 'Customer', w: 170, pinned: true },
  { name: 'Company', w: 180 },
  { name: 'Country', w: 120, filter: true },
  { name: 'Status', w: 120, badge: true },
  { name: 'Orders', w: 90, align: 'Right' },
  { name: 'Revenue', w: 120, align: 'Right', sort: 'Desc' },
  { name: 'Last order', w: 110, align: 'Right' },
]

// Sorted by revenue, descending, to match the header's sort indicator.
const ROWS: string[][] = [
  ['Noah Dubois', 'Tailspin Toys', 'France', 'Active', '63', '31,780.25', '2026-10-02'],
  ['Sofia Jansen', 'Wide World Importers', 'Netherlands', 'Active', '51', '24,900.00', '2026-10-01'],
  ['Ava Thompson', 'Northwind Traders', 'Germany', 'Active', '42', '18,420.00', '2026-09-30'],
  ['Chloe Martin', 'Coho Winery', 'France', 'Active', '36', '15,230.00', '2026-09-29'],
  ['Lucas Silva', 'Adventure Works', 'Portugal', 'Active', '29', '12,055.75', '2026-09-25'],
  ['Jonas Weber', 'Alpine Ski House', 'Germany', 'Active', '22', '9,875.10', '2026-09-27'],
  ['Liam Becker', 'Contoso Ltd', 'Austria', 'Active', '17', '7,915.50', '2026-09-28'],
  ['Elias Berg', 'Proseware', 'Sweden', 'Pending', '12', '4,480.40', '2026-09-12'],
  ['Mia Rossi', 'Fabrikam Inc', 'Italy', 'Pending', '8', '2,310.00', '2026-09-21'],
  ['Emma Novak', 'Litware Inc', 'Czechia', 'Inactive', '3', '640.00', '2026-06-14'],
]

type CellState = (r: number, c: number) => string

/**
 * The pager is one component; examples use instances of it. Building a new
 * pager inside the Data grid or a screen would nest a component inside a
 * component, which Figma refuses ("Reparenting would create a component
 * inside a component").
 */
function pagerAt(parts: GridParts, width: number): InstanceNode {
  const p = parts.pager.createInstance()
  p.resize(width, p.height)
  return p
}

function headerRow(parts: GridParts, cols: Col[], opts: { select?: string; hover?: number } = {}): FrameNode {
  const row = frame({ name: 'Header row' })
  if (opts.select) put(row, inst(parts.select, { Row: 'Header', Checked: opts.select }))
  cols.forEach((col, i) => {
    const h = inst(
      parts.header,
      {
        Sort: col.sort ?? 'None',
        Filter: col.filter ? 'On' : 'Off',
        Align: col.align ?? 'Left',
        Pinned: col.pinned ? 'Yes' : 'No',
        State: opts.hover === i ? 'Hover' : 'Default',
      },
      { Label: col.name },
    )
    put(row, h)
    setWidth(h, col.w)
    if (i === cols.length - 1) h.strokeRightWeight = 0
  })
  return row
}

function bodyRow(parts: GridParts, cols: Col[], values: string[], r: number, state: CellState, select?: boolean): FrameNode {
  const row = frame({ name: `Row ${r + 1}` })
  const rowState = state(r, -1)
  if (select !== undefined) put(row, inst(parts.select, { Row: 'Body', Checked: rowState === 'Selected' ? 'True' : 'False' }))
  cols.forEach((col, c) => {
    const value = values[c] ?? ''
    let cell: InstanceNode
    if (col.badge) {
      const st = state(r, c)
      cell = inst(parts.badgeCell, { Tone: TONE_OF[value] ?? 'Neutral', State: st === 'Hover' || st === 'Selected' ? st : 'Default' })
      const label = cell.findOne((n) => n.type === 'TEXT' && n.name === 'Label') as TextNode | null
      if (label) label.characters = value
    } else {
      cell = inst(parts.cell, { State: state(r, c), Align: col.align ?? 'Left', Pinned: col.pinned ? 'Yes' : 'No' }, { Value: value })
    }
    put(row, cell)
    setWidth(cell, col.w, ROW_H)
    if (c === cols.length - 1) cell.strokeRightWeight = 0
  })
  return row
}

function gridWidth(cols: Col[], select: boolean): number {
  return cols.reduce((s, c) => s + c.w, 0) + (select ? 44 : 0)
}

/** The full example: toolbar, header, ten rows, pager. A component, so it can be placed in every theme. */
function dataGrid(parts: GridParts): ComponentNode {
  const state: CellState = (r, c) => {
    if (r === 2) return 'Selected'
    if (r === 3) return 'Hover'
    if (r === 5 && c === 1) return 'Active'
    return 'Default'
  }
  const width = gridWidth(COLS, true)
  const body = frame({ name: 'Body', dir: 'v' }, ...ROWS.map((vals, r) => bodyRow(parts, COLS, vals, r, state, true)))
  const toolbar = frame({ name: 'Toolbar', gap: 8, align: 'center', pad: [6, 2] }, inst(parts.toolbarButton, { State: 'Default' }))
  return component(
    { name: 'Data grid', dir: 'v', w: width, description: 'Example: selection column, pinned first column, status badges, sort, active filter, hover, selected row, active cell, pager.' },
    toolbar,
    headerRow(parts, COLS, { select: 'Mixed' }),
    body,
    pagerAt(parts, width),
  )
}

/** Grouping: group rows with an aggregate. */
function groupedGrid(parts: GridParts): FrameNode {
  const cols = COLS.filter((c) => c.name !== 'Country').map((c) => ({ ...c, pinned: false, filter: false, sort: undefined }))
  const width = gridWidth(cols, false)
  const grp = (label: string, count: string, agg: string, expanded: boolean, level = 0) => {
    const g = inst(parts.group, { Expanded: expanded ? 'True' : 'False', Level: String(level) }, { Label: label, Count: count, 'Aggregate value': agg })
    setWidth(g, width, ROW_H)
    return g
  }
  const pick = (country: string) => ROWS.filter((r) => r[2] === country).map((r) => r.filter((_, i) => i !== 2))
  const rows = (country: string) => pick(country).map((vals, i) => bodyRow(parts, cols, vals, i, () => 'Default'))
  return frame(
    { name: 'Grouped grid', dir: 'v' },
    headerRow(parts, cols),
    grp('Country: France', '2 rows', '$47,010.25', true),
    ...rows('France'),
    grp('Country: Germany', '2 rows', '$28,295.10', true),
    ...rows('Germany'),
    grp('Country: Italy', '1 row', '$2,310.00', false),
    grp('Country: Netherlands', '1 row', '$24,900.00', false),
  )
}

/** Editing, validation and a range selection with its 2px accent edge. */
function editingGrid(parts: GridParts): FrameNode {
  const cols = COLS.filter((c) => !c.badge).slice(0, 6).map((c) => ({ ...c, pinned: false, filter: false, sort: undefined }))
  const state: CellState = (r, c) => {
    if (r === 0 && c === 1) return 'Editing'
    if (r === 1 && c === 3) return 'Invalid'
    if (r >= 2 && r <= 4 && c >= 4 && c <= 5) return 'Range'
    return 'Default'
  }
  const vals = ROWS.slice(0, 6).map((r) => r.filter((_, i) => i !== 3).slice(0, 6))
  vals[1]![3] = '-4'
  const body = frame({ name: 'Body', dir: 'v' }, ...vals.map((v, r) => bodyRow(parts, cols, v, r, state)))
  const f = frame({ name: 'Editing grid', dir: 'v' }, headerRow(parts, cols), body)
  // Range edge: inset 2px accent on the outer cells of the range (CSS:1654-1665).
  // Placed for Default density: 23px header, 30px rows.
  const x = cols.slice(0, 4).reduce((s, c) => s + c.w, 0)
  const w = cols[4]!.w + cols[5]!.w - 1
  const edge = frame({ name: 'Range edge', dir: 'none', w, h: 30 * 3 - 1, stroke: '--sg-accent', strokeWeight: 2 })
  absolute(f, edge, x, 23 + 30 * 2)
  return f
}

/** Menus open over a header row. */
function menusOpen(parts: GridParts): FrameNode {
  const cols = COLS.slice(0, 5).map((c) => ({ ...c, pinned: false, sort: undefined }))
  const f = frame({ name: 'Menus open', dir: 'v', w: gridWidth(cols, false), h: 620 }, headerRow(parts, cols, { hover: 2 }))
  f.clipsContent = false
  const at = cols[0]!.w + cols[1]!.w + cols[2]!.w
  absolute(f, parts.columnMenu.createInstance(), at - 260, 26)
  absolute(f, parts.filterMenu.createInstance(), at + 16, 26)
  return f
}

// ------------------------------------------------------------------ screen

const ORDER_COLS: Col[] = [
  { name: 'Order', w: 110, pinned: true },
  { name: 'Customer', w: 210 },
  { name: 'Status', w: 120, badge: true },
  { name: 'Country', w: 140, filter: true },
  { name: 'Items', w: 80, align: 'Right' },
  { name: 'Total', w: 120, align: 'Right' },
  { name: 'Placed', w: 140, align: 'Right', sort: 'Desc' },
]

const ORDERS: string[][] = [
  ['#10482', 'Tailspin Toys', 'Paid', 'France', '4', '1,284.00', '2026-10-07 09:12'],
  ['#10481', 'Northwind Traders', 'Pending', 'Germany', '2', '312.50', '2026-10-07 08:47'],
  ['#10480', 'Wide World Importers', 'Shipped', 'Netherlands', '12', '4,906.20', '2026-10-06 17:30'],
  ['#10479', 'Coho Winery', 'Paid', 'France', '6', '842.00', '2026-10-06 15:02'],
  ['#10478', 'Alpine Ski House', 'Failed', 'Austria', '1', '129.00', '2026-10-06 11:18'],
  ['#10477', 'Adventure Works', 'Shipped', 'Portugal', '3', '596.40', '2026-10-06 09:55'],
  ['#10476', 'Contoso Ltd', 'Refunded', 'Austria', '2', '240.00', '2026-10-05 16:41'],
  ['#10475', 'Proseware', 'Paid', 'Sweden', '9', '2,118.75', '2026-10-05 13:09'],
  ['#10474', 'Fabrikam Inc', 'Pending', 'Italy', '5', '730.10', '2026-10-05 10:26'],
  ['#10473', 'Litware Inc', 'Shipped', 'Czechia', '7', '1,055.00', '2026-10-04 18:03'],
]

/**
 * An order list screen built only from kit parts: header with actions, pill
 * tabs, search and filter controls, the grid with status badges, the pager.
 * Shows the components in the arrangement an app actually uses them.
 */
function ordersScreen(parts: GridParts, ui: UiKit): ComponentNode {
  const width = gridWidth(ORDER_COLS, true)
  const button = ui.Button as ComponentSetNode
  const header = frame(
    { name: 'Header', justify: 'between', align: 'center', pad: [24, 24, 16, 24], w: 'fill' },
    frame(
      { name: 'Title', dir: 'v', gap: 4 },
      text('Orders', { size: 22, weight: 'semibold', letterSpacing: -0.2 }),
      text('248 orders, synced 2 minutes ago', { size: 13, color: '--sg-muted' }),
    ),
    frame(
      { name: 'Actions', gap: 8, align: 'center' },
      inst(button, { Variant: 'Secondary', Size: 'md', State: 'Default' }, { Label: 'Export' }),
      inst(button, { Variant: 'Primary', Size: 'md', State: 'Default' }, { Label: 'New order' }),
    ),
  )
  const tabs = inst(ui.Tabs as ComponentSetNode, { Variant: 'Pill' })
  const labels = ['All orders', 'Open', 'Shipped', 'Returned']
  tabs.findAll((n) => n.type === 'TEXT' && n.name === 'Label').forEach((t, i) => {
    ;(t as TextNode).characters = labels[i] ?? ''
  })
  const search = inst(ui['Text input'] as ComponentSetNode, { Size: 'md', State: 'Default' }, { 'Show label': false, 'Show hint': false, Filled: false, 'Show placeholder': true, Placeholder: 'Search orders' })
  const country = inst(ui.Select as ComponentSetNode, { Size: 'md', State: 'Default' }, { 'Show label': false, Value: 'All countries' })
  const toolbar = frame(
    { name: 'Filters', gap: 12, align: 'center', pad: [16, 24], w: 'fill' },
    search,
    country,
    frame({ name: 'Spacer', w: 'fill', h: 1 }),
    inst(parts.toolbarButton, { State: 'Default' }),
  )
  const state: CellState = (r, c) => {
    if (r === 1) return 'Selected'
    if (r === 4 && c === 5) return 'Active'
    return 'Default'
  }
  const grid = frame(
    { name: 'Grid', dir: 'v', pad: [0, 24, 24, 24] },
    headerRow(parts, ORDER_COLS, { select: 'Mixed' }),
    ...ORDERS.map((vals, r) => bodyRow(parts, ORDER_COLS, vals, r, state, true)),
    pagerAt(parts, width),
  )
  return component(
    { name: 'Screen / Orders', dir: 'v', w: width + 48, fill: '--sg-bg', stroke: '--sg-border', radius: 14, clip: true, strokeInLayout: false, description: 'An order list built from kit components only.' },
    header,
    frame({ name: 'Tabs row', pad: [0, 24], w: 'fill' }, tabs),
    toolbar,
    grid,
  )
}

export function buildGridExamples(parts: GridParts, ui: UiKit): { sections: FrameNode[]; dataGrid: ComponentNode; screen: ComponentNode } {
  const sections: FrameNode[] = []

  const screenHost = section('Orders screen', 'Composed from kit components', undefined, {
    summary: 'A whole screen made only of kit instances: buttons, pill tabs, a text input and select, the grid with status badges, and the pager. Start new grid screens from a copy of this.',
  })
  const screen = ordersScreen(parts, ui)
  put(screenHost, screen)
  sections.push(screenHost)

  const main = section('Data grid', 'Composed from the parts below', 'The grid draws no outer frame: only cell right and bottom borders, and the last column drops its right border (SvGrid.css:418-421).', {
    summary: 'Selection column, a pinned first column, status badges, sort, an active filter, a hovered row, a selected row, the active cell and the pager.',
    usage: "<SvGrid\n  data={rows}\n  {columns}\n  showRowSelection\n  pageable\n  initialColumnPinning={{ left: ['name'] }}\n/>",
  })
  const dg = dataGrid(parts)
  put(main, dg)
  sections.push(main)

  // A theme the plan cannot show (no mode, no fallback collection) would
  // repeat the first theme, so it is dropped.
  const copy = (label: string) => frame({ name: label, dir: 'v', gap: 14, pad: 28, fill: '--sg-bg', stroke: '--sg-border', radius: 14, strokeInLayout: false }, text(label, { size: 13, weight: 'semibold', color: '--sg-muted' }), dg.createInstance())
  const row = frame({ name: 'Copies', gap: 32, wrap: true, w: 2280 })
  let copies = 0
  for (const mode of KIT.modes) {
    const holder = copy(mode.name)
    if (themeAs(holder, mode.id)) {
      put(row, holder)
      copies++
    } else holder.remove()
  }
  const roomy = copy(`${KIT.modes[0]!.name}, Comfortable density`)
  if (setMode(roomy, 'comfortable', KIT.density.name)) {
    put(row, roomy)
    copies++
  } else roomy.remove()
  if (copies > 1) {
    const themes = section('Themes and density', 'Instances of the data grid with an explicit variable mode', undefined, {
      dark: false,
      summary: 'The same component pinned to each mode of the SvGrid collection. The last copy also pins Comfortable density. Set a mode on any frame in the right sidebar to do the same.',
    })
    put(themes, row)
    sections.push(themes)
  } else row.remove()

  const more = section('States', 'Row grouping, editing and validation, menus', undefined, {
    summary: 'Group banners with aggregates, a cell in edit mode, an invalid value, a range selection with its accent edge, and the header menus open.',
  })
  put(
    more,
    example('Row grouping', groupedGrid(parts)),
    example('Editing, invalid cell, range selection', editingGrid(parts)),
    example('Column menu and filter popover', menusOpen(parts)),
  )
  sections.push(more)
  return { sections, dataGrid: dg, screen }
}
