/**
 * A strict, in-memory stand-in for the Figma plugin API, so the kit plugin can
 * run (and fail) in Node. It covers only what the plugin calls, and it throws
 * where Figma throws:
 *
 *  - writing text before its font is loaded
 *  - FILL / ABSOLUTE on a child whose parent is not auto-layout
 *  - HUG on a frame that is not auto-layout
 *  - component property references that the owning component does not define
 *  - adding properties to a variant instead of its set
 *  - appending into an instance
 *  - the sync APIs that `documentAccess: "dynamic-page"` turns into errors
 *  - reading children of a page that was not loaded
 *  - duplicate or mismatched variant property sets (a warning in Figma that
 *    leaves the set broken, so it is an error here)
 *
 * renderHtml() turns the resulting document into flexbox HTML so the output
 * can be screenshotted and compared with the real grid. Auto-layout maps onto
 * flexbox closely enough for that; this is a preview, not Figma's renderer.
 */

let seq = 0
const nextId = () => `${++seq}:${seq}`

export function createFigmaMock({ maxModes = 40, maxPages = Infinity } = {}) {
  const loadedFonts = new Set()
  const fontKey = (f) => `${f.family}::${f.style}`
  const collections = []
  const variables = []
  const textStyles = []
  const effectStyles = []
  const notifications = []
  const warnings = []
  let closed = false

  // ------------------------------------------------------------ nodes

  const registry = new Map()

  class BaseNode {
    constructor(type) {
      this.id = nextId()
      registry.set(this.id, this)
      this.rotation = 0
      this.constraints = { horizontal: 'MIN', vertical: 'MIN' }
      this.type = type
      this.name = type
      this.parent = null
      this.removed = false
      this._props = {}
      this.componentPropertyReferences = null
      this.explicitVariableModes = {}
      this.boundVariables = {}
      this.visible = true
      this.opacity = 1
      this.x = 0
      this.y = 0
      this._w = 100
      this._h = 100
      this.layoutPositioning = 'AUTO'
      this._sizingH = 'FIXED'
      this._sizingV = 'FIXED'
      this.layoutGrow = 0
      this.layoutAlign = 'INHERIT'
    }
    get width() { return this._w }
    get height() { return this._h }
    // Constraints record the insets against the parent's size at that moment,
    // which is how Figma keeps a STRETCH child glued to the edges on resize.
    set constraints(c) {
      this._constraints = c
      if (this.parent && this.parent.width !== undefined) {
        this._insets = { left: this.x, top: this.y, right: this.parent.width - this.x - this.width, bottom: this.parent.height - this.y - this.height }
      }
    }
    get constraints() { return this._constraints }
    resize(w, h) {
      if (!(w >= 0.01) || !(h >= 0.01)) throw new Error(`${this.name}: resize(${w}, ${h}) below 0.01`)
      this._w = w
      this._h = h
    }
    resizeWithoutConstraints(w, h) { this.resize(w, h) }
    // Scales the node and its contents; the preview draws it with a CSS transform.
    rescale(scale) {
      if (!(scale >= 0.01)) throw new Error(`rescale(${scale})`)
      this._scale = (this._scale ?? 1) * scale
    }
    remove() {
      if (this.parent) this.parent._children.splice(this.parent._children.indexOf(this), 1)
      this.parent = null
      this.removed = true
    }
    insideInstance() {
      for (let p = this; p; p = p.parent) if (p.type === 'INSTANCE') return true
      return false
    }
    owningComponent() {
      for (let p = this.parent; p; p = p.parent) {
        if (p.type === 'COMPONENT_SET') return p
        if (p.type === 'COMPONENT') return p.parent?.type === 'COMPONENT_SET' ? p.parent : p
        if (p.type === 'INSTANCE') return p
      }
      return null
    }
    set layoutSizingHorizontal(v) { this._setSizing('H', v) }
    get layoutSizingHorizontal() { return this._sizingH }
    set layoutSizingVertical(v) { this._setSizing('V', v) }
    get layoutSizingVertical() { return this._sizingV }
    _setSizing(axis, v) {
      const parentAuto = this.parent && this.parent.layoutMode && this.parent.layoutMode !== 'NONE'
      if (v === 'FILL' && !parentAuto) {
        throw new Error(`${this.name}: FILL can only be set on children of auto-layout frames`)
      }
      if (v === 'HUG' && this.type !== 'TEXT' && !(this.layoutMode && this.layoutMode !== 'NONE')) {
        throw new Error(`${this.name}: HUG can only be set on auto-layout frames and text`)
      }
      if (axis === 'H') this._sizingH = v
      else this._sizingV = v
    }
    clone() {
      // Figma parents the duplicate next to the original.
      const c = cloneTree(this, false)
      const parent = this.parent ?? figma.currentPage
      parent._cloning = parent.insideInstance?.()
      parent.insertChild(parent._children.indexOf(this) + 1, c)
      parent._cloning = false
      return c
    }
    setBoundVariable(field, variable) {
      if (!variable || !variables.includes(variable)) throw new Error(`${this.name}: setBoundVariable(${field}) with an unknown variable`)
      const floatFields = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'cornerRadius', 'itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'width', 'height', 'minWidth', 'minHeight', 'strokeWeight', 'opacity', 'fontWeight', 'fontSize']
      if (['fontWeight', 'fontSize', 'fontFamily'].includes(field) && this.type !== 'TEXT') throw new Error(`${this.name}: ${field} binds on text only`)
      if (field === 'height' && this.type !== 'TEXT' && this._sizingV === 'HUG') throw new Error(`${this.name}: cannot bind height on a hug-height frame`)
      if (floatFields.includes(field) && variable.resolvedType !== 'FLOAT') throw new Error(`${this.name}: ${field} needs a FLOAT variable`)
      this.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: variable.id }
    }
    setExplicitVariableModeForCollection(collection, modeId) {
      if (typeof collection === 'string') throw new Error('setExplicitVariableModeForCollection(id) is not allowed with dynamic-page')
      if (!collection.modes.some((m) => m.modeId === modeId)) throw new Error(`Unknown mode ${modeId}`)
      this.explicitVariableModes[collection.id] = modeId
    }
    set componentPropertyReferences(refs) {
      if (refs) {
        const owner = this.owningComponent()
        if (!owner) throw new Error(`${this.name}: componentPropertyReferences outside a component`)
        if (owner.type === 'INSTANCE') throw new Error(`${this.name}: cannot reference properties from inside a nested instance`)
        const defs = owner.componentPropertyDefinitions
        for (const key of Object.values(refs)) {
          if (!defs[key]) throw new Error(`${this.name}: property ${key} is not defined on ${owner.name}`)
        }
      }
      this._refs = refs
    }
    get componentPropertyReferences() { return this._refs ?? null }
    get textStyleId() { return this._textStyleId ?? '' }
    set textStyleId(_v) { throw new Error('textStyleId setter is not allowed with dynamic-page; use setTextStyleIdAsync') }
    async setTextStyleIdAsync(id) {
      if (!textStyles.some((s) => s.id === id)) throw new Error(`Unknown text style ${id}`)
      this._textStyleId = id
    }
    get effectStyleId() { return this._effectStyleId ?? '' }
    set effectStyleId(_v) { throw new Error('effectStyleId setter is not allowed with dynamic-page; use setEffectStyleIdAsync') }
    async setEffectStyleIdAsync(id) {
      const s = effectStyles.find((e) => e.id === id)
      if (!s) throw new Error(`Unknown effect style ${id}`)
      this._effectStyleId = id
      this.effects = s.effects
    }
  }

  class ParentNode extends BaseNode {
    constructor(type) {
      super(type)
      this._children = []
    }
    get children() { return this._children }
    appendChild(child) { this.insertChild(this._children.length, child) }
    insertChild(index, child) {
      if (this.insideInstance() && !this._cloning) throw new Error(`Cannot append into instance ${this.name}`)
      // Figma: "Cannot move node. Reparenting would create a component inside a component".
      const hasMain = (n) => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET' || (n.type !== 'INSTANCE' && (n._children ?? []).some(hasMain))
      const variantIntoSet = this.type === 'COMPONENT_SET' && child.type === 'COMPONENT'
      if (!variantIntoSet && !this._cloning && hasMain(child)) {
        for (let p = this; p; p = p.parent) {
          if (p.type === 'COMPONENT' || p.type === 'COMPONENT_SET' || p.type === 'INSTANCE') {
            throw new Error(`in appendChild: Cannot move node. Reparenting would create a component inside a component (${child.name} into ${this.name})`)
          }
        }
      }
      if (child.parent) child.parent._children.splice(child.parent._children.indexOf(child), 1)
      child.parent = this
      this._children.splice(index, 0, child)
    }
    findAll(fn = () => true) {
      const out = []
      const walk = (n) => {
        for (const c of n.children ?? []) {
          if (fn(c)) out.push(c)
          walk(c)
        }
      }
      walk(this)
      return out
    }
    findOne(fn) { return this.findAll(fn)[0] ?? null }
    findChild(fn) { return this.children.find(fn) ?? null }
    findChildren(fn = () => true) { return this.children.filter(fn) }
  }

  class FrameNode extends ParentNode {
    constructor(type = 'FRAME') {
      super(type)
      this._layoutMode = 'NONE'
      this.itemSpacing = 0
      this.counterAxisSpacing = 0
      this.paddingTop = this.paddingRight = this.paddingBottom = this.paddingLeft = 0
      this.primaryAxisAlignItems = 'MIN'
      this.counterAxisAlignItems = 'MIN'
      this.layoutWrap = 'NO_WRAP'
      this.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
      this.strokes = []
      this.strokeWeight = 1
      this.strokeAlign = 'INSIDE'
      this.strokesIncludedInLayout = false
      this.cornerRadius = 0
      this.clipsContent = true
      this.effects = []
      this.description = ''
    }
    // Turning auto-layout off leaves a plain frame with a fixed size, as in Figma.
    set layoutMode(v) {
      if (v === 'NONE' && this._layoutMode !== 'NONE') {
        this._w = this.width
        this._h = this.height
        this._sizingH = this._sizingV = 'FIXED'
      }
      this._layoutMode = v
    }
    get layoutMode() { return this._layoutMode }
    set strokeWeight(w) {
      this._strokeWeight = w
      this.strokeTopWeight = this.strokeRightWeight = this.strokeBottomWeight = this.strokeLeftWeight = w
    }
    get strokeWeight() { return this._strokeWeight }
    set cornerRadius(r) {
      this.topLeftRadius = this.topRightRadius = this.bottomLeftRadius = this.bottomRightRadius = r
    }
    get cornerRadius() { return this.topLeftRadius }
    get width() { return this._measure('H') }
    get height() { return this._measure('V') }
    _measure(axis) {
      const sizing = axis === 'H' ? this._sizingH : this._sizingV
      const stored = axis === 'H' ? this._w : this._h
      if (sizing !== 'HUG' || this.layoutMode === 'NONE') return stored
      const kids = this.children.filter((c) => c.visible && c.layoutPositioning !== 'ABSOLUTE')
      const primary = (this.layoutMode === 'HORIZONTAL') === (axis === 'H')
      const size = (c) => (axis === 'H' ? c.width : c.height)
      const pad = axis === 'H' ? this.paddingLeft + this.paddingRight : this.paddingTop + this.paddingBottom
      const stroke = this.strokesIncludedInLayout && this.strokes.length
        ? (axis === 'H' ? this.strokeLeftWeight + this.strokeRightWeight : this.strokeTopWeight + this.strokeBottomWeight)
        : 0
      if (kids.length === 0) return pad + stroke
      // Wrapping row with a fixed width: lay children into lines.
      if (this.layoutWrap === 'WRAP' && this.layoutMode === 'HORIZONTAL' && axis === 'V') {
        const avail = this._w - this.paddingLeft - this.paddingRight
        let lineW = 0
        let lineH = 0
        let total = 0
        let lines = 0
        for (const c of kids) {
          if (lineW > 0 && lineW + this.itemSpacing + c.width > avail) {
            total += lineH
            lines++
            lineW = 0
            lineH = 0
          }
          lineW += (lineW > 0 ? this.itemSpacing : 0) + c.width
          lineH = Math.max(lineH, c.height)
        }
        total += lineH
        lines++
        return total + this.counterAxisSpacing * (lines - 1) + pad + stroke
      }
      const inner = primary
        ? kids.reduce((s, c) => s + size(c), 0) + this.itemSpacing * (kids.length - 1)
        : Math.max(...kids.map(size))
      return inner + pad + stroke
    }
    resize(w, h) {
      super.resize(w, h)
    }
  }

  const parseVariantName = (name) =>
    Object.fromEntries(
      name.split(',').map((part) => {
        const [k, ...rest] = part.split('=')
        if (!rest.length) throw new Error(`Variant name "${name}" is not "Prop=Value, ..."`)
        return [k.trim(), rest.join('=').trim()]
      }),
    )

  class ComponentNode extends FrameNode {
    constructor() {
      super('COMPONENT')
      this._defs = {}
      this.documentationLinks = []
    }
    _defsOwner() { return this.parent?.type === 'COMPONENT_SET' ? this.parent : this }
    get componentPropertyDefinitions() {
      if (this.parent?.type === 'COMPONENT_SET') throw new Error('Read componentPropertyDefinitions on the set, not a variant')
      return this._defs
    }
    get variantProperties() {
      return this.parent?.type === 'COMPONENT_SET' ? parseVariantName(this.name) : null
    }
    addComponentProperty(name, type, defaultValue) {
      if (this.parent?.type === 'COMPONENT_SET') throw new Error(`${this.name}: add properties to the component set, not a variant`)
      return addProp(this._defs, name, type, defaultValue)
    }
    createInstance() {
      const i = cloneTree(this, true)
      i.mainComponent = this
      return i
    }
  }

  let propSeq = 0
  function addProp(defs, name, type, defaultValue) {
    if (!['TEXT', 'BOOLEAN', 'INSTANCE_SWAP', 'VARIANT'].includes(type)) throw new Error(`Bad property type ${type}`)
    if (type === 'TEXT' && typeof defaultValue !== 'string') throw new Error(`${name}: TEXT default must be a string`)
    if (type === 'BOOLEAN' && typeof defaultValue !== 'boolean') throw new Error(`${name}: BOOLEAN default must be a boolean`)
    if (type === 'INSTANCE_SWAP' && registry.get(defaultValue)?.type !== 'COMPONENT') throw new Error(`${name}: INSTANCE_SWAP default must be a component id`)
    if (Object.keys(defs).some((k) => k.split('#')[0] === name)) throw new Error(`Property "${name}" already exists`)
    const key = `${name}#${++propSeq}:0`
    defs[key] = { type, defaultValue }
    return key
  }

  class ComponentSetNode extends FrameNode {
    constructor() {
      super('COMPONENT_SET')
      this._defs = {}
    }
    get componentPropertyDefinitions() {
      const variantDefs = {}
      for (const c of this.children) {
        for (const [k, val] of Object.entries(c.variantProperties ?? {})) {
          variantDefs[k] ??= { type: 'VARIANT', defaultValue: val, variantOptions: [] }
          if (!variantDefs[k].variantOptions.includes(val)) variantDefs[k].variantOptions.push(val)
        }
      }
      return { ...variantDefs, ...this._defs }
    }
    get defaultVariant() { return this.children[0] }
    addComponentProperty(name, type, defaultValue) { return addProp(this._defs, name, type, defaultValue) }
  }

  class InstanceNode extends FrameNode {
    constructor() { super('INSTANCE') }
    get componentProperties() {
      const set = this.mainComponent.parent?.type === 'COMPONENT_SET' ? this.mainComponent.parent : null
      const out = {}
      for (const [k, val] of Object.entries(this.mainComponent.variantProperties ?? {})) out[k] = { type: 'VARIANT', value: val }
      return out
    }
    setProperties(props) {
      const main = this.mainComponent
      const owner = main._defsOwner()
      const defs = owner.componentPropertyDefinitions
      const variantWant = {}
      for (const [k, val] of Object.entries(props)) {
        const d = defs[k]
        if (!d) throw new Error(`${this.name}: no property ${k} on ${owner.name}`)
        if (d.type === 'VARIANT') {
          if (!d.variantOptions.includes(val)) throw new Error(`${owner.name}: ${k} has no option "${val}"`)
          variantWant[k] = val
        }
      }
      if (Object.keys(variantWant).length) {
        const current = main.variantProperties
        const want = { ...current, ...variantWant }
        const target = owner.children.find((c) => Object.entries(want).every(([k, val]) => c.variantProperties[k] === val))
        if (!target) throw new Error(`${owner.name}: no variant for ${JSON.stringify(want)}`)
        const fresh = cloneTree(target, true)
        this._cloning = true
        for (const c of [...this._children]) c.remove()
        for (const c of [...fresh._children]) this.insertChild(this._children.length, c)
        this._cloning = false
        copyFrameProps(fresh, this, { keepSize: false })
        this.mainComponent = target
      }
      for (const [k, val] of Object.entries(props)) {
        const d = defs[k]
        if (d.type === 'VARIANT') continue
        for (const n of this.findAll((n) => n.componentPropertyReferences)) {
          const refs = n.componentPropertyReferences
          if (d.type === 'TEXT' && refs.characters === k) n.characters = val
          if (d.type === 'BOOLEAN' && refs.visible === k) n.visible = val
          if (d.type === 'INSTANCE_SWAP' && refs.mainComponent === k) {
            const target = registry.get(val)
            if (target?.type !== 'COMPONENT') throw new Error(`${this.name}: ${k} needs a component id, got ${val}`)
            n.swapComponent(target)
          }
        }
      }
    }
    detachInstance() { throw new Error('detachInstance is not mocked') }
    swapComponent(target) {
      const fresh = cloneTree(target, true)
      this._cloning = true
      for (const c of [...this._children]) c.remove()
      for (const c of [...fresh._children]) this.insertChild(this._children.length, c)
      this._cloning = false
      this.mainComponent = target
      this.svgSource = target.svgSource
    }
  }

  const FRAME_KEYS = ['name', 'layoutMode', 'itemSpacing', 'counterAxisSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'layoutWrap', 'fills', 'strokes', 'strokeAlign', 'strokesIncludedInLayout', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'clipsContent', 'effects', 'visible', 'opacity', 'boundVariables', 'explicitVariableModes', '_sizingH', '_sizingV', '_w', '_h', 'x', 'y', 'layoutPositioning', '_refs', '_effectStyleId', 'rotation', '_constraints', '_insets', 'minWidth', 'dashPattern', '_scale']

  function copyFrameProps(from, to, { keepSize = false } = {}) {
    for (const k of FRAME_KEYS) {
      if (keepSize && ['_w', '_h', '_sizingH', '_sizingV', 'x', 'y', 'layoutPositioning', 'name'].includes(k)) continue
      if (k in from) to[k] = structuredCloneSafe(from[k])
    }
  }
  function structuredCloneSafe(v) {
    if (v && typeof v === 'object') return JSON.parse(JSON.stringify(v))
    return v
  }

  function cloneTree(node, asInstance) {
    let out
    if (node.type === 'TEXT') {
      out = new TextNode()
      Object.assign(out, { _font: node._font, _chars: node._chars, _fontSize: node._fontSize })
      for (const k of ['name', 'fills', 'lineHeight', 'letterSpacing', 'textCase', 'textAlignHorizontal', 'textAutoResize', 'textTruncation', 'maxLines', 'visible', 'opacity', '_sizingH', '_sizingV', '_w', '_h', 'x', 'y', 'layoutPositioning', '_refs', '_textStyleId', 'boundVariables', 'textDecoration', '_ranges', 'rotation', '_constraints', '_insets']) out[k] = structuredCloneSafe(node[k])
      return out
    }
    if (node.type === 'RECTANGLE' || node.type === 'VECTOR') {
      out = node.type === 'RECTANGLE' ? new RectNode() : new VectorNode(node.svgElement)
      for (const k of ['name', 'fills', 'strokes', 'strokeWeight', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'visible', 'opacity', '_sizingH', '_sizingV', '_w', '_h', 'x', 'y', 'layoutPositioning', '_refs', 'boundVariables', 'rotation', '_constraints', '_insets']) out[k] = structuredCloneSafe(node[k])
      return out
    }
    out = asInstance && (node.type === 'COMPONENT') ? new InstanceNode() : node.type === 'INSTANCE' ? new InstanceNode() : new FrameNode()
    if (node.type === 'INSTANCE') out.mainComponent = node.mainComponent
    copyFrameProps(node, out)
    out.svgSource = node.svgSource
    out._cloning = true
    for (const c of node.children) out.insertChild(out._children.length, cloneTree(c, false))
    out._cloning = false
    return out
  }

  class TextNode extends BaseNode {
    constructor() {
      super('TEXT')
      this._font = { family: 'Inter', style: 'Regular' }
      this._chars = ''
      this._fontSize = 12
      this.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
      this.textAutoResize = 'WIDTH_AND_HEIGHT'
      this.textAlignHorizontal = 'LEFT'
      this.textCase = 'ORIGINAL'
      this.lineHeight = { unit: 'AUTO' }
      this.letterSpacing = { unit: 'PERCENT', value: 0 }
      this.textTruncation = 'DISABLED'
      this.maxLines = null
      this.textDecoration = 'NONE'
      this._ranges = []
    }
    setRangeFontName(start, end, f) {
      if (!loadedFonts.has(fontKey(f))) throw new Error(`setRangeFontName: ${fontKey(f)} is not loaded`)
      if (start < 0 || end > this._chars.length || start >= end) throw new Error(`setRangeFontName(${start}, ${end}) out of range for "${this._chars}"`)
      this._ranges.push({ start, end, font: f })
    }
    _needFont() {
      if (!loadedFonts.has(fontKey(this._font))) throw new Error(`${this.name}: font ${fontKey(this._font)} is not loaded`)
    }
    get fontName() { return this._font }
    set fontName(f) {
      if (!loadedFonts.has(fontKey(f))) throw new Error(`fontName ${fontKey(f)} is not loaded`)
      this._font = f
    }
    get characters() { return this._chars }
    set characters(s) {
      this._needFont()
      this._chars = String(s)
    }
    get fontSize() { return this._fontSize }
    set fontSize(n) {
      this._needFont()
      this._fontSize = n
    }
    get width() {
      if (this.textAutoResize === 'WIDTH_AND_HEIGHT' && this._sizingH !== 'FILL') {
        return Math.ceil(this._chars.length * this._fontSize * 0.56)
      }
      return this._w
    }
    get height() {
      const lh = this.lineHeight?.unit === 'PIXELS' ? this.lineHeight.value : Math.round(this._fontSize * 1.21)
      return lh
    }
  }

  class RectNode extends BaseNode {
    constructor() {
      super('RECTANGLE')
      this.fills = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }]
      this.strokes = []
      this.cornerRadius = 0
    }
    set cornerRadius(r) { this.topLeftRadius = this.topRightRadius = this.bottomLeftRadius = this.bottomRightRadius = r }
    get cornerRadius() { return this.topLeftRadius }
  }

  class VectorNode extends BaseNode {
    constructor(svgElement) {
      super('VECTOR')
      this.svgElement = svgElement
      this.fills = []
      this.strokes = []
    }
  }

  class PageNode extends ParentNode {
    constructor(name) {
      super('PAGE')
      this.name = name
      this.loaded = true
    }
    get children() {
      if (!this.loaded) throw new Error(`Page "${this.name}" is not loaded; call loadAsync() first`)
      return this._children
    }
    async loadAsync() { this.loaded = true }
    remove() {
      if (figma.currentPage === this) throw new Error('Cannot remove the current page')
      super.remove()
    }
  }

  class DocumentNode extends ParentNode {
    constructor() { super('DOCUMENT') }
  }

  // ------------------------------------------------------------ svg

  function svgToNode(svg) {
    if (!/^\s*<svg[\s>]/.test(svg) || !/<\/svg>\s*$/.test(svg)) throw new Error('createNodeFromSvg: not an <svg> document')
    const open = /<svg\b([^>]*)>/.exec(svg)
    const attr = (src, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(src)?.[1]
    const w = parseFloat(attr(open[1], 'width') ?? '24')
    const h = parseFloat(attr(open[1], 'height') ?? '24')
    const frame = new FrameNode()
    frame.name = 'svg'
    frame.resize(w, h)
    frame.svgSource = svg
    const rootStroke = attr(open[1], 'stroke')
    const rootFill = attr(open[1], 'fill') ?? '#000000'
    const elementRe = /<(path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*\/?>/g
    let m
    while ((m = elementRe.exec(svg))) {
      const el = m[0]
      const vec = new VectorNode(el)
      vec.name = m[1]
      const stroke = attr(el, 'stroke') ?? rootStroke
      const fill = attr(el, 'fill') ?? rootFill
      if (stroke && stroke !== 'none') vec.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
      if (fill && fill !== 'none') vec.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
      frame.insertChild(frame._children.length, vec)
    }
    if (frame._children.length === 0) throw new Error('createNodeFromSvg: no drawable elements')
    return frame
  }

  // ------------------------------------------------------------ variables

  class VariableCollection {
    constructor(name) {
      this.id = `VariableCollectionId:${nextId()}`
      this.name = name
      this.modes = [{ modeId: `${nextId()}`, name: 'Mode 1' }]
      this.removed = false
    }
    get defaultModeId() { return this.modes[0].modeId }
    renameMode(modeId, name) {
      const m = this.modes.find((x) => x.modeId === modeId)
      if (!m) throw new Error(`renameMode: unknown mode ${modeId}`)
      m.name = name
    }
    addMode(name) {
      if (this.modes.length >= maxModes) throw new Error(`Limited to ${maxModes} modes on this plan`)
      const modeId = nextId()
      this.modes.push({ modeId, name })
      return modeId
    }
    remove() { this.removed = true }
  }

  class Variable {
    constructor(name, collection, type) {
      this.id = `VariableID:${nextId()}`
      this.name = name
      this.variableCollectionId = collection.id
      this.resolvedType = type
      this.valuesByMode = {}
      this.codeSyntax = {}
      this.scopes = ['ALL_SCOPES']
      this.description = ''
    }
    setValueForMode(modeId, value) {
      const col = collections.find((c) => c.id === this.variableCollectionId)
      if (!col.modes.some((m) => m.modeId === modeId)) throw new Error(`${this.name}: unknown mode ${modeId}`)
      if (this.resolvedType === 'COLOR') {
        if (typeof value !== 'object' || !['r', 'g', 'b'].every((k) => value[k] >= 0 && value[k] <= 1)) throw new Error(`${this.name}: bad color ${JSON.stringify(value)}`)
      } else if (this.resolvedType === 'FLOAT' && typeof value !== 'number') {
        throw new Error(`${this.name}: FLOAT value must be a number`)
      }
      this.valuesByMode[modeId] = value
    }
    setVariableCodeSyntax(platform, value) { this.codeSyntax[platform] = value }
    remove() { variables.splice(variables.indexOf(this), 1) }
  }

  const bindPaint = (p, field, variable) => {
    if (field !== 'color') throw new Error(`Paint field ${field}`)
    if (!variables.includes(variable)) throw new Error('setBoundVariableForPaint: unknown variable')
    if (variable.resolvedType !== 'COLOR') throw new Error(`setBoundVariableForPaint: ${variable.name} is not a COLOR`)
    // Figma hands back the bound paint at full opacity (observed in a real run),
    // so the mock drops the input opacity too.
    const { opacity: _dropped, ...rest } = p
    return { ...rest, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: variable.id } } }
  }

  // ------------------------------------------------------------ figma

  const document = new DocumentNode()
  const firstPage = new PageNode('Page 1')
  document.insertChild(0, firstPage)
  let currentPage = firstPage

  const figma = {
    root: document,
    get currentPage() { return currentPage },
    set currentPage(_p) { throw new Error('figma.currentPage = is not allowed with dynamic-page; use setCurrentPageAsync') },
    async setCurrentPageAsync(p) {
      await p.loadAsync()
      currentPage = p
    },
    getNodeById() { throw new Error('getNodeById is not allowed with dynamic-page') },
    async getNodeByIdAsync(id) {
      return [document, ...document.findAll()].find((n) => n.id === id) ?? null
    },
    async listAvailableFontsAsync() {
      return ['Regular', 'Medium', 'Semi Bold', 'Bold'].map((style) => ({ fontName: { family: 'Inter', style } }))
        .concat([{ fontName: { family: 'Roboto Mono', style: 'Regular' } }])
    },
    async loadFontAsync(f) {
      const known = await figma.listAvailableFontsAsync()
      if (!known.some((k) => fontKey(k.fontName) === fontKey(f))) throw new Error(`Font ${fontKey(f)} does not exist`)
      loadedFonts.add(fontKey(f))
    },
    createFrame() { const n = new FrameNode(); currentPage.insertChild(currentPage._children.length, n); return n },
    createComponent() { const n = new ComponentNode(); currentPage.insertChild(currentPage._children.length, n); return n },
    createText() { const n = new TextNode(); currentPage.insertChild(currentPage._children.length, n); return n },
    createRectangle() { const n = new RectNode(); currentPage.insertChild(currentPage._children.length, n); return n },
    createNodeFromSvg(svg) { const n = svgToNode(svg); currentPage.insertChild(currentPage._children.length, n); return n },
    createPage() {
      if (document._children.length >= maxPages) throw new Error(`This plan allows ${maxPages} pages per file`)
      const p = new PageNode('Page'); document.insertChild(document._children.length, p); return p },
    combineAsVariants(nodes, parent, index) {
      if (!nodes.length) throw new Error('combineAsVariants: no nodes')
      for (const n of nodes) if (n.type !== 'COMPONENT') throw new Error(`combineAsVariants: ${n.name} is not a component`)
      const seen = new Set()
      let keys = null
      for (const n of nodes) {
        const vp = parseVariantName(n.name)
        const sig = JSON.stringify(Object.entries(vp).sort())
        if (seen.has(sig)) throw new Error(`combineAsVariants: duplicate variant "${n.name}"`)
        seen.add(sig)
        const k = Object.keys(vp).sort().join(',')
        if (keys !== null && k !== keys) throw new Error(`combineAsVariants: "${n.name}" has properties ${k}, expected ${keys}`)
        keys = k
        if (Object.keys(n._defs).length) throw new Error(`combineAsVariants: ${n.name} already has component properties; add them to the set`)
      }
      const set = new ComponentSetNode()
      set.fills = []
      parent.insertChild(index ?? parent._children.length, set)
      for (const n of nodes) set.insertChild(set._children.length, n)
      return set
    },
    createTextStyle() {
      const s = { id: `S:${nextId()}`, type: 'TEXT', name: '', description: '', remove() { textStyles.splice(textStyles.indexOf(s), 1) } }
      textStyles.push(s)
      return s
    },
    createEffectStyle() {
      const s = { id: `S:${nextId()}`, type: 'EFFECT', name: '', effects: [], description: '', remove() { effectStyles.splice(effectStyles.indexOf(s), 1) } }
      effectStyles.push(s)
      return s
    },
    async getLocalTextStylesAsync() { return [...textStyles] },
    async getLocalEffectStylesAsync() { return [...effectStyles] },
    getLocalTextStyles() { throw new Error('getLocalTextStyles is not allowed with dynamic-page') },
    variables: {
      async getLocalVariableCollectionsAsync() { return collections.filter((c) => !c.removed) },
      async getLocalVariablesAsync() { return [...variables] },
      getLocalVariables() { throw new Error('getLocalVariables is not allowed with dynamic-page') },
      createVariableCollection(name) { const c = new VariableCollection(name); collections.push(c); return c },
      createVariable(name, collection, type) {
        if (typeof collection === 'string') throw new Error('createVariable(name, collectionId) is not allowed with dynamic-page')
        if (variables.some((x) => x.variableCollectionId === collection.id && x.name === name)) throw new Error(`Variable "${name}" already exists`)
        const x = new Variable(name, collection, type)
        variables.push(x)
        return x
      },
      setBoundVariableForPaint: bindPaint,
      setBoundVariableForEffect(effect, field, variable) {
        if (!variables.includes(variable)) throw new Error('setBoundVariableForEffect: unknown variable')
        if (field === 'color' && variable.resolvedType !== 'COLOR') throw new Error('effect color needs a COLOR variable')
        return { ...effect, boundVariables: { ...(effect.boundVariables ?? {}), [field]: { type: 'VARIABLE_ALIAS', id: variable.id } } }
      },
      async getVariableByIdAsync(id) { return variables.find((x) => x.id === id) ?? null },
    },
    notify(msg, opts) { notifications.push({ msg, ...opts }) },
    mixed: Symbol('mixed'),
    async setFileThumbnailNodeAsync(node) {
      if (node && !registry.has(node.id)) throw new Error('setFileThumbnailNodeAsync: unknown node')
      if (node && node.parent?.type !== 'PAGE') throw new Error('setFileThumbnailNodeAsync: the thumbnail must be a top-level frame')
    },
    createComponentFromNode(node) {
      if (node.type !== 'FRAME') throw new Error('createComponentFromNode: mock supports frames only')
      const c = new ComponentNode()
      copyFrameProps(node, c)
      c.svgSource = node.svgSource
      const parent = node.parent
      const index = parent._children.indexOf(node)
      for (const ch of [...node._children]) c.insertChild(c._children.length, ch)
      node.remove()
      parent.insertChild(index, c)
      return c
    },
    closePlugin(msg) { closed = true; if (msg) notifications.push({ msg }) },
    viewport: { scrollAndZoomIntoView() {} },
  }

  return {
    figma,
    state: { collections, variables, textStyles, effectStyles, notifications, warnings, get closed() { return closed }, reopen() { closed = false } },
  }
}

// ------------------------------------------------------------------ html

/**
 * Render the mock document as HTML. `modeName` picks the default variable mode
 * for frames that do not set one explicitly.
 */
export function renderHtml(mock, { pages, title = 'SvGrid Figma kit preview' } = {}) {
  const { figma, state } = mock
  const varById = new Map(state.variables.map((x) => [x.id, x]))
  const colById = new Map(state.collections.map((c) => [c.id, c]))

  const resolve = (alias, modes) => {
    const variable = varById.get(alias.id)
    const col = colById.get(variable.variableCollectionId)
    const modeId = modes[col.id] ?? col.defaultModeId
    return variable.valuesByMode[modeId] ?? variable.valuesByMode[col.defaultModeId]
  }
  const css = (c, opacity = 1) => {
    const a = (c.a ?? 1) * opacity
    return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${+a.toFixed(3)})`
  }
  const paintCss = (p, modes) => {
    if (!p || p.visible === false) return null
    if (p.type === 'GRADIENT_LINEAR') return `linear-gradient(180deg, ${p.gradientStops.map((s) => `${css(s.color)} ${s.position * 100}%`).join(', ')})`
    const c = p.boundVariables?.color ? resolve(p.boundVariables.color, modes) : p.color
    return css(c, p.opacity ?? 1)
  }
  const radius = (n, corner, modes) => {
    const b = n.boundVariables?.[corner]
    return b ? resolve(b, modes) : n[corner] ?? 0
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const weightOf = (style) => (/bold/i.test(style) ? (/semi/i.test(style) ? 600 : 700) : /medium/i.test(style) ? 500 : 400)

  function sizeCss(n, parent, modes) {
    const out = []
    const pdir = parent?.layoutMode === 'HORIZONTAL' ? 'H' : parent?.layoutMode === 'VERTICAL' ? 'V' : null
    for (const axis of ['H', 'V']) {
      const sizing = axis === 'H' ? n.layoutSizingHorizontal : n.layoutSizingVertical
      const prop = axis === 'H' ? 'width' : 'height'
      const bound = n.boundVariables?.[axis === 'H' ? 'width' : 'height']
      const val = bound ? resolve(bound, modes) : axis === 'H' ? n._w : n._h
      if ((axis === 'H' && n._stretchH) || (axis === 'V' && n._stretchV)) {
        continue
      } else if (sizing === 'FILL' && pdir) {
        if (pdir === axis) out.push('flex:1 1 0', `min-${prop}:0`)
        else out.push('align-self:stretch')
      } else if (sizing === 'HUG') {
        out.push(`${prop}:max-content`)
      } else if (n.type !== 'TEXT' || axis === 'H' || n.textAutoResize === 'NONE' || n.textAutoResize === 'TRUNCATE') {
        if (!(n.type === 'TEXT' && n.textAutoResize === 'WIDTH_AND_HEIGHT')) out.push(`${prop}:${val}px`)
      }
    }
    out.push('flex-shrink:0')
    return out
  }

  function node(n, parent, modes) {
    if (!n.visible) return ''
    modes = { ...modes, ...n.explicitVariableModes }
    const style = ['box-sizing:border-box', 'position:relative']
    if (parent && (parent.layoutMode === 'NONE' || n.layoutPositioning === 'ABSOLUTE') && parent.type !== 'PAGE') {
      const c = n._constraints ?? {}
      const ins = n._insets
      const sh = c.horizontal === 'STRETCH' && ins
      const sv = c.vertical === 'STRETCH' && ins
      style.push('position:absolute')
      if (c.horizontal === 'MAX' && ins) style.push(`right:${ins.right}px`)
      else style.push(`left:${n.x}px`)
      if (sh) style.push(`right:${ins.right}px`)
      if (c.vertical === 'MAX' && ins) style.push(`bottom:${ins.bottom}px`)
      else style.push(`top:${n.y}px`)
      if (sv) style.push(`bottom:${ins.bottom}px`)
      n = Object.assign(Object.create(Object.getPrototypeOf(n)), n, { _stretchH: sh, _stretchV: sv })
    }
    if (n.opacity !== 1) style.push(`opacity:${n.opacity}`)
    style.push(...sizeCss(n, parent, modes))
    if (n.minWidth) style.push(`min-width:${n.minWidth}px`)
    if (n._scale) style.push(`transform:scale(${n._scale})`, 'transform-origin:0 0')
    if (n.rotation) style.push(`transform:rotate(${-n.rotation}deg)`)

    if (n.type === 'TEXT') {
      const fill = paintCss(n.fills[0], modes)
      const fw = n.boundVariables?.fontWeight ? resolve(n.boundVariables.fontWeight, modes) : weightOf(n._font.style)
      style.push(`font-family:${n._font.family === 'Roboto Mono' ? "'Roboto Mono', ui-monospace, monospace" : 'Inter, system-ui, sans-serif'}`, `font-size:${n._fontSize}px`, `font-weight:${fw}`, `color:${fill}`)
      if (n.textDecoration === 'STRIKETHROUGH') style.push('text-decoration:line-through')
      if (n.lineHeight?.unit === 'PIXELS') style.push(`line-height:${n.lineHeight.value}px`)
      else style.push('line-height:normal')
      if (n.letterSpacing?.unit === 'PIXELS' && n.letterSpacing.value) style.push(`letter-spacing:${n.letterSpacing.value}px`)
      if (n.textCase === 'UPPER') style.push('text-transform:uppercase')
      style.push(`text-align:${n.textAlignHorizontal.toLowerCase()}`)
      if (n.textTruncation === 'ENDING') style.push('white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis')
      else if (n.textAutoResize === 'WIDTH_AND_HEIGHT') style.push('white-space:pre')
      else style.push('white-space:pre-wrap')
      let inner = esc(n._chars)
      if (n._ranges?.length) {
        let out = ''
        let at = 0
        for (const r of [...n._ranges].sort((a, b) => a.start - b.start)) {
          out += esc(n._chars.slice(at, r.start)) + `<span style="font-weight:${weightOf(r.font.style)}">${esc(n._chars.slice(r.start, r.end))}</span>`
          at = r.end
        }
        inner = out + esc(n._chars.slice(at))
      }
      return `<div data-name="${esc(n.name)}" style="${style.join(';')}">${inner}</div>`
    }
    if (n.type === 'RECTANGLE') {
      const fill = paintCss(n.fills[0], modes)
      if (fill) style.push(`background:${fill}`)
      style.push(`border-radius:${['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'].map((c) => radius(n, c, modes) + 'px').join(' ')}`)
      return `<div data-name="${esc(n.name)}" style="${style.join(';')}"></div>`
    }
    if (n.svgSource) {
      // Re-emit the svg with bound colors substituted per element.
      const color = paintCss(n.findAll((c) => c.strokes?.length || c.fills?.length).map((c) => c.strokes?.[0] ?? c.fills?.[0])[0], modes) ?? 'currentColor'
      const svg = n.svgSource.replace(/currentColor|#000000/g, color).replace(/<svg\b/, `<svg style="display:block"`)
      return `<div data-name="${esc(n.name)}" style="${style.join(';')}">${svg}</div>`
    }

    // Frame-like.
    if (n.layoutMode && n.layoutMode !== 'NONE') {
      style.push('display:flex', `flex-direction:${n.layoutMode === 'HORIZONTAL' ? 'row' : 'column'}`, `gap:${n.layoutWrap === 'WRAP' ? `${n.counterAxisSpacing}px ` : ''}${n.itemSpacing}px`)
      if (n.layoutWrap === 'WRAP') style.push('flex-wrap:wrap')
      const num = (k) => (n.boundVariables?.[k] ? resolve(n.boundVariables[k], modes) : n[k])
      style.push(`padding:${num('paddingTop')}px ${num('paddingRight')}px ${num('paddingBottom')}px ${num('paddingLeft')}px`)
      const map = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between', BASELINE: 'baseline' }
      style.push(`align-items:${map[n.counterAxisAlignItems]}`, `justify-content:${map[n.primaryAxisAlignItems]}`)
      if (n.layoutWrap === 'WRAP') style.push('align-content:flex-start')
    }
    const fill = (n.fills ?? []).map((p) => paintCss(p, modes)).filter(Boolean)
    if (fill.length) style.push(`background:${fill[fill.length - 1]}`)
    style.push(`border-radius:${['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'].map((c) => radius(n, c, modes) + 'px').join(' ')}`)
    if (n.clipsContent) style.push('overflow:hidden')
    const shadows = (n.effects ?? []).filter((e) => e.type === 'DROP_SHADOW' && e.visible !== false).map((e) => {
      const c = e.boundVariables?.color ? resolve(e.boundVariables.color, modes) : e.color
      return `${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread ?? 0}px ${css(c)}`
    })
    if (shadows.length) style.push(`box-shadow:${shadows.join(', ')}`)

    let overlay = ''
    const stroke = n.strokes?.length ? paintCss(n.strokes[0], modes) : null
    if (stroke) {
      const w = [n.strokeTopWeight, n.strokeRightWeight, n.strokeBottomWeight, n.strokeLeftWeight]
      const border = `border-style:${n.dashPattern?.length ? 'dashed' : 'solid'};border-color:${stroke};border-width:${w.map((x) => x + 'px').join(' ')}`
      if (n.strokesIncludedInLayout && n.layoutMode !== 'NONE') style.push(border)
      else {
        const inset = n.strokeAlign === 'OUTSIDE' ? `-${n.strokeWeight}px` : n.strokeAlign === 'CENTER' ? `-${n.strokeWeight / 2}px` : '0'
        overlay = `<div style="position:absolute;inset:${inset};pointer-events:none;box-sizing:border-box;border-radius:inherit;${border}"></div>`
      }
    }
    const kids = n.children.map((c) => node(c, n, modes)).join('')
    const label = n.type === 'COMPONENT' || n.type === 'COMPONENT_SET' ? ` data-kind="${n.type.toLowerCase()}"` : ''
    return `<div data-name="${esc(n.name)}"${label} style="${style.join(';')}">${kids}${overlay}</div>`
  }

  const chosen = pages ?? figma.root.children.filter((p) => p.loaded)
  const body = chosen.map((p) => {
    const kids = p.children
    const maxX = Math.max(0, ...kids.map((k) => k.x + k.width))
    const maxY = Math.max(0, ...kids.map((k) => k.y + k.height))
    // Top-level frames stack in flow (the kit lays pages out in one column):
    // the mock cannot measure wrapped text, so its y positions would overlap.
    void maxX
    void maxY
    const sorted = [...kids].sort((a, b) => a.y - b.y || a.x - b.x)
    return `<section class="page"><h1>${esc(p.name)}</h1><div style="display:flex;flex-direction:column;align-items:flex-start;gap:96px">${sorted.map((k) => node(k, { layoutMode: 'VERTICAL', type: 'CANVAS' }, {})).join('')}</div></section>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono&display=swap" rel="stylesheet">
<style>body{margin:0;background:#e5e5e5;font-family:Inter,system-ui,sans-serif}.page{padding:24px}.page>h1{font:600 14px Inter,sans-serif;color:#555;margin:0 0 12px}[data-kind=component_set]{outline:1px dashed #9747ff;outline-offset:0}</style></head><body>${body}</body></html>`
}
