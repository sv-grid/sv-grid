/**
 * Page furniture: documentation cards with Light and Dark panels, labelled
 * variant matrices, category headings, page headers and page layout.
 * Everything paints with the kit's own variables, so the documentation
 * re-themes with the components it describes.
 *
 * Nodes are matched by `id`, never by object identity: the plugin API does
 * not promise to hand back the same wrapper object for the same node.
 */
import { KIT, absolute, canTheme, frame, put, rect, setMode, text, themeAs, type Shadow, type TypeDef } from './lib'

export type DocInfo = {
  /** One or two sentences: what the component is for. */
  summary?: string
  /** Svelte usage, checked against @svgrid/grid with svgrid_check_code. */
  usage?: string
  /** [prop, "type = default"] rows. */
  props?: [string, string][]
  /** Show a Dark panel under the Light one (default true). */
  dark?: boolean
}

type Card = { card: FrameNode; body: FrameNode; stage: FrameNode; light: FrameNode | null; dark: boolean }
const cards: Card[] = []
/** Stage id -> its card, for layout. Kept after finishCards() empties `cards`. */
const cardByStage = new Map<string, FrameNode>()

/** The card a stage belongs to; other frames (headers, headings) pass through. */
export function cardOf(node: SceneNode): SceneNode {
  return cardByStage.get(node.id) ?? node
}

export const LIGHT = KIT.modes[0]!
export const DARK = KIT.modes.find((m) => m.id === LIGHT.id.replace(/-light$/, '-dark')) ?? KIT.modes[1]

function label(t: string): TextNode {
  return text(t, { size: 11, weight: 'semibold', color: '--sg-muted', upper: true, letterSpacing: 0.6, name: t })
}

function codeBlock(code: string): FrameNode {
  return frame(
    { name: 'Code', dir: 'v', pad: [14, 16], w: 'fill', fill: '--sg-bg-subtle', stroke: '--sg-border', radius: 10, strokeInLayout: false },
    text(code, { name: 'Source', size: 12, lineHeight: 19, mono: true, w: 'fill' }),
  )
}

function propsTable(rows: [string, string][]): FrameNode {
  const t = frame({ name: 'Props', dir: 'v', w: 'fill', stroke: '--sg-border', strokeWeight: { top: 1 } })
  for (const [name, value] of rows) {
    put(
      t,
      frame(
        { name, gap: 12, pad: [9, 0], w: 'fill', stroke: '--sg-border', strokeWeight: { bottom: 1 } },
        frame({ name: 'Name', w: 112 }, text(name, { size: 12, mono: true })),
        text(value, { name: 'Value', size: 12, mono: true, color: '--sg-muted', w: 'fill', lineHeight: 18 }),
      ),
    )
  }
  return t
}

function panel(name: string, modeName: string): FrameNode {
  return frame(
    { name, dir: 'v', gap: 24, pad: 32, fill: '--sg-bg', stroke: '--sg-border', radius: 16, strokeInLayout: false },
    frame(
      { name: 'Panel head', gap: 8, align: 'center' },
      rect('Dot', 8, 8, name === 'Dark' ? '--sg-fg' : '--sg-border', 999),
      text(modeName, { size: 12, weight: 'semibold', color: '--sg-muted', name: 'Mode' }),
    ),
  )
}

/**
 * A documentation card: an info column (title, summary, usage, props,
 * source) beside the component panels. Returns the stage of the Light panel;
 * append content to it. finishCards() adds the Dark panel, a mirror of the
 * stage, once every card is built.
 */
export function section(title: string, source: string, note?: string, doc: DocInfo = {}): FrameNode {
  const summary = doc.summary ?? note
  const info = frame(
    { name: 'About', dir: 'v', gap: 20, w: 340 },
    text(title, { size: 26, weight: 'semibold', name: 'Title', letterSpacing: -0.3 }),
    summary ? text(summary, { size: 14, lineHeight: 22, color: '--sg-muted', w: 'fill', name: 'Summary' }) : null,
    doc.summary && note ? text(note, { size: 13, lineHeight: 20, color: '--sg-muted', w: 'fill', name: 'Note' }) : null,
    doc.usage ? frame({ name: 'Usage', dir: 'v', gap: 8, w: 'fill' }, label('Usage'), codeBlock(doc.usage)) : null,
    doc.props?.length ? frame({ name: 'Props block', dir: 'v', gap: 8, w: 'fill' }, label('Props'), propsTable(doc.props)) : null,
    frame(
      { name: 'Source block', dir: 'v', gap: 6, w: 'fill' },
      label('Source'),
      text(source, { size: 11.5, mono: true, color: '--sg-muted', w: 'fill', lineHeight: 17 }),
    ),
  )
  const stage = frame({ name: 'Stage', dir: 'v', gap: 40 })
  const dark = doc.dark !== false
  let light: FrameNode | null = null
  let bodyChild: FrameNode = stage
  if (dark) {
    light = panel('Light', LIGHT.name)
    put(light, stage)
    setMode(light, LIGHT.id)
    bodyChild = light
  }
  const body = frame({ name: 'Body', dir: 'v', gap: 24 }, bodyChild)
  const card = frame({ name: title, gap: 72, pad: 56, fill: '--sg-bg', stroke: '--sg-border', radius: 20, strokeInLayout: false }, info, body)
  cards.push({ card, body, stage, light, dark })
  cardByStage.set(stage.id, card)
  return stage
}

/** A labelled example inside a stage. */
export function example(name: string, ...children: SceneNode[]): FrameNode {
  return frame({ name, dir: 'v', gap: 12 }, label(name), ...children)
}

/** A category heading between cards (Actions, Inputs, ...). */
export function heading(title: string, blurb: string): FrameNode {
  return frame(
    { name: `Category: ${title}`, dir: 'v', gap: 10, pad: [40, 0, 8, 0] },
    text(title, { size: 34, weight: 'semibold', letterSpacing: -0.6, name: 'Title' }),
    text(blurb, { size: 16, lineHeight: 25, color: '--sg-muted', w: 760, name: 'Blurb' }),
  )
}

/** Shown on a page whose build threw, so a failure is visible in the file. */
export function errorCard(page: string, message: string): FrameNode {
  return frame(
    { name: 'Build error', dir: 'v', gap: 10, pad: 40, w: 900, fill: '--sg-bg', stroke: '--sg-danger', strokeWeight: 2, radius: 16, strokeInLayout: false },
    text(`The ${page} page did not finish building`, { size: 22, weight: 'semibold', color: '--sg-danger' }),
    text(message, { size: 14, lineHeight: 22, mono: true, w: 'fill' }),
    text('Send this message to whoever maintains tools/figma. The other pages are unaffected.', { size: 13, color: '--sg-muted' }),
  )
}

/**
 * Lay a component set out as a labelled matrix: one row per combination of
 * `rows` properties, one column per combination of `cols`. Replaces Figma's
 * auto-wrapped dump with the layout design-system files use, so each variant
 * reads off its row and column.
 */
export function matrix(set: ComponentSetNode, rows: string[], cols: string[]): FrameNode {
  const comps = set.children as ComponentNode[]
  const keyOf = (c: ComponentNode, props: string[]) => props.map((p) => c.variantProperties?.[p] ?? '').join(' / ')
  const uniq = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i)
  const rowKeys = uniq(comps.map((c) => keyOf(c, rows)))
  const colKeys = uniq(comps.map((c) => keyOf(c, cols)))
  const mk = (k: string) => text(k, { size: 11, weight: 'medium', color: '--sg-muted' })
  const colLabels = cols.length ? colKeys.map(mk) : []
  // A column is as wide as its widest variant or its label, whichever is wider.
  const colW = colKeys.map((k, j) => Math.max(...comps.filter((c) => keyOf(c, cols) === k).map((c) => c.width), colLabels[j]?.width ?? 0))
  const rowH = rowKeys.map((k) => Math.max(...comps.filter((c) => keyOf(c, rows) === k).map((c) => c.height)))
  const GX = 32
  const GY = 24
  const P = 28
  const colX = colW.map((_, j) => P + colW.slice(0, j).reduce((a, b) => a + b, 0) + GX * j)
  const rowY = rowH.map((_, i) => P + rowH.slice(0, i).reduce((a, b) => a + b, 0) + GY * i)

  set.layoutMode = 'NONE'
  for (const c of comps) {
    c.x = colX[colKeys.indexOf(keyOf(c, cols))]!
    c.y = rowY[rowKeys.indexOf(keyOf(c, rows))]!
  }
  const setW = colX[colX.length - 1]! + colW[colW.length - 1]! + P
  const setH = rowY[rowY.length - 1]! + rowH[rowH.length - 1]! + P
  set.resizeWithoutConstraints(setW, setH)

  const rowLabels = rows.length ? rowKeys.map(mk) : []
  const left = rowLabels.length ? Math.max(...rowLabels.map((t) => t.width)) + 20 : 0
  const top = colLabels.length ? 26 : 0

  const parent = set.parent as FrameNode
  const index = parent.children.findIndex((c) => c.id === set.id)
  const wrap = frame({ name: set.name, dir: 'none', w: left + setW, h: top + setH })
  parent.insertChild(Math.max(index, 0), wrap)
  absolute(wrap, set, left, top)
  colLabels.forEach((t, j) => absolute(wrap, t, left + colX[j]!, 0))
  rowLabels.forEach((t, i) => absolute(wrap, t, 0, top + rowY[i]! + rowH[i]! / 2 - t.height / 2))
  return wrap
}

// ------------------------------------------------------------ dark copies

function containsMain(n: SceneNode): boolean {
  if (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') return true
  if (n.type === 'INSTANCE' || !('children' in n)) return false
  return n.children.some(containsMain)
}

/**
 * A copy of a stage child that holds no main components: components become
 * instances (a set becomes its variants as instances, at the same positions),
 * everything else is cloned. The copy can then be themed without touching
 * the components themselves.
 */
export function mirror(n: SceneNode): SceneNode {
  if (n.type === 'COMPONENT') return n.createInstance()
  if (n.type === 'COMPONENT_SET') {
    const f = frame({ name: n.name, dir: 'none', w: n.width, h: n.height })
    for (const c of n.children as ComponentNode[]) {
      const i = c.createInstance()
      f.appendChild(i)
      i.x = c.x
      i.y = c.y
    }
    return f
  }
  if (!containsMain(n)) return n.clone()
  const src = n as FrameNode
  const copy = src.clone()
  const kids = src.children
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i]!
    if (!containsMain(child)) continue
    const old = copy.children[i]!
    const m = mirror(child)
    copy.insertChild(i, m)
    if (copy.layoutMode === 'NONE' || ('layoutPositioning' in child && child.layoutPositioning === 'ABSOLUTE')) {
      if (copy.layoutMode !== 'NONE') (m as FrameNode).layoutPositioning = 'ABSOLUTE'
      m.x = child.x
      m.y = child.y
    }
    old.remove()
  }
  return copy
}

/**
 * Add the Dark panel to every card that asked for one: a mirror of the Light
 * stage, themed with the dark mode (or its fallback collection on a plan
 * that refused the mode). Run once all cards are built.
 */
export function finishCards(): void {
  const showDark = !!DARK && canTheme(DARK.id)
  for (const c of cards.splice(0)) {
    if (!c.dark || !showDark || !c.light) continue
    const dark = panel('Dark', DARK!.name)
    const stage = frame({ name: 'Stage', dir: 'v', gap: 40 })
    put(dark, stage)
    put(c.body, dark)
    // One card's dark copy failing must not take the page with it: the panel
    // says what went wrong and the build carries on.
    try {
      for (const child of [...c.stage.children]) put(stage, mirror(child))
      themeAs(dark, DARK!.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      cardErrors.push(`${c.card.name} (dark copy): ${msg}`)
      put(stage, text(`Dark copy failed: ${msg}`, { size: 13, color: '--sg-danger', w: 600 }))
    }
  }
}

/** Dark-copy failures, reported in the plugin's closing message. */
export const cardErrors: string[] = []

/** The title block at the top of a page. */
export function pageHeader(title: string, body: string): FrameNode {
  return frame(
    { name: 'Page header', dir: 'v', gap: 14, pad: [8, 0, 32, 0] },
    text(title, { size: 64, weight: 'semibold', letterSpacing: -1.6, name: 'Title' }),
    text(body, { size: 19, lineHeight: 30, color: '--sg-muted', w: 820, name: 'Body' }),
  )
}

/**
 * Stack a page's frames one below another in a single vertical auto-layout
 * column, so Figma does the stacking. Every card is then stretched to the
 * widest one, which gives the page one clean edge. `above` stays top-level
 * over the column (the cover, which must be top-level to be the thumbnail).
 */
export function layoutPage(page: PageNode, nodes: SceneNode[], opts: { gap?: number; above?: FrameNode } = {}): FrameNode {
  const gap = opts.gap ?? 64
  const column = frame({ name: page.name, dir: 'v', gap })
  if (column.parent?.id !== page.id) page.appendChild(column)
  for (const n of nodes) put(column, cardOf(n))

  const width = Math.max(...column.children.map((c) => c.width))
  column.resize(width, Math.max(column.height, 1))
  column.layoutSizingHorizontal = 'FIXED'
  column.layoutSizingVertical = 'HUG'
  for (const c of column.children) (c as FrameNode).layoutSizingHorizontal = 'FILL'
  // Inside each card: body, panels and stages fill the card's new width.
  for (const c of column.children) {
    if (c.type !== 'FRAME') continue
    const body = c.findChild((n) => n.type === 'FRAME' && n.name === 'Body') as FrameNode | null
    if (!body) continue
    body.layoutSizingHorizontal = 'FILL'
    for (const p of body.children) (p as FrameNode).layoutSizingHorizontal = 'FILL'
  }

  let y = 0
  if (opts.above) {
    if (opts.above.parent?.id !== page.id) page.appendChild(opts.above)
    opts.above.x = 0
    opts.above.y = 0
    y = opts.above.height + 160
  }
  column.x = 0
  column.y = y
  // A quiet stone canvas so the white cards read as cards.
  page.backgrounds = [{ type: 'SOLID', color: { r: 0xf5 / 255, g: 0xf5 / 255, b: 0xf4 / 255 } }]
  return column
}

/** Pin a frame to a theme mode and say so in its name. */
export function themed<T extends FrameNode>(node: T, modeId: string, label: string): T {
  if (setMode(node, modeId)) node.name = `${node.name} (${label})`
  return node
}

// ---------------------------------------------------------------- styles

/** Shadows exactly as the CSS writes them (literals unless noted). */
export const EFFECTS: Record<string, { shadows: Shadow[]; description: string }> = {
  Popup: {
    shadows: [{ x: 0, y: 16, blur: 48, spread: -12, color: 'rgba(15, 23, 42, 0.35)' }],
    description: 'Dropdown, menu, popover and date panel. SvDropDownList.svelte:329, SvMenu.svelte:122, SvPopover.svelte:182, SvDateTimePicker.svelte:297.',
  },
  Submenu: {
    shadows: [{ x: 0, y: 16, blur: 40, spread: -12, color: 'rgba(15, 23, 42, 0.32)' }],
    description: 'Menu flyout. SvMenuList.svelte:144.',
  },
  Dialog: {
    shadows: [{ x: 0, y: 24, blur: 64, spread: -16, color: 'rgba(15, 23, 42, 0.5)' }],
    description: 'Modal and drawer. SvModal.svelte:199, SvDrawer.svelte:193.',
  },
  Tooltip: {
    shadows: [{ x: 0, y: 6, blur: 20, spread: -6, color: 'rgba(15, 23, 42, 0.5)' }],
    description: 'SvTooltip.svelte:148.',
  },
  'Grid menu': {
    shadows: [{ x: 0, y: 12, blur: 28, spread: 0, color: 'rgba(15, 23, 42, 0.18)' }],
    description: 'Grid column, filter and context menus. SvGrid.css:2325.',
  },
  'Pinned column': {
    shadows: [{ x: 8, y: 0, blur: 12, spread: -6, color: '--sg-pinned-shadow-color' }],
    description: 'Shadow a left-pinned column casts into the scroll area. Color is the pinned/shadow variable. SvGrid.css:557-559.',
  },
  'Switch thumb': {
    shadows: [{ x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(0, 0, 0, 0.3)' }],
    description: 'SvSwitchButton.svelte:92-97.',
  },
  Segment: {
    shadows: [{ x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(15, 23, 42, 0.12)' }],
    description: 'Selected segment. SvSegmented.svelte:105-108.',
  },
  'Slider thumb': {
    shadows: [{ x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(0, 0, 0, 0.25)' }],
    description: 'SvSlider.svelte:184-190.',
  },
  Toast: {
    shadows: [{ x: 0, y: 12, blur: 32, spread: -12, color: 'rgba(15, 23, 42, 0.4)' }],
    description: 'SvToaster.svelte:120-131.',
  },
  'Card hover': {
    shadows: [{ x: 0, y: 10, blur: 30, spread: -12, color: 'rgba(15, 23, 42, 0.28)' }],
    description: 'Hoverable card. SvCard.svelte:56-60.',
  },
  'Find bar': {
    shadows: [{ x: 0, y: 10, blur: 25, spread: 0, color: 'rgba(15, 23, 42, 0.18)' }],
    description: 'Find in grid. SvGrid.css:2921-2974.',
  },
  'Tool panel': {
    shadows: [{ x: -8, y: 0, blur: 24, spread: 0, color: 'rgba(0, 0, 0, 0.12)' }],
    description: 'Columns and filters panel. SvGrid.css:189-205.',
  },
  'Grid tooltip': {
    shadows: [{ x: 0, y: 8, blur: 24, spread: 0, color: 'rgba(15, 23, 42, 0.28)' }],
    description: 'Cell tooltip. SvGrid.css:2844-2859.',
  },
  'Selection bar': {
    shadows: [
      { x: 0, y: 8, blur: 28, spread: 0, color: 'rgba(15, 23, 42, 0.2)' },
      { x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(15, 23, 42, 0.1)' },
    ],
    description: 'Enterprise selection bar. SvGridSelectionBar.svelte:272.',
  },
  'Pill tab': {
    shadows: [{ x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(0, 0, 0, 0.08)' }],
    description: 'Active tab in the pill variant. SvTabs.svelte:224-225.',
  },
}

/**
 * Text styles for the type the kit uses. Inter stands in for the system font
 * stack; CSS weights 550/650/750 round to Inter Medium/Semi Bold/Bold.
 * Grid body and header text inherit the host page's size (SvGrid.css:401-415);
 * 13px matches the grid's own chrome (pager, menus, filter inputs).
 */
export const TYPE: Record<string, TypeDef> = {
  'Grid/Cell': { size: 13, weight: 'regular', description: 'Body cells. The grid inherits the host font size; 13px matches its chrome.' },
  'Grid/Header': { size: 13, weight: 'medium', description: 'Header labels. Weight is --sg-header-weight (Ember 500, default 600).' },
  'Grid/Header pinned': { size: 13, weight: 'semibold', description: 'Pinned header labels (font-weight 600, SvGrid.css:570-574).' },
  'Grid/Meta': { size: 12, weight: 'regular', description: 'Group row count and aggregate labels.' },
  'Control/sm': { size: 12, weight: 'regular', description: 'Inputs and selects, size sm.' },
  'Control/md': { size: 13, weight: 'regular', description: 'Inputs and selects, size md. Menu items.' },
  'Control/lg': { size: 15, weight: 'regular', description: 'Inputs and selects, size lg.' },
  'Button/sm': { size: 12, weight: 'semibold', lineHeight: 12, description: 'SvButton sm: 12px/600, line-height 1.' },
  'Button/md': { size: 13, weight: 'semibold', lineHeight: 13, description: 'SvButton md: 13px/600, line-height 1.' },
  'Button/lg': { size: 15, weight: 'semibold', lineHeight: 15, description: 'SvButton lg: 15px/600, line-height 1.' },
  'Field/Label': { size: 12.5, weight: 'medium', lineHeight: 16, description: 'SvField label: 12.5px/550, line-height 1.3.' },
  'Field/Hint': { size: 11.5, weight: 'regular', lineHeight: 15.5, description: 'SvField hint: 11.5px, line-height 1.35.' },
  'Field/Error': { size: 11.5, weight: 'medium', lineHeight: 15.5, description: 'SvField error: 11.5px/500, line-height 1.35.' },
  'Dialog/Title': { size: 15, weight: 'semibold', description: 'Modal and drawer title: 15px/650.' },
  'Dialog/Body': { size: 13.5, weight: 'regular', lineHeight: 21.6, description: 'Modal and drawer body: 13.5px, line-height 1.6.' },
  Tooltip: { size: 12, weight: 'medium', lineHeight: 16.8, description: 'SvTooltip: 12px/500, line-height 1.4.' },
  Tab: { size: 13, weight: 'semibold', description: 'SvTabs tab: 13px/600.' },
  Overline: { size: 11, weight: 'bold', letterSpacing: 0.44, upper: true, description: 'Date picker DATE/TIME tabs: 11px/700, 0.04em, uppercase.' },
}
