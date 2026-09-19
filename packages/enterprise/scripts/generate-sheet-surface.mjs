/**
 * Generate the <sv-sheet> custom element's prop + event surface from
 * `<SvSheet>`'s own `Props` type, the way @svgrid/grid-wc generates the
 * grid's and the chart's. One source, five consumers: the element's
 * `<svelte:options>` props literal, the surface module the body reads
 * events from, the element's type declarations, the React and Vue
 * wrappers, and the tables on the docs page. A hand-kept list is what
 * lets a prop land on the component and never reach the element.
 *
 * Usage:
 *   node scripts/generate-sheet-surface.mjs           write everything
 *   node scripts/generate-sheet-surface.mjs --check   fail if anything is stale (CI, the tests)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseTypeMembers } from '../../mcp/scripts/api-surface.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..')
const SHEET = join(pkg, 'src', 'SvSheet.svelte')
const WC = join(pkg, 'src', 'wc')
const WRAPPERS = join(pkg, 'wc')
const DOC = join(pkg, '..', '..', 'docs', 'help', 'web-components', 'sv-sheet.md')
const CHECK = process.argv.includes('--check')

/** The shell's script, with its Props type exported so the shared parser finds it. */
export function sheetPropsSource() {
  const svelte = readFileSync(SHEET, 'utf8')
  const script = /<script lang="ts">([\s\S]*?)<\/script>/.exec(svelte)?.[1] ?? ''
  return script.replace(/\n(\s*)type Props = \{/, '\n$1export type Props = {')
}

/** Split a union at top level only. */
function splitUnion(t) {
  const out = []
  let depth = 0
  let cur = ''
  for (const c of t.replace(/^\s*\|/, '')) {
    if ('{[(<'.includes(c)) depth++
    else if ('}])>'.includes(c)) depth--
    if (c === '|' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter(Boolean)
}

/**
 * A prop's custom-element type and whether it can be an attribute. An
 * attribute is a string, so a prop that takes a string or a string literal
 * keeps a String attribute whatever else it takes (`height` is a number or
 * '100%'); booleans and numbers get theirs; arrays, objects and functions
 * are property-only.
 */
function classify(type) {
  const parts = splitUnion(type.replace(/\s+/g, ' ').trim())
  const has = (re) => parts.some((p) => re.test(p))
  if (has(/^string$/) || has(/^['"].*['"]$/)) return { type: 'String', attribute: true }
  if (has(/^boolean$/)) return { type: 'Boolean', attribute: true }
  if (has(/^number$/)) return { type: 'Number', attribute: true }
  if (has(/^(ReadonlyArray|Array)</) || has(/\[\]$/)) return { type: 'Array', attribute: false }
  return { type: 'Object', attribute: false }
}

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const eventName = (cb) => cb.replace(/^on/, '').toLowerCase()

/** The full type of a member, read back out of the source when the parser truncated it. */
function rawTypeOf(src, name) {
  const from = src.search(/export\s+type\s+Props\b/)
  const m = new RegExp(`^[ \\t]*${name}\\??\\s*:`, 'm').exec(src.slice(from))
  if (!m) return ''
  let i = from + m.index + m[0].length
  let depth = 0
  let out = ''
  for (; i < src.length; i++) {
    const c = src[i]
    if ('{[('.includes(c)) depth++
    else if ('}])'.includes(c)) { if (depth === 0) break; depth-- }
    else if (depth === 0 && c === '\n') {
      const ahead = src.slice(i + 1).replace(/^\s*/, '')
      if (/^(\/\*|\/\/|\}|[A-Za-z_$][\w$]*\??\s*:)/.test(ahead)) break
    }
    out += c
  }
  return out.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim()
}

function paramNames(type) {
  const t = type.replace(/\s+/g, ' ')
  const open = t.indexOf('(')
  const close = t.lastIndexOf(') =>')
  if (open < 0 || close < 0) return []
  return t.slice(open + 1, close).split(',').map((s) => s.split(':')[0].trim()).filter(Boolean)
}

export function collect() {
  const src = sheetPropsSource()
  const members = parseTypeMembers(src, 'Props')
  if (members.length < 15) {
    console.error(`generate-sheet-surface: parsed only ${members.length} members of Props - did SvSheet.svelte change shape?`)
    process.exit(1)
  }
  const props = []
  const events = []
  for (const m of members) {
    const raw = rawTypeOf(src, m.name)
    const parsed = String(m.type ?? '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').trim()
    const type = raw.length > parsed.length ? raw : parsed
    if (!type) { console.error(`generate-sheet-surface: no type for ${m.name}`); process.exit(1) }
    if (/^on[A-Z]/.test(m.name)) {
      events.push({ callback: m.name, event: eventName(m.name), params: paramNames(type), ts: type })
      continue
    }
    const { type: ceType, attribute } = classify(type)
    props.push({ name: m.name, type: ceType, attribute: attribute ? kebab(m.name) : null, ts: type })
  }
  return { props, events }
}

/** The methods the element mirrors from the component, for the types and the docs. */
export const METHODS = [
  ['getState', '(): SheetState', 'The document as plain JSON.'],
  ['setState', '(state: SheetState): void', 'Put a saved document back.'],
  ['refresh', '(): void', 'Repaint after a write the shell could not see.'],
  ['act', '(action: RibbonActionId): void', 'Run a ribbon action as if its button had been clicked.'],
  ['open', '(file: Blob & { name?: string }): Promise<void>', 'Replace the document with an .xlsx, .ods or .csv file.'],
  ['toXlsx', '(): Promise<Blob>', 'The document as an .xlsx Blob.'],
  ['toOds', '(): Promise<Blob>', 'The document as an .ods Blob, which LibreOffice Calc opens.'],
  ['toXls', '(): Blob', 'The document as an .xls Blob, which Excel 97-2003 opens.'],
  ['toCsv', '(): string', 'The active sheet as CSV.'],
  ['newWorkbook', '(): void', 'Start over with one empty sheet.'],
  ['print', '(): void', 'The active sheet in the print dialog.'],
  ['printHtml', '(): string', 'The page File > Print would open.'],
]

const BANNER = (what) => `/**
 * AUTO-GENERATED by scripts/generate-sheet-surface.mjs - DO NOT EDIT.
 * Regenerate: pnpm --filter @svgrid/enterprise generate:wc
 *
 * ${what}
 */`

function surfaceModule({ props, events }) {
  return `${BANNER("The full prop + event surface of <SvSheet>, extracted from its own `Props` type in src/SvSheet.svelte, so the element exposes what the component has rather than a hand-kept subset. `attribute` is null for a prop that cannot be one: an HTML attribute is a string, so arrays, objects and functions are settable only as properties.")}
export const ELEMENT_PROPS = ${JSON.stringify(props, null, 2)}

export const ELEMENT_EVENTS = ${JSON.stringify(events, null, 2)}

/** The component's methods the element mirrors onto itself. */
export const ELEMENT_METHODS = ${JSON.stringify(METHODS.map(([name]) => name))}
`
}

const BEGIN = '      /* BEGIN generated props - see scripts/generate-sheet-surface.mjs */'
const END = '      /* END generated props */'

function elementProps(props) {
  const lines = props.map((p) => `      ${p.name}: { type: '${p.type}'${p.attribute ? `, attribute: '${p.attribute}'` : ''} },`)
  return [BEGIN, ...lines, END].join('\n')
}

function tsType(p) {
  const t = p.ts
  if (/^boolean$/.test(t)) return 'boolean'
  if (/^number$/.test(t)) return 'number'
  if (/^string$/.test(t)) return 'string'
  if (/^(['"][^'"]*['"]\s*\|\s*)*['"][^'"]*['"]$/.test(t)) return t.replace(/'/g, '"')
  if (/^number \| '100%'$/.test(t)) return 'number | "100%"'
  if (p.type === 'Array') return 'readonly unknown[]'
  if (p.type === 'Number') return 'number'
  if (p.type === 'String') return 'string'
  if (p.type === 'Boolean') return 'boolean'
  return 'unknown'
}

function elementTypes({ props, events }) {
  return `${BANNER('Type declarations for the <sv-sheet> custom element.')}

/**
 * The element's own surface. The document, the workbook and the formats
 * are \`unknown\` here rather than wrong: import their types from
 * \`@svgrid/enterprise\` when you want them checked.
 */
export interface SvSheetElement extends HTMLElement {
${props.map((p) => `  /** ${p.attribute ? `attribute \`${p.attribute}\`` : 'property only - an attribute cannot hold this'} */\n  ${p.name}: ${tsType(p)}`).join('\n')}
  /** The grid api, set before \`ready\` fires. */
  api: unknown
  /** The sheet document, set before \`ready\` fires. */
  document: unknown
${METHODS.map(([name, sig, doc]) => `  /** ${doc} */\n  ${name}${sig}`).join('\n')}
}

/** \`detail\` of each event. \`action\` is cancelable: \`preventDefault()\` takes the action over, as returning true from \`onAction\` does. */
export interface SvSheetEventMap {
${events.map((e) => `  ${e.event}: CustomEvent<${e.params.length > 1 ? `{ ${e.params.map((p) => `${p}: unknown`).join('; ')} }` : 'unknown'}>`).join('\n')}
}

declare global {
  interface HTMLElementTagNameMap {
    'sv-sheet': SvSheetElement
  }
}
`
}

function reactWrapper({ props, events }) {
  const handler = (e) => `on${e.event[0].toUpperCase()}${e.event.slice(1)}`
  return `${BANNER('React wrapper for <sv-sheet>. Assigns object props (the document above all) as properties, which React <=18 would otherwise stringify onto attributes; the methods are reachable through the ref.')}
import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import '@svgrid/enterprise/wc'

export interface SvSheetProps {
${props.map((p) => `  /** \`${p.attribute ?? 'property only'}\` - ${p.ts.slice(0, 90)} */\n  ${p.name}?: ${tsType(p)}`).join('\n')}

${events.map((e) => `  /** \`${e.event}\`${e.event === 'action' ? ' - call event.preventDefault() to take the action over' : ''} */\n  ${handler(e)}?: (detail: ${e.params.length > 1 ? `{ ${e.params.map((p) => `${p}: unknown`).join('; ')} }` : 'unknown'}, event: CustomEvent) => void`).join('\n')}

  className?: string
  style?: Record<string, string | number>
}

/** The element itself, with the sheet's methods on it. */
export interface SvSheetHandle {
  element: (HTMLElement & Record<string, unknown>) | null
}

const PROP_NAMES = ${JSON.stringify(props.map((p) => p.name))} as const
const EVENTS: Array<[handler: string, event: string]> = ${JSON.stringify(events.map((e) => [handler(e), e.event]))}

export const SvSheet = forwardRef(function SvSheet(props: SvSheetProps, ref: Ref<SvSheetHandle>) {
  const hostRef = useRef<HTMLElement | null>(null)
  const { className, style, ...rest } = props

  const written = useRef<Record<string, unknown>>({})
  useEffect(() => {
    const el = hostRef.current as (HTMLElement & Record<string, unknown>) | null
    if (!el) return
    for (const name of PROP_NAMES) {
      const value = (rest as Record<string, unknown>)[name]
      if (value === undefined || Object.is(written.current[name], value)) continue
      written.current[name] = value
      el[name] = value
    }
  })

  const handlers = useRef(rest as Record<string, unknown>)
  handlers.current = rest as Record<string, unknown>

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const bound: Array<[string, EventListener]> = []
    for (const [handler, event] of EVENTS) {
      const listener: EventListener = (e) => {
        const fn = handlers.current[handler] as ((detail: unknown, event: CustomEvent) => void) | undefined
        fn?.((e as CustomEvent).detail, e as CustomEvent)
      }
      el.addEventListener(event, listener)
      bound.push([event, listener])
    }
    // \`ready\` fires during the element's own mount, before React binds: replay it.
    const onReady = handlers.current.onReady as ((detail: unknown, event: CustomEvent) => void) | undefined
    const api = (el as HTMLElement & { api?: unknown; document?: unknown }).api
    if (onReady && api != null) onReady({ api, document: (el as HTMLElement & { document?: unknown }).document }, new CustomEvent('ready'))
    return () => { for (const [event, listener] of bound) el.removeEventListener(event, listener) }
  }, [])

  useImperativeHandle(ref, () => ({
    get element() { return hostRef.current as (HTMLElement & Record<string, unknown>) | null },
  }), [])

  return createElement('sv-sheet', { ref: hostRef, class: className, style: { display: 'block', ...style } })
})

export default SvSheet
`
}

function vueWrapper({ props, events }) {
  return `${BANNER('Vue wrapper for <sv-sheet>. Forwards every prop as a DOM property, so the document arrives intact; the methods are on the exposed element.')}
import { defineComponent, h, onMounted, ref } from 'vue'
import type { PropType } from 'vue'
import '@svgrid/enterprise/wc'

const PROP_NAMES = ${JSON.stringify(props.map((p) => p.name))} as const
const EVENT_NAMES = ${JSON.stringify(events.map((e) => e.event))} as const

export type SvSheetProps = {
${props.map((p) => `  ${p.name}?: ${tsType(p)}`).join('\n')}
}

export const SvSheet = defineComponent({
  name: 'SvSheet',
  props: Object.fromEntries(PROP_NAMES.map((n) => [n, { type: null as unknown as PropType<unknown>, required: false }])),
  emits: [...EVENT_NAMES],
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement | null>(null)
    onMounted(() => {
      const el = host.value
      if (!el) return
      for (const name of EVENT_NAMES) el.addEventListener(name, (e) => emit(name, (e as CustomEvent).detail, e))
      const api = (el as HTMLElement & { api?: unknown; document?: unknown }).api
      if (api != null) emit('ready', { api, document: (el as HTMLElement & { document?: unknown }).document })
    })
    expose({
      get element() { return host.value as (HTMLElement & Record<string, unknown>) | null },
    })
    return () => {
      const attrs: Record<string, unknown> = { ref: host, style: { display: 'block' } }
      for (const name of PROP_NAMES) {
        const value = (props as Record<string, unknown>)[name]
        if (value !== undefined) attrs['.' + name] = value
      }
      return h('sv-sheet', attrs)
    }
  },
})

export default SvSheet
`
}

function reactTypes({ props, events }) {
  const handler = (e) => `on${e.event[0].toUpperCase()}${e.event.slice(1)}`
  return `${BANNER('Declarations for the React wrapper.')}
import type { ForwardRefExoticComponent, RefAttributes } from 'react'
export interface SvSheetProps {
${props.map((p) => `  ${p.name}?: ${tsType(p)}`).join('\n')}
${events.map((e) => `  ${handler(e)}?: (detail: ${e.params.length > 1 ? `{ ${e.params.map((p) => `${p}: unknown`).join('; ')} }` : 'unknown'}, event: CustomEvent) => void`).join('\n')}
  className?: string
  style?: Record<string, string | number>
}
export interface SvSheetHandle {
  element: (HTMLElement & Record<string, unknown>) | null
}
export declare const SvSheet: ForwardRefExoticComponent<SvSheetProps & RefAttributes<SvSheetHandle>>
export default SvSheet
`
}

function vueTypes({ props }) {
  return `${BANNER('Declarations for the Vue wrapper.')}
import type { DefineComponent } from 'vue'
export type SvSheetProps = {
${props.map((p) => `  ${p.name}?: ${tsType(p)}`).join('\n')}
}
export declare const SvSheet: DefineComponent<SvSheetProps>
export default SvSheet
`
}

const DOC_BEGIN = '<!-- BEGIN generated reference - packages/enterprise/scripts/generate-sheet-surface.mjs -->'
const DOC_END = '<!-- END generated reference -->'

function docTables({ props, events }) {
  const attr = props.filter((p) => p.attribute)
  const only = props.filter((p) => !p.attribute)
  const cell = (t) => `\`${(t.length > 90 ? t.slice(0, 87).trimEnd() + '...' : t).replace(/\|/g, '\\|')}\``
  return [
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
    'only be assigned in script: `el.document = doc`.',
    '',
    '| Property | Type |',
    '| --- | --- |',
    ...only.map((p) => `| \`${p.name}\` | ${cell(p.ts)} |`),
    '',
    `### Events (${events.length})`,
    '',
    "`detail` is the callback's argument, or an object keyed by the parameter names",
    'when it takes more than one. `action` is cancelable: `event.preventDefault()`',
    'takes the action over, as returning `true` from `onAction` does.',
    '',
    '| Event | From | `detail` |',
    '| --- | --- | --- |',
    ...events.map((e) => `| \`${e.event}\` | \`${e.callback}\` | ${e.params.length > 1 ? `\`{ ${e.params.join(', ')} }\`` : `\`${e.params[0] ?? 'void'}\``} |`),
    '',
    `### Methods (${METHODS.length})`,
    '',
    "The component's own, on the element once `ready` has fired.",
    '',
    '| Method | What it does |',
    '| --- | --- |',
    ...METHODS.map(([name, sig, doc]) => `| \`${name}${sig.replace(/\|/g, '\\|')}\` | ${doc} |`),
    '',
    DOC_END,
  ].join('\n')
}

function replaceBetween(text, begin, end, body) {
  const a = text.indexOf(begin)
  const b = text.indexOf(end)
  if (a < 0 || b < 0) throw new Error(`markers missing: ${begin}`)
  return text.slice(0, a) + body + text.slice(b + end.length)
}

const surface = collect()
mkdirSync(join(WC, 'types'), { recursive: true })
mkdirSync(WRAPPERS, { recursive: true })
const eol = (path) => (existsSync(path) && readFileSync(path, 'utf8').includes('\r\n') ? '\r\n' : '\n')
const outputs = [
  [join(WC, 'surface-sheet.generated.js'), surfaceModule(surface)],
  [join(WC, 'types', 'sv-sheet-element.d.ts'), elementTypes(surface)],
  [join(WRAPPERS, 'react.ts'), reactWrapper(surface)],
  [join(WRAPPERS, 'vue.ts'), vueWrapper(surface)],
  [join(WRAPPERS, 'react.d.ts'), reactTypes(surface)],
  [join(WRAPPERS, 'vue.d.ts'), vueTypes(surface)],
]
const element = join(WC, 'sv-sheet-element.svelte')
outputs.push([element, replaceBetween(readFileSync(element, 'utf8'), BEGIN, END, elementProps(surface.props))])
outputs.push([DOC, replaceBetween(readFileSync(DOC, 'utf8'), DOC_BEGIN, DOC_END, docTables(surface))])

let stale = 0
for (const [path, content] of outputs) {
  const next = content.replace(/\r?\n/g, eol(path))
  const current = existsSync(path) ? readFileSync(path, 'utf8') : ''
  if (current === next) continue
  stale += 1
  if (CHECK) console.error(`generate-sheet-surface: ${path} is stale`)
  else writeFileSync(path, next)
}
if (CHECK && stale) process.exit(1)
if (!CHECK) console.log(`generate-sheet-surface: ${surface.props.length} props, ${surface.events.length} events, ${outputs.length} files`)
