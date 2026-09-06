/**
 * Generate the custom elements' prop + event surface from `<SvGrid>`'s own
 * `Props` type.
 *
 * Why generated. The elements used to declare SEVEN props and TWO events by
 * hand, against a Props type with 100 data props and 19 callbacks - so
 * grouping, pagination, pinning, tree data, master/detail, board, scheduler and
 * every enterprise feature were unreachable from `<sv-grid>`, while the docs
 * said they "all come along". A hand-kept list is what produced that gap, and a
 * hand-kept list would produce it again the next time a prop lands.
 *
 * Usage:
 *   node scripts/generate-surface.mjs           write src/surface.generated.js
 *   node scripts/generate-surface.mjs --check   fail if it is stale (CI)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseTypeMembers } from '../../mcp/scripts/api-surface.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const TYPES = join(here, '..', '..', 'grid', 'src', 'SvGrid.types.ts')
const OUT = join(here, '..', 'src', 'surface.generated.js')

/**
 * Props that are deliberately NOT exposed, with the reason. Anything omitted
 * without an entry here is a bug, and the parity test says so.
 */
const EXCLUDED = {
  // Snippets are a Svelte compile-time construct. There is nothing to hand a
  // custom element - a host page has no way to author one. Column `format`
  // options and HTML-string renderers are the documented substitute.
  renderDetailRow: 'Svelte snippet - cannot cross the custom-element boundary',

  // A name collision, not an omission. `<sv-grid selectable>` shipped in 2.6.2
  // meaning ROW-selection checkboxes; `<SvGrid selectable>` is an alias of
  // `enableCellSelection`, which is a different feature. Forwarding it would
  // silently repoint a published attribute at cell selection, so the element
  // keeps its own `selectable` and cell selection stays reachable under its
  // real name, `enable-cell-selection`.
  selectable: 'element-level shorthand for row selection - see GridBody.svelte',
}

/**
 * The shared parser returns an empty type when a member's type starts on the
 * NEXT line, which is how the long unions are formatted:
 *
 *     selectionBar?:
 *       | boolean
 *       | ReadonlyArray<...>
 *
 * Two props hit that today. Defaulting them to Object would be right by luck
 * and wrong the first time someone formats a `boolean` prop that way, so read
 * the declaration back out of the source instead of guessing.
 */
function rawTypeOf(src, name) {
  const re = new RegExp(`^[ \\t]*${name}\\??\\s*:`, 'm')
  const m = re.exec(src)
  if (!m) return ''
  let i = m.index + m[0].length
  let depth = 0
  let out = ''
  // Brackets only, NOT angle brackets. Counting `<`/`>` looks right until you
  // meet `=>`: the arrow's `>` decremented the depth, so every function type
  // ended early - `serverGroup` came out as `{ isGroup: (row: TData) => boolean`
  // with no closing brace, and `onFiltersChange` lost its `) =>` and so
  // reported no parameters at all. A generic carrying a top-level `;` outside
  // braces does not occur here.
  for (; i < src.length; i++) {
    const c = src[i]
    if ('{[('.includes(c)) depth++
    else if ('}])'.includes(c)) {
      if (depth === 0) break
      depth--
    } else if (depth === 0 && (c === ';' || c === ',')) break
    out += c
  }
  return out.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Map a TS type to Svelte's custom-element `type`, plus whether it can also be
 * an HTML ATTRIBUTE.
 *
 * An attribute is a string. `columns` is not a string, and no amount of
 * coercion makes `columns='[object Object]'` work - so arrays, objects and
 * functions are property-only. That distinction is the single thing a
 * non-Svelte user most often gets wrong, so it is encoded here rather than
 * left to the docs.
 *
 * A union of a primitive and something else (`responsive: boolean | {...}`,
 * `rowHeight: number | fn`) keeps the primitive attribute AND accepts the
 * richer value as a property. That is exactly how HTML behaves already.
 */
function classify(type) {
  const t = resolveAlias(type).replace(/\s+/g, ' ').trim()
  const parts = splitUnion(t)
  const has = (re) => parts.some((p) => re.test(p))
  const isStringUnion = parts.length > 0 && parts.every((p) => /^['"].*['"]$/.test(p))

  // String is checked BEFORE number, because `containerHeight: number | string`
  // has to accept `container-height="100%"`. An attribute is a string, so when
  // the prop takes one, String is the coercion that loses nothing - Number
  // would turn "100%" into NaN.
  if (has(/^string$/) || isStringUnion) return { type: 'String', attribute: true }
  if (has(/^boolean$/)) return { type: 'Boolean', attribute: true }
  if (has(/^number$/)) return { type: 'Number', attribute: true }
  if (has(/^(ReadonlyArray|Array)</) || has(/\[\]$/)) return { type: 'Array', attribute: false }
  return { type: 'Object', attribute: false }
}

/**
 * A prop typed as a bare alias (`groupDisplayMode: GroupDisplayType`) carries
 * no shape at this level, and defaulting it to Object would cost it its
 * attribute. Three props are written that way today; one of them,
 * GroupDisplayType, is a plain string union declared in group-display.ts.
 *
 * So resolve one level of alias across the grid's sources. One level only -
 * anything deeper is a signal the type is too complex for an HTML attribute
 * anyway, and Object is then the honest answer.
 */
let aliasIndex = null
function resolveAlias(type) {
  const t = String(type).trim()
  if (!/^[A-Z][A-Za-z0-9]*$/.test(t)) return t
  if (!aliasIndex) {
    aliasIndex = new Map()
    const dir = join(here, '..', '..', 'grid', 'src')
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue
      const text = readFileSync(join(dir, f), 'utf8')
      // To a semicolon OR the end of the line: `export type GroupDisplayType =
      // 'groupRows' | ...` has no trailing semicolon, and requiring one made
      // this silently find nothing while looking like it worked.
      for (const m of text.matchAll(/^export type ([A-Z][A-Za-z0-9]*)\s*=\s*([^;\n]+);?$/gm))
        if (!aliasIndex.has(m[1])) aliasIndex.set(m[1], m[2].replace(/\s+/g, ' ').trim())
    }
  }
  return aliasIndex.get(t) ?? t
}

/** Split a union at top level only, so `A<B | C> | D` yields two parts. */
function splitUnion(t) {
  const out = []
  let depth = 0
  let cur = ''
  for (const c of t.replace(/^\s*\|/, '')) {
    if ('{[(<'.includes(c)) depth++
    else if ('}])>'.includes(c)) depth--
    if (c === '|' && depth === 0) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** `onCellValueChange` -> `cellvaluechange`, the names the docs already use. */
const eventName = (cb) => cb.replace(/^on/, '').toLowerCase()

/**
 * A callback's parameter names, so a multi-argument callback can carry a NAMED
 * detail object rather than a positional array. 18 of the 19 take one argument
 * (detail = that argument); only onRowSelectionChange takes two.
 */
function paramNames(type) {
  const t = String(type).replace(/\s+/g, ' ')
  const open = t.indexOf('(')
  const close = t.lastIndexOf(') =>')
  if (open < 0 || close < 0) return []
  // Split at depth 0, tracking BRACES as well as brackets and parens.
  // `onFiltersChange?: (filters: { global: string; columns: ... })` has commas
  // inside an inline object type, and a regex split on them silently produced
  // no parameter names at all - which showed up in the docs as `void`.
  const inner = t.slice(open + 1, close)
  const parts = []
  let depth = 0
  let cur = ''
  for (const c of inner) {
    if ('{[(<'.includes(c)) depth++
    else if ('}])>'.includes(c)) depth--
    if (c === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  parts.push(cur)
  return parts.map((s) => s.split(':')[0].trim()).filter(Boolean)
}

/** The same split, keeping each parameter's TYPE as well as its name. */
function paramList(type) {
  const t = String(type).replace(/\s+/g, ' ')
  const open = t.indexOf('(')
  const close = t.lastIndexOf(') =>')
  if (open < 0 || close < 0) return []
  const parts = []
  let depth = 0
  let cur = ''
  for (const c of t.slice(open + 1, close)) {
    if ('{[(<'.includes(c)) depth++
    else if ('}])>'.includes(c)) depth--
    if (c === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  parts.push(cur)
  return parts
    .map((s) => {
      const i = s.indexOf(':')
      return i < 0 ? null : { name: s.slice(0, i).trim(), ts: s.slice(i + 1).trim() }
    })
    .filter((p) => p && p.name)
}

/**
 * A CustomEvent's `detail` type, written so it can be pasted into a wrapper
 * that knows nothing about the grid's generics.
 *
 * Without this every handler prop is `(detail: unknown) => void`, and every
 * example in the docs has to cast before it can read `newValue` - which is a
 * poor advertisement for a typed wrapper. The callback signatures already carry
 * the shape, so lift it.
 *
 * `TData` becomes `Record<string, unknown>`: a wrapper is not generic over the
 * row type, and a wrong concrete type would be worse than a loose one. Anything
 * still referring to a type that only exists inside `@svgrid/grid` degrades to
 * `unknown` rather than emitting a name the consumer cannot resolve.
 */
function detailType(type) {
  const params = paramList(type)
  if (params.length === 0) return 'unknown'
  const clean = (ts) => {
    const t = ts.replace(/\bTData\b/g, 'Record<string, unknown>').replace(/\bTFeatures\b/g, 'unknown')
    // Every capitalised identifier left must be one TypeScript itself provides.
    const known = /^(Array|ReadonlyArray|Record|Promise|Partial|Readonly|Date|Map|Set)$/
    const names = t.match(/\b[A-Z][A-Za-z0-9]*\b/g) ?? []
    return names.every((n) => known.test(n)) ? t : 'unknown'
  }
  if (params.length === 1) return clean(params[0].ts)
  return `{ ${params.map((p) => `${p.name}: ${clean(p.ts)}`).join('; ')} }`
}

/**
 * A TS type squeezed into a docs table cell. Inline object literals run to
 * hundreds of characters and carry JSDoc, which truncates mid-word and reads
 * like a bug in the generator. Collapse them to `{ ... }` and point the reader
 * at the typed API instead.
 */
function docType(ts) {
  const t = String(ts)
    .replace(/\/\*\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const collapsed = t.replace(/\{[^{}]{40,}\}/g, '{ ... }')
  return collapsed.length > 90 ? collapsed.slice(0, 87).trimEnd() + '...' : collapsed
}

/**
 * Events published BEFORE the surface was generated, whose detail must not
 * change under the generic rule. `<sv-grid>` 2.6.2 shipped exactly these two,
 * and silently altering what `e.detail` holds would break every consumer that
 * already reads them.
 *
 * `rowclick` is the only name that collides with a generated one, so it keeps
 * its published payload; anyone wanting rowIndex / columnId on a click has them
 * on `cellclick`, which carries the whole event.
 */
const LEGACY_EVENTS = [
  { event: 'rowclick', callback: 'onRowClick', pick: 'row',
    note: "published detail is the row, not the whole click event" },
  { event: 'selectionchange', callback: 'onRowSelectionChange', pick: 'rows',
    note: "published alias of rowselectionchange, detail is the selected rows" },
]

// ---------------------------------------------------------------------------

const src = readFileSync(TYPES, 'utf8')
const members = parseTypeMembers(src, 'Props')
if (members.length < 100) {
  // The parser silently returns [] when the type moves or is renamed. Emitting
  // an empty surface would look like a successful run and quietly re-break the
  // element, so refuse instead.
  console.error(
    `generate-surface: parsed only ${members.length} members of Props - expected 100+. ` +
      `Did SvGrid.types.ts change shape?`,
  )
  process.exit(1)
}

const props = []
const events = []
const excluded = []

/**
 * `parseTypeMembers` caps a member's type at 120 characters, which is fine for
 * the MCP manifests it was written for and wrong here: a truncated type cuts
 * `onFiltersChange` before its `) =>` (so it reported NO parameters), and cuts
 * `treeData` and `serverGroup` mid-JSDoc (so the docs table showed a dangling
 * comment). `rawTypeOf` reads the whole declaration out of the source, so use
 * it whenever the parse has hit the cap.
 */
const stripDoc = (t) =>
  String(t)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const fullType = (m) => {
  // Compared with comments stripped from BOTH, because rawTypeOf already
  // strips them: a parsed type still carrying its JSDoc looks longer than the
  // complete declaration and wins on a raw length test, which put `treeData`'s
  // dangling comment back into the docs table.
  const parsed = stripDoc(m.type ?? '')
  const raw = rawTypeOf(src, m.name)
  // The longer of the two, rather than testing for the parser's 120-character
  // cap: the cap applies BEFORE trimming, so a type can arrive at 118
  // characters and still be truncated - which is how `onFiltersChange` kept
  // losing its `) =>` and reporting no parameters.
  return raw.length > parsed.length ? raw : parsed
}

for (const m of members) {
  if (/^on[A-Z]/.test(m.name)) {
    const t = fullType(m)
    events.push({
      callback: m.name,
      event: eventName(m.name),
      params: paramNames(t),
      detail: detailType(t),
    })
    continue
  }
  if (EXCLUDED[m.name]) {
    excluded.push({ name: m.name, reason: EXCLUDED[m.name] })
    continue
  }
  const type = fullType(m)
  if (!type) {
    console.error(`generate-surface: no type found for prop \`${m.name}\` - refusing to guess.`)
    process.exit(1)
  }
  const { type: ceType, attribute } = classify(type)
  props.push({ name: m.name, type: ceType, attribute: attribute ? kebab(m.name) : null, ts: type })
}

const banner = `/**
 * AUTO-GENERATED by scripts/generate-surface.mjs - DO NOT EDIT.
 * Regenerate: pnpm --filter @svgrid/grid-wc generate:surface
 *
 * The full prop + event surface of <SvGrid>, extracted from its own \`Props\`
 * type in packages/grid/src/SvGrid.types.ts, so the custom elements expose what
 * the grid actually has rather than a hand-kept subset that drifts.
 *
 * \`attribute\` is null for props that cannot be one. An HTML attribute is a
 * string, so arrays, objects and functions are settable only as PROPERTIES
 * (\`el.columns = [...]\`). Primitives get a kebab-case attribute as well.
 */
`

const output =
  banner +
  `export const ELEMENT_PROPS = ${JSON.stringify(props, null, 2)}\n\n` +
  `export const ELEMENT_EVENTS = ${JSON.stringify(events, null, 2)}\n\n` +
  `/** Events published before this file existed, whose detail must not change. */\n` +
  `export const LEGACY_EVENTS = ${JSON.stringify(LEGACY_EVENTS, null, 2)}\n\n` +
  `/** Props deliberately not exposed, and why. */\n` +
  `export const ELEMENT_EXCLUDED = ${JSON.stringify(excluded, null, 2)}\n`

/**
 * The element files carry the SAME prop list a second time, inside
 * `<svelte:options customElement={{ props: ... }}>`.
 *
 * Not a duplication anyone chose. Svelte requires that block to be a
 * "statically analyzable object literal" - referencing the generated import
 * fails the build outright - and the value is read at compile time, so no
 * runtime wiring can supply it. The generator therefore writes the literal INTO
 * each element between markers, and the region is regenerated, never edited.
 */
const ELEMENT_FILES = ['sv-grid-element.svelte', 'sv-grid-shadow-element.svelte']
const BEGIN = '      /* BEGIN generated props - see scripts/generate-surface.mjs */'
const END = '      /* END generated props */'

/**
 * The docs reference page carries the same list a THIRD time, for readers.
 * Generated for the same reason as the rest: a hand-written table of 98 props
 * is stale the week after it is written, and the old page's claim that
 * "grouping, sorting, pagination all come along" was exactly that.
 */
const DOC = join(here, '..', '..', '..', 'docs', 'help', 'web-components', 'sv-grid.md')
const DOC_BEGIN = '<!-- BEGIN generated reference - packages/grid-wc/scripts/generate-surface.mjs -->'
const DOC_END = '<!-- END generated reference -->'

function docTables(eol) {
  const attr = props.filter((p) => p.attribute)
  const only = props.filter((p) => !p.attribute)
  const cell = (t) => `\`${docType(t).replace(/\|/g, '\\|')}\``

  // What a listener actually receives. For the two events published before the
  // generic rule, that is NOT the callback's argument - `rowclick` carries the
  // row, not the click event - and a table saying otherwise would be the same
  // class of wrong doc this whole generator exists to prevent.
  const detailOf = (e) => {
    const legacy = LEGACY_EVENTS.find((l) => l.event === e.event && l.callback === e.callback)
    if (legacy) return `\`${legacy.pick}\` - ${legacy.note}`
    return e.params.length > 1 ? `\`{ ${e.params.join(', ')} }\`` : `\`${e.params[0] ?? 'void'}\``
  }

  const lines = [
    DOC_BEGIN,
    '',
    `### Attributes (${attr.length})`,
    '',
    'Primitives, so they work in plain HTML as well as through a property.',
    '',
    '| Attribute | Property | Type |',
    '| --- | --- | --- |',
    ...attr.map((p) => `| \`${p.attribute}\` | \`${p.name}\` | ${cell(p.ts)} |`),
    '',
    `### Properties only (${only.length})`,
    '',
    'Arrays, objects and functions. An HTML attribute is a string, so these can',
    'only be assigned in script: `el.columns = [...]`.',
    '',
    '| Property | Type |',
    '| --- | --- |',
    ...only.map((p) => `| \`${p.name}\` | ${cell(p.ts)} |`),
    '',
    `### Events (${events.length})`,
    '',
    "`detail` is the callback's argument. The one callback that takes two carries",
    'an object keyed by its parameter names.',
    '',
    '| Event | From | `detail` |',
    '| --- | --- | --- |',
    ...events.map((e) => `| \`${e.event}\` | \`${e.callback}\` | ${detailOf(e)} |`),
    '',
    ...(LEGACY_EVENTS.some((l) => !events.some((e) => e.event === l.event))
      ? [
          'Plus one alias kept from before the surface was generated:',
          '',
          '| Event | From | `detail` |',
          '| --- | --- | --- |',
          ...LEGACY_EVENTS.filter((l) => !events.some((e) => e.event === l.event)).map(
            (l) => `| \`${l.event}\` | \`${l.callback}\` | \`${l.pick}\` - ${l.note} |`,
          ),
          '',
        ]
      : []),
    `### Not exposed (${excluded.length})`,
    '',
    '| Prop | Why |',
    '| --- | --- |',
    ...excluded.map((e) => `| \`${e.name}\` | ${e.reason} |`),
    '',
    DOC_END,
  ]
  return lines.join(eol)
}

function injectDoc() {
  const text = readFileSync(DOC, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const start = text.indexOf(DOC_BEGIN)
  const stop = text.indexOf(DOC_END)
  if (start < 0 || stop < 0)
    throw new Error('generate-surface: markers missing in docs/help/web-components/sv-grid.md')
  return { text, next: text.slice(0, start) + docTables(eol) + text.slice(stop + DOC_END.length) }
}

function propsLiteral(eol) {
  const lines = props.map((p) => {
    const attr = p.attribute ? `, attribute: '${p.attribute}'` : ''
    return `      ${p.name}: { type: '${p.type}'${attr} },`
  })
  return [BEGIN, ...lines, END].join(eol)
}

function injectInto(file) {
  const path = join(here, '..', 'src', file)
  const text = readFileSync(path, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const start = text.indexOf(BEGIN)
  const stop = text.indexOf(END)
  if (start < 0 || stop < 0)
    throw new Error(`generate-surface: markers missing in ${file}. Restore them before regenerating.`)
  return {
    path,
    text,
    next: text.slice(0, start) + propsLiteral(eol) + text.slice(stop + END.length),
  }
}

if (process.argv.includes('--check')) {
  for (const file of ELEMENT_FILES) {
    const { text, next } = injectInto(file)
    if (text.replace(/\r\n/g, '\n') !== next.replace(/\r\n/g, '\n')) {
      console.error(
        `generate-surface: ${file}'s generated props block is STALE. ` +
          `Run: pnpm --filter @svgrid/grid-wc generate:surface`,
      )
      process.exit(1)
    }
  }
  if (existsSync(DOC)) {
    const { text, next } = injectDoc()
    if (text.replace(/\r\n/g, '\n') !== next.replace(/\r\n/g, '\n')) {
      console.error(
        "generate-surface: docs/help/web-components/sv-grid.md is STALE. " +
          "Run: pnpm --filter @svgrid/grid-wc generate:surface",
      )
      process.exit(1)
    }
  }
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    /* missing counts as stale */
  }
  // Compare on normalised newlines: a Windows checkout gives the committed file
  // CRLF while this script always emits LF, which otherwise reports a false
  // STALE on content that matches. Same trap as extract-ui-props.mjs.
  if (current.replace(/\r\n/g, '\n') !== output.replace(/\r\n/g, '\n')) {
    console.error(
      'generate-surface: surface.generated.js is STALE. Run: pnpm --filter @svgrid/grid-wc generate:surface',
    )
    process.exit(1)
  }
  console.log('generate-surface: generated file is current')
} else {
  writeFileSync(OUT, output)
  for (const file of ELEMENT_FILES) {
    const { path, next } = injectInto(file)
    writeFileSync(path, next)
  }
  // The docs page is optional: the generator must still work in a checkout
  // where the reference page has not been created yet.
  if (existsSync(DOC)) writeFileSync(DOC, injectDoc().next)
  const attrs = props.filter((p) => p.attribute).length
  console.log(
    `generate-surface: ${props.length} props (${attrs} with an attribute, ` +
      `${props.length - attrs} property-only), ${events.length} events, ` +
      `${excluded.length} excluded -> src/surface.generated.js + ${ELEMENT_FILES.length} elements`,
  )
}
