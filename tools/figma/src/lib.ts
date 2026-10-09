/// <reference types="@figma/plugin-typings" />
/**
 * Figma-side helpers shared by every page the kit builds: variables, fonts,
 * bound paints, auto-layout frames, text and icons.
 *
 * Every color in the kit is a paint bound to a variable named after its
 * `--sg-*` token (code syntax set to `var(--sg-...)`), so Dev Mode shows the
 * CSS token and switching a frame's variable mode re-themes it the way
 * swapping the theme stylesheet re-themes the grid.
 */

export type Mode = { id: string; name: string }
export type TokenDef = { token: string; name: string; description?: string; code?: string; values: Record<string, string | number> }
export type Kit = {
  modes: Mode[]
  colors: TokenDef[]
  numbers: TokenDef[]
  density: { name: string; modes: Mode[]; variables: TokenDef[] }
  builtFrom: string[]
  commit: string
  builtAt: string
  gridVersion: string
}

declare const __SG_KIT__: Kit
export const KIT: Kit = __SG_KIT__

export const COLLECTION_NAME = 'SvGrid'

// ---------------------------------------------------------------- colors

export function parseColor(input: string): RGBA {
  const s = input.trim().toLowerCase()
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  let m = /^#([0-9a-f]{3,8})$/.exec(s)
  if (m) {
    let h = m[1]!
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 }
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s)
  if (m) {
    const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { r: +m[1]! / 255, g: +m[2]! / 255, b: +m[3]! / 255, a: alpha }
  }
  throw new Error(`Cannot parse color "${input}"`)
}

// ------------------------------------------------------------- variables

/** Token -> variable in the main collections (SvGrid, SvGrid density). */
const vars = new Map<string, Variable>()
/** Variable id -> token, for re-pointing paints at a fallback collection. */
const tokenOfVar = new Map<string, string>()
/** Kit mode id -> (token -> variable) for themes that live in a fallback collection. */
const fallbackVars = new Map<string, Map<string, Variable>>()
const collections = new Map<string, VariableCollection>()
/** Kit mode id (e.g. `ember-light`) -> Figma mode id, per collection. Modes the plan refused are absent. */
export const modeIds: Record<string, Record<string, string>> = {}
export const skippedModes: string[] = []
/** Themes the plan refused as modes, rebuilt as one-mode collections. */
export const fallbackThemes: string[] = []

export function getCollection(name = COLLECTION_NAME): VariableCollection {
  const c = collections.get(name)
  if (!c) throw new Error(`setupVariables() has not created "${name}"`)
  return c
}

export function v(token: string): Variable {
  const found = vars.get(token)
  if (!found) throw new Error(`No variable for ${token}`)
  return found
}

function scopesFor(def: TokenDef, type: 'COLOR' | 'FLOAT'): VariableScope[] {
  if (type === 'COLOR') return ['ALL_SCOPES']
  if (def.token.includes('radius')) return ['CORNER_RADIUS']
  if (def.token.includes('weight')) return ['FONT_WEIGHT']
  if (def.token.includes('cell-px')) return ['GAP']
  return ['WIDTH_HEIGHT']
}

type Def = { def: TokenDef; type: 'COLOR' | 'FLOAT' }

/**
 * Create a collection, or update it in place on a re-run. Updating by name
 * keeps existing bindings (and instances in files that use the kit) pointing
 * at the same variables. Returns token -> variable.
 */
async function upsertCollection(name: string, modes: Mode[], defs: Def[]): Promise<Map<string, Variable>> {
  const existing = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === name)
  const col = existing ?? figma.variables.createVariableCollection(name)
  collections.set(name, col)
  const ids: Record<string, string> = (modeIds[name] = {})

  modes.forEach((mode, i) => {
    const have = col.modes.find((m) => m.name === mode.name)
    if (have) {
      ids[mode.id] = have.modeId
      return
    }
    if (i === 0 && !existing) {
      col.renameMode(col.modes[0]!.modeId, mode.name)
      ids[mode.id] = col.modes[0]!.modeId
      return
    }
    try {
      ids[mode.id] = col.addMode(mode.name)
    } catch {
      // Figma's Starter plan allows one mode per collection.
      skippedModes.push(`${name}: ${mode.name}`)
    }
  })

  const out = new Map<string, Variable>()
  const local = (await figma.variables.getLocalVariablesAsync()).filter((x) => x.variableCollectionId === col.id)
  for (const { def, type } of defs) {
    let variable = local.find((x) => x.name === def.name)
    if (variable && variable.resolvedType !== type) {
      variable.remove()
      variable = undefined
    }
    variable = variable ?? figma.variables.createVariable(def.name, col, type)
    variable.description = def.description ?? ''
    variable.setVariableCodeSyntax('WEB', def.code ?? `var(${def.token})`)
    variable.scopes = scopesFor(def, type)
    for (const [kitMode, value] of Object.entries(def.values)) {
      const id = ids[kitMode]
      if (!id) continue
      variable.setValueForMode(id, type === 'COLOR' ? parseColor(String(value)) : Number(value))
    }
    out.set(def.token, variable)
  }
  return out
}

const themeDefs = (): Def[] => [
  ...KIT.colors.map((def) => ({ def, type: 'COLOR' as const })),
  ...KIT.numbers.map((def) => ({ def, type: 'FLOAT' as const })),
]

export async function setupVariables(): Promise<void> {
  const main = await upsertCollection(COLLECTION_NAME, KIT.modes, themeDefs())
  const density = await upsertCollection(
    KIT.density.name,
    KIT.density.modes,
    KIT.density.variables.map((def) => ({ def, type: 'FLOAT' as const })),
  )
  for (const [token, variable] of [...main, ...density]) {
    vars.set(token, variable)
    tokenOfVar.set(variable.id, token)
  }

  // Themes the plan refused as modes get a one-mode collection each, so dark
  // copies can still bind to variables (see themeAs). On a plan with enough
  // modes nothing here runs.
  for (const mode of KIT.modes) {
    if (modeIds[COLLECTION_NAME]?.[mode.id]) continue
    try {
      const defs = themeDefs().map(({ def, type }) => ({ def: { ...def, values: { [mode.id]: def.values[mode.id]! } }, type }))
      fallbackVars.set(mode.id, await upsertCollection(`${COLLECTION_NAME} / ${mode.name}`, [mode], defs))
      fallbackThemes.push(mode.name)
    } catch {
      // A plan that also refuses extra collections: the theme is left out.
    }
  }
}

/** Pin a frame to one mode of a collection (e.g. render a copy in Ember Dark). */
export function setMode(node: FrameNode | ComponentNode | InstanceNode, kitModeId: string, collection = COLLECTION_NAME): boolean {
  const id = modeIds[collection]?.[kitModeId]
  if (!id) return false
  node.setExplicitVariableModeForCollection(getCollection(collection), id)
  return true
}

/** Whether a theme mode can be shown, as a mode or through a fallback collection. */
export function canTheme(kitModeId: string): boolean {
  return !!modeIds[COLLECTION_NAME]?.[kitModeId] || fallbackVars.has(kitModeId)
}

/**
 * Render a subtree in a theme. With the mode available this pins the mode;
 * otherwise every bound paint under the node is re-pointed at the same token
 * in the theme's fallback collection (an override on instance layers). The
 * paint keeps its opacity, which Figma resets when a variable is bound.
 */
export function themeAs(node: FrameNode | InstanceNode, kitModeId: string): boolean {
  if (setMode(node, kitModeId)) return true
  const map = fallbackVars.get(kitModeId)
  if (!map) return false
  const swap = <P extends Paint>(p: P): P => {
    if (p.type !== 'SOLID' || !p.boundVariables?.color) return p
    const token = tokenOfVar.get(p.boundVariables.color.id)
    const target = token ? map.get(token) : undefined
    if (!target) return p
    const bound = figma.variables.setBoundVariableForPaint(p as SolidPaint, 'color', target)
    return { ...bound, opacity: p.opacity ?? 1 } as P
  }
  const walk = (n: SceneNode) => {
    if ('fills' in n && n.fills !== figma.mixed && (n.fills as Paint[]).length) n.fills = (n.fills as Paint[]).map(swap)
    if ('strokes' in n && n.strokes.length) n.strokes = n.strokes.map(swap)
    if ('children' in n) n.children.forEach(walk)
  }
  walk(node)
  return true
}

/** Bind a numeric field (height, padding, radius...) to a FLOAT variable. */
export function bindNum(node: SceneNode, field: VariableBindableNodeField, token: string): void {
  node.setBoundVariable(field, v(token))
}

/**
 * A solid paint bound to the token's variable. `opacity` is the paint's own
 * opacity, which Figma multiplies with the variable's alpha: that is exactly
 * `color-mix(in srgb, var(--token) N%, transparent)`. A `#hex` or `rgba()`
 * value gives an unbound paint, for the few colors the CSS hard-codes.
 */
export function paint(token: string, opacity = 1): SolidPaint {
  if (!token.startsWith('--')) {
    const c = parseColor(token)
    return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a * opacity }
  }
  const base: SolidPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 } }
  if (opacity === 1) return figma.variables.setBoundVariableForPaint(base, 'color', v(token))
  // Figma drops a paint's own opacity once a variable is bound (soft badges
  // came out solid twice), so translucent colors are variables of their own,
  // with the alpha in the value: alpha/<token>-<pct> in tokens.mjs.
  const key = `${token}@${Math.round(opacity * 100)}`
  if (!vars.has(key)) throw new Error(`No alpha variable for ${token} at ${Math.round(opacity * 100)}%: add it to ALPHA in tools/figma/tokens.mjs`)
  return figma.variables.setBoundVariableForPaint(base, 'color', v(key))
}

/** A token, optionally at an opacity: `'--sg-accent'` or `['--sg-accent', 0.22]`. */
export type Ink = string | [string, number]
const toPaint = (ink: Ink) => (typeof ink === 'string' ? paint(ink) : paint(ink[0], ink[1]))

export function setFill(node: MinimalFillsMixin, ink: Ink | null): void {
  node.fills = ink ? [toPaint(ink)] : []
}

export type Sides = { top?: number; right?: number; bottom?: number; left?: number }

export function setStroke(
  node: FrameNode | ComponentNode | RectangleNode | InstanceNode,
  ink: Ink,
  weight: number | Sides = 1,
  align: 'INSIDE' | 'OUTSIDE' | 'CENTER' = 'INSIDE',
): void {
  node.strokes = [toPaint(ink)]
  node.strokeAlign = align
  if (typeof weight === 'number') {
    node.strokeWeight = weight
  } else {
    node.strokeTopWeight = weight.top ?? 0
    node.strokeRightWeight = weight.right ?? 0
    node.strokeBottomWeight = weight.bottom ?? 0
    node.strokeLeftWeight = weight.left ?? 0
  }
}

export function setRadius(node: CornerMixin & SceneNodeMixin, r: number | string): void {
  if (typeof r === 'number') {
    node.cornerRadius = r
    return
  }
  for (const corner of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as const) {
    node.setBoundVariable(corner, v(r))
  }
}

// ----------------------------------------------------------------- fonts

export type Weight = 'regular' | 'medium' | 'semibold' | 'bold'
export const FONT_FAMILY = 'Inter'
const fonts: Partial<Record<Weight, FontName>> = {}
const monoFonts: Partial<Record<'regular', FontName>> = {}

/**
 * The grid's font stack is `ui-sans-serif, system-ui, ...`, which Figma cannot
 * resolve. Inter stands in: it ships with Figma and has the same metrics
 * class. Style names vary between Inter builds ("Semi Bold" vs "SemiBold"),
 * so they are looked up instead of hard-coded.
 */
export async function loadFonts(): Promise<void> {
  const all = await figma.listAvailableFontsAsync()
  const styles = (family: string) => all.filter((f) => f.fontName.family === family).map((f) => f.fontName.style)
  const inter = styles(FONT_FAMILY)
  if (inter.length === 0) throw new Error('The Inter font is not available in this Figma file')
  const pick = (want: string[]): FontName => {
    const style = want.find((w) => inter.includes(w)) ?? 'Regular'
    return { family: FONT_FAMILY, style }
  }
  fonts.regular = pick(['Regular'])
  fonts.medium = pick(['Medium'])
  fonts.semibold = pick(['Semi Bold', 'SemiBold'])
  fonts.bold = pick(['Bold'])
  const mono = styles('Roboto Mono')
  monoFonts.regular = mono.includes('Regular') ? { family: 'Roboto Mono', style: 'Regular' } : fonts.regular
  await Promise.all([...Object.values(fonts), ...Object.values(monoFonts)].map((f) => figma.loadFontAsync(f!)))
}

export function font(weight: Weight): FontName {
  const f = fonts[weight]
  if (!f) throw new Error('loadFonts() has not run')
  return f
}

/** CSS numeric weight -> kit weight. */
export function cssWeight(w: number | string): Weight {
  const n = Number(w)
  if (n >= 700) return 'bold'
  if (n >= 600) return 'semibold'
  if (n >= 500) return 'medium'
  return 'regular'
}

// ---------------------------------------------------------------- layout

type Size = number | 'hug' | 'fill'
export type Pad = number | [number, number] | [number, number, number, number]

export type FrameOpts = {
  name: string
  /** Auto-layout direction. `none` gives a plain frame with absolute children. */
  dir?: 'h' | 'v' | 'none'
  gap?: number
  pad?: Pad
  /** Counter-axis alignment of children. */
  align?: 'start' | 'center' | 'end' | 'baseline'
  /** Primary-axis distribution. */
  justify?: 'start' | 'center' | 'end' | 'between'
  w?: Size
  h?: Size
  fill?: Ink | null
  stroke?: Ink
  strokeWeight?: number | Sides
  /** CSS box model: a border takes space. Default true when there is a stroke. */
  strokeInLayout?: boolean
  radius?: number | string
  clip?: boolean
  wrap?: boolean
  opacity?: number
}

/** Sizing to apply once a node lands in its parent (FILL needs an auto-layout parent). */
const pending = new WeakMap<SceneNode, { w?: Size; h?: Size }>()

export function sizing(node: SceneNode, w?: Size, h?: Size): SceneNode {
  pending.set(node, { w, h })
  return node
}

function applyPending(node: SceneNode): void {
  const p = pending.get(node)
  if (!p) return
  const n = node as FrameNode
  if (p.w === 'fill') n.layoutSizingHorizontal = 'FILL'
  if (p.h === 'fill') n.layoutSizingVertical = 'FILL'
  if (node.type === 'TEXT' && p.w === 'fill') node.textAutoResize = 'HEIGHT'
  pending.delete(node)
}

/** Append children to a parent, then apply any deferred FILL sizing. */
export function put<T extends BaseNode & ChildrenMixin>(parent: T, ...children: (SceneNode | null | undefined | false)[]): T {
  for (const c of children) {
    if (!c) continue
    parent.appendChild(c)
    applyPending(c)
  }
  return parent
}

function applyPad(f: FrameNode | ComponentNode, pad: Pad | undefined) {
  if (pad === undefined) return
  const [t, r, b, l] = typeof pad === 'number' ? [pad, pad, pad, pad] : pad.length === 2 ? [pad[0], pad[1], pad[0], pad[1]] : pad
  f.paddingTop = t
  f.paddingRight = r
  f.paddingBottom = b
  f.paddingLeft = l
}

function configure<T extends FrameNode | ComponentNode>(f: T, o: FrameOpts, children: (SceneNode | null | undefined | false)[]): T {
  f.name = o.name
  f.fills = []
  const dir = o.dir ?? 'h'
  if (dir !== 'none') {
    f.layoutMode = dir === 'h' ? 'HORIZONTAL' : 'VERTICAL'
    f.itemSpacing = o.gap ?? 0
    applyPad(f, o.pad)
    f.counterAxisAlignItems =
      o.align === 'center' ? 'CENTER' : o.align === 'end' ? 'MAX' : o.align === 'baseline' ? 'BASELINE' : 'MIN'
    f.primaryAxisAlignItems =
      o.justify === 'center' ? 'CENTER' : o.justify === 'end' ? 'MAX' : o.justify === 'between' ? 'SPACE_BETWEEN' : 'MIN'
    if (o.wrap) {
      f.layoutWrap = 'WRAP'
      // Rows of a wrapping frame get the same spacing as items in a row.
      f.counterAxisSpacing = o.gap ?? 0
    }
  }
  if (o.fill) setFill(f, o.fill)
  if (o.stroke) {
    setStroke(f, o.stroke, o.strokeWeight ?? 1)
    if (dir !== 'none') f.strokesIncludedInLayout = o.strokeInLayout ?? true
  }
  if (o.radius !== undefined) setRadius(f, o.radius)
  f.clipsContent = o.clip ?? false
  if (o.opacity !== undefined) f.opacity = o.opacity

  put(f, ...children)

  // Fixed sizes first (resize), then hug; fill waits for the parent.
  const w = o.w ?? 'hug'
  const h = o.h ?? 'hug'
  if (typeof w === 'number' || typeof h === 'number') {
    f.resize(typeof w === 'number' ? w : Math.max(f.width, 1), typeof h === 'number' ? h : Math.max(f.height, 1))
  }
  if (dir !== 'none') {
    f.layoutSizingHorizontal = typeof w === 'number' ? 'FIXED' : 'HUG'
    f.layoutSizingVertical = typeof h === 'number' ? 'FIXED' : 'HUG'
  }
  if (w === 'fill' || h === 'fill') sizing(f, w, h)
  return f
}

export function frame(o: FrameOpts, ...children: (SceneNode | null | undefined | false)[]): FrameNode {
  return configure(figma.createFrame(), o, children)
}

export function component(o: FrameOpts & { description?: string }, ...children: (SceneNode | null | undefined | false)[]): ComponentNode {
  const c = configure(figma.createComponent(), o, children)
  if (o.description) c.description = o.description
  return c
}

/** A plain rectangle (dividers, bars, swatches). */
export function rect(name: string, w: number, h: number, fillToken: Ink | null, radius?: number | string): RectangleNode {
  const r = figma.createRectangle()
  r.name = name
  r.resize(w, h)
  setFill(r, fillToken)
  if (radius !== undefined) setRadius(r, radius)
  return r
}

// ------------------------------------------------------------------ text

export type TextOpts = {
  name?: string
  size?: number
  weight?: Weight
  color?: Ink
  lineHeight?: number
  align?: 'LEFT' | 'CENTER' | 'RIGHT'
  letterSpacing?: number
  upper?: boolean
  mono?: boolean
  w?: number | 'fill'
  truncate?: boolean
  /** Opacity 0..1 (for placeholder-like text drawn with a mixed color). */
  opacity?: number
  strike?: boolean
  /** Character ranges to set in another weight, e.g. the numbers in "1 to 10 of 500". */
  ranges?: { start: number; end: number; weight: Weight }[]
}

export function text(chars: string, o: TextOpts = {}): TextNode {
  const t = figma.createText()
  t.name = o.name ?? chars.slice(0, 40)
  t.fontName = o.mono ? (monoFonts.regular ?? font('regular')) : font(o.weight ?? 'regular')
  t.characters = chars
  t.fontSize = o.size ?? 13
  if (o.lineHeight) t.lineHeight = { unit: 'PIXELS', value: o.lineHeight }
  if (o.letterSpacing) t.letterSpacing = { unit: 'PIXELS', value: o.letterSpacing }
  if (o.upper) t.textCase = 'UPPER'
  if (o.align) t.textAlignHorizontal = o.align
  if (o.opacity !== undefined) t.opacity = o.opacity
  if (o.strike) t.textDecoration = 'STRIKETHROUGH'
  if (!o.mono && !o.ranges) {
    linkTextStyle(t, { size: o.size ?? 13, weight: o.weight ?? 'regular', lineHeight: o.lineHeight, letterSpacing: o.letterSpacing, upper: o.upper })
  }
  for (const r of o.ranges ?? []) t.setRangeFontName(r.start, r.end, font(r.weight))
  setFill(t, o.color ?? '--sg-fg')
  t.textAutoResize = 'WIDTH_AND_HEIGHT'
  if (typeof o.w === 'number') {
    t.textAutoResize = 'HEIGHT'
    t.resize(o.w, t.height)
  } else if (o.w === 'fill') {
    sizing(t, 'fill')
  }
  if (o.truncate) {
    t.textTruncation = 'ENDING'
    t.maxLines = 1
  }
  return t
}

// ----------------------------------------------------------------- icons

/**
 * An icon from its SVG source, sized and recolored with a bound paint. Strokes
 * and fills that the SVG draws in `currentColor` (or any color) take the token;
 * `fill="none"` stays empty.
 */
export function icon(name: string, svg: string, size: number | { w: number; h: number }, token: Ink): FrameNode {
  const w = typeof size === 'number' ? size : size.w
  const h = typeof size === 'number' ? size : size.h
  const sized = svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
    const clean = attrs.replace(/\s(width|height)="[^"]*"/g, '')
    return `<svg${clean} width="${w}" height="${h}">`
  }).replace(/currentColor/g, '#000000')
  const node = figma.createNodeFromSvg(sized)
  node.name = name
  node.fills = []
  const bound = toPaint(token)
  const walk = (n: SceneNode) => {
    if ('strokes' in n && Array.isArray(n.strokes) && n.strokes.length > 0) n.strokes = [bound]
    if (n.type !== 'FRAME' && 'fills' in n && Array.isArray(n.fills) && n.fills.length > 0) n.fills = [bound]
    if ('children' in n) n.children.forEach(walk)
  }
  node.children.forEach(walk)
  return node
}

// ------------------------------------------------------------ components

/** Combine variant components into a set laid out in a wrapping grid. */
export function variantSet(name: string, parent: BaseNode & ChildrenMixin, comps: ComponentNode[], opts: { columns?: number; gap?: number; description?: string } = {}): ComponentSetNode {
  const set = figma.combineAsVariants(comps, parent)
  set.name = name
  set.layoutMode = 'HORIZONTAL'
  set.layoutWrap = 'WRAP'
  set.itemSpacing = opts.gap ?? 16
  set.counterAxisSpacing = opts.gap ?? 16
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24
  set.fills = []
  set.layoutSizingVertical = 'HUG'
  if (opts.columns) {
    const widest = Math.max(...comps.map((c) => c.width))
    set.resize(24 * 2 + opts.columns * widest + (opts.columns - 1) * (opts.gap ?? 16), set.height)
    set.layoutSizingHorizontal = 'FIXED'
  } else {
    set.layoutSizingHorizontal = 'HUG'
  }
  if (opts.description) set.description = opts.description
  return set
}

/**
 * Add a TEXT property to a component (or set) and bind every text layer whose
 * name matches `layer` to it. Returns the property key for setProperties().
 */
export function textProp(owner: ComponentNode | ComponentSetNode, propName: string, layer: string, defaultValue: string): string {
  const key = owner.addComponentProperty(propName, 'TEXT', defaultValue)
  const targets = owner.findAll((n) => n.type === 'TEXT' && n.name === layer) as TextNode[]
  if (targets.length === 0) throw new Error(`${owner.name}: no text layer "${layer}" for property ${propName}`)
  // Merge: a layer can carry a text and a visibility binding at once.
  for (const t of targets) t.componentPropertyReferences = { ...(t.componentPropertyReferences ?? {}), characters: key }
  return key
}

/** Add a BOOLEAN property that toggles every layer named `layer`. */
export function boolProp(owner: ComponentNode | ComponentSetNode, propName: string, layer: string, defaultValue: boolean): string {
  const key = owner.addComponentProperty(propName, 'BOOLEAN', defaultValue)
  const targets = owner.findAll((n) => n.name === layer)
  if (targets.length === 0) throw new Error(`${owner.name}: no layer "${layer}" for property ${propName}`)
  // The main component shows the default, so hidden-by-default layers start hidden.
  for (const t of targets) {
    t.visible = defaultValue
    t.componentPropertyReferences = { ...(t.componentPropertyReferences ?? {}), visible: key }
  }
  return key
}

/** Find a variant by its property values, e.g. `pick(set, { State: 'Hover' })`. */
export function pick(set: ComponentSetNode, props: Record<string, string>): ComponentNode {
  const want = Object.entries(props)
  const found = set.children.find((c) => {
    const vp = (c as ComponentNode).variantProperties ?? {}
    return want.every(([k, val]) => vp[k] === val)
  })
  if (!found) throw new Error(`${set.name}: no variant ${JSON.stringify(props)}`)
  return found as ComponentNode
}

/** Instance of a variant with text/boolean overrides keyed by property name (without the #id suffix). */
export function inst(source: ComponentNode | ComponentSetNode, variant: Record<string, string> = {}, overrides: Record<string, string | boolean> = {}): InstanceNode {
  const comp = source.type === 'COMPONENT_SET' ? pick(source, variant) : source
  const i = comp.createInstance()
  const defs = source.type === 'COMPONENT_SET' ? source.componentPropertyDefinitions : comp.componentPropertyDefinitions
  const props: Record<string, string | boolean> = {}
  for (const [name, value] of Object.entries(overrides)) {
    const key = Object.keys(defs).find((k) => k === name || k.split('#')[0] === name)
    if (!key) throw new Error(`${source.name}: no property "${name}"`)
    props[key] = value
  }
  if (Object.keys(props).length) i.setProperties(props)
  return i
}

// ---------------------------------------------------------------- rings

/**
 * An outline drawn outside a box, for CSS `outline: Wpx solid; outline-offset: Opx`
 * and `box-shadow: 0 0 0 Wpx` focus rings. It is an absolutely positioned
 * child with STRETCH constraints, so it follows the box when it resizes. Call
 * after the box has its final size.
 */
export function ring(
  box: FrameNode | ComponentNode,
  o: { width: number; offset?: number; ink: Ink; radius: number; name?: string },
): FrameNode {
  const out = (o.offset ?? 0) + o.width
  const r = figma.createFrame()
  r.name = o.name ?? 'Focus ring'
  r.fills = []
  setStroke(r, o.ink, o.width, 'INSIDE')
  r.cornerRadius = o.radius + out
  box.appendChild(r)
  if (box.layoutMode !== 'NONE') r.layoutPositioning = 'ABSOLUTE'
  r.resize(box.width + out * 2, box.height + out * 2)
  r.x = -out
  r.y = -out
  r.constraints = { horizontal: 'STRETCH', vertical: 'STRETCH' }
  box.clipsContent = false
  return r
}

/** Place a child at an absolute position inside an auto-layout parent. */
export function absolute(parent: FrameNode | ComponentNode, child: SceneNode, x: number, y: number): SceneNode {
  parent.appendChild(child)
  if (parent.layoutMode !== 'NONE') (child as FrameNode).layoutPositioning = 'ABSOLUTE'
  child.x = x
  child.y = y
  return child
}

// --------------------------------------------------------------- styles

export type Shadow = { x: number; y: number; blur: number; spread: number; color: string }

const effectStyles = new Map<string, EffectStyle>()
const textStyles = new Map<string, TextStyle>()
const styleLinks: Promise<void>[] = []

const shadowEffect = (s: Shadow): DropShadowEffect => {
  const token = s.color.startsWith('--')
  const c = token ? { r: 0, g: 0, b: 0, a: 0.2 } : parseColor(s.color)
  const effect: DropShadowEffect = {
    type: 'DROP_SHADOW',
    color: c,
    offset: { x: s.x, y: s.y },
    radius: s.blur,
    spread: s.spread,
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false,
  }
  return token ? (figma.variables.setBoundVariableForEffect(effect, 'color', v(s.color)) as DropShadowEffect) : effect
}

/** Create or update local effect styles. Shadows in the CSS are literals, not tokens. */
export async function setupEffectStyles(defs: Record<string, { shadows: Shadow[]; description: string }>): Promise<void> {
  const existing = await figma.getLocalEffectStylesAsync()
  for (const [name, def] of Object.entries(defs)) {
    const full = `SvGrid/${name}`
    const style = existing.find((s) => s.name === full) ?? figma.createEffectStyle()
    style.name = full
    style.description = def.description
    style.effects = def.shadows.map(shadowEffect)
    effectStyles.set(name, style)
  }
}

/** Apply a registered effect style. Linking is async under dynamic-page; flushStyleLinks() awaits it. */
export function shadow(node: BlendMixin & SceneNodeMixin, name: string): void {
  const style = effectStyles.get(name)
  if (!style) throw new Error(`No effect style "${name}"`)
  styleLinks.push((node as FrameNode).setEffectStyleIdAsync(style.id))
}

export type TypeDef = { size: number; weight: Weight; lineHeight?: number; letterSpacing?: number; upper?: boolean; description: string }
const typeKey = (size: number, weight: Weight, lineHeight?: number, letterSpacing?: number, upper?: boolean) =>
  `${size}|${weight}|${lineHeight ?? 'auto'}|${letterSpacing ?? 0}|${upper ? 'U' : ''}`
const typeByKey = new Map<string, TextStyle>()

export async function setupTextStyles(defs: Record<string, TypeDef>): Promise<void> {
  const existing = await figma.getLocalTextStylesAsync()
  for (const [name, d] of Object.entries(defs)) {
    const full = `SvGrid/${name}`
    const style = existing.find((s) => s.name === full) ?? figma.createTextStyle()
    style.name = full
    style.description = d.description
    style.fontName = font(d.weight)
    style.fontSize = d.size
    style.lineHeight = d.lineHeight ? { unit: 'PIXELS', value: d.lineHeight } : { unit: 'AUTO' }
    style.letterSpacing = { unit: 'PIXELS', value: d.letterSpacing ?? 0 }
    style.textCase = d.upper ? 'UPPER' : 'ORIGINAL'
    textStyles.set(name, style)
    typeByKey.set(typeKey(d.size, d.weight, d.lineHeight, d.letterSpacing, d.upper), style)
  }
}

/** Link a text node to the text style with identical metrics, if one exists. */
export function linkTextStyle(t: TextNode, o: { size: number; weight: Weight; lineHeight?: number; letterSpacing?: number; upper?: boolean }): void {
  const style = typeByKey.get(typeKey(o.size, o.weight, o.lineHeight, o.letterSpacing, o.upper))
  if (style) styleLinks.push(t.setTextStyleIdAsync(style.id))
}

export async function flushStyleLinks(): Promise<void> {
  await Promise.all(styleLinks.splice(0))
}

/**
 * Give an instance a fixed width. resize() writes both dimensions, which
 * replaces a variable-bound height with a plain number, so the binding is
 * restored afterwards.
 */
export function setWidth(node: InstanceNode | FrameNode, w: number, heightToken?: string): void {
  node.resize(w, node.height)
  node.layoutSizingHorizontal = 'FIXED'
  if (heightToken) node.setBoundVariable('height', v(heightToken))
}

/** The first mode's numeric value of a token (for geometry that cannot bind, like a ring's outer radius). */
export function num(token: string): number {
  const def = KIT.numbers.find((d) => d.token === token)
  if (!def) throw new Error(`No number token ${token}`)
  return Number(def.values[KIT.modes[0]!.id])
}

/** Turn an icon into a component so it can be an INSTANCE_SWAP value. */
export function iconComponent(name: string, svg: string, size: number, token: Ink): ComponentNode {
  const c = figma.createComponentFromNode(icon(name, svg, size, token))
  c.name = name
  return c
}

/**
 * Add an INSTANCE_SWAP property and point every instance layer named `layer`
 * at it. Returns the property key.
 */
export function swapProp(owner: ComponentNode | ComponentSetNode, propName: string, layer: string, defaultComponent: ComponentNode): string {
  const key = owner.addComponentProperty(propName, 'INSTANCE_SWAP', defaultComponent.id)
  const targets = owner.findAll((n) => n.type === 'INSTANCE' && n.name === layer)
  if (targets.length === 0) throw new Error(`${owner.name}: no instance layer "${layer}" for property ${propName}`)
  for (const t of targets) t.componentPropertyReferences = { ...(t.componentPropertyReferences ?? {}), mainComponent: key }
  return key
}

/** Recolor every stroke and fill under a node (an override when the node sits in an instance). */
export function recolor(node: SceneNode, token: Ink): void {
  const p = toPaint(token)
  const walk = (n: SceneNode) => {
    if ('strokes' in n && Array.isArray(n.strokes) && n.strokes.length > 0) n.strokes = [p]
    if (n.type === 'VECTOR' && n.fills !== figma.mixed && (n.fills as Paint[]).length > 0) n.fills = [p]
    if ('children' in n) n.children.forEach(walk)
  }
  walk(node)
}
