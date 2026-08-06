/**
 * Extract the FULL prop + event surface of the UI-kit components registered in
 * Studio's component toolbox, from the components' own TypeScript `Props` types
 * in packages/grid/src. Emits src/studio/ui-components.generated.ts.
 *
 * Why extraction instead of hand-transcription: the property panel promises ALL
 * props of a component with guidance tooltips; hand-copied lists drift the moment
 * the kit evolves. Here the panel's rows and tooltip text come straight from the
 * component source - the JSDoc comment on each prop IS the tooltip.
 *
 * Run: node scripts/extract-ui-props.mjs   (wired as `npm run extract:ui-props`)
 * A vitest asserts the generated file is current (regen + diff).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const GRID_SRC = resolve(here, '../../grid/src')
const OUT = resolve(here, '../src/studio/ui-components.generated.ts')

/** Every importName the registry references (current + wave-1 additions). The
 *  registry test asserts this list covers the registry, so a new registration
 *  without extraction fails loudly. */
const COMPONENTS = [
  // current registry
  'SvButton', 'SvBadge', 'SvAlert', 'SvProgress', 'SvCard', 'SvDivider', 'SvAvatar',
  'SvStat', 'SvToggleButton', 'SvSwitchButton', 'SvTextInput', 'SvTextArea', 'SvNumberInput',
  'SvPasswordInput', 'SvColorInput', 'SvCheckBox', 'SvRating', 'SvSlider', 'SvOtpInput',
  'SvCircularProgress', 'SvSkeleton', 'SvChip', 'SvEmptyState', 'SvTimeline', 'SvSparkline',
  'SvAvatarGroup', 'SvPagination', 'SvBreadcrumb', 'SvStepper',
  // wave 1 additions
  'SvMaskedInput', 'SvPhoneInput', 'SvTagsInput', 'SvDurationInput', 'SvRadioGroup',
  'SvButtonGroup', 'SvListBox', 'SvDropDownList', 'SvComboBox', 'SvAutoComplete',
  'SvMultiSelect', 'SvRepeatButton', 'SvRichText', 'SvTree', 'SvCountryInput',
]

/** Shared prop-type sources resolved for `Props = X & {...}` intersections and
 *  named union aliases (EditorSize etc.). Parsed once, merged by name. */
const SHARED_TYPE_FILES = ['editor-contract.ts', 'editors/cell-editors.ts']

// --- tiny helpers -----------------------------------------------------------

const titleCase = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())

/** Panel group heuristic; overrides in the registry can re-tag. */
function groupFor(key) {
  if (/^(variant|size|color|pill|dot|striped|soft|block|shape|orientation|align|icon|rounded|elevated|bordered)$/.test(key)) return 'appearance'
  if (/^(disabled|readonly|required|invalid|loading|dismissible|clearable|searchable|multiple|unique|closable)$/.test(key)) return 'behavior'
  if (/^(id|name|ariaLabel|dir|form|autocomplete|tabindex)$/.test(key)) return 'advanced'
  return 'common'
}

/** Extract the instance `<script lang="ts">` body (not `context="module"`). */
function scriptOf(svelteSource) {
  const re = /<script\b[^>]*>/g
  let m
  while ((m = re.exec(svelteSource))) {
    if (/context\s*=\s*["']module["']|\bmodule\b/.test(m[0]) && /context|(^|\s)module(\s|>)/.test(m[0]) && m[0].includes('module')) continue
    const start = m.index + m[0].length
    const end = svelteSource.indexOf('</script>', start)
    if (end !== -1) return svelteSource.slice(start, end)
  }
  return ''
}

// --- type classification ----------------------------------------------------

/** All string-literal members of a union type node, or null. */
function literalUnion(node, aliases) {
  const literals = []
  const walk = (n) => {
    if (ts.isUnionTypeNode(n)) return n.types.every(walk)
    if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal)) {
      literals.push(n.literal.text)
      return true
    }
    // undefined / null members are tolerated (optional props)
    if (n.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isLiteralTypeNode(n) && n.literal.kind === ts.SyntaxKind.NullKeyword)) return true
    if (ts.isTypeReferenceNode(n)) {
      const target = aliases.get(n.typeName.getText())
      return target ? walk(target) : false
    }
    return false
  }
  return walk(node) && literals.length ? literals : null
}

/** Classify a prop's type node -> { kind: UiPropType | 'event' | 'skip', options? } */
function classify(name, node, aliases) {
  if (!node) return { kind: 'skip' }
  if (ts.isParenthesizedTypeNode(node)) return classify(name, node.type, aliases)
  if (ts.isFunctionTypeNode(node)) return /^on[a-zA-Z]/.test(name) ? { kind: 'event' } : { kind: 'skip' }
  if (ts.isUnionTypeNode(node)) {
    const options = literalUnion(node, aliases)
    if (options) return { kind: 'select', options }
    // union of non-literals: try the first useful member (e.g. `string | number`)
    for (const t of node.types) {
      const c = classify(name, t, aliases)
      if (c.kind !== 'skip') return c
    }
    return { kind: 'skip' }
  }
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: 'string' }
    case ts.SyntaxKind.NumberKeyword:
      return { kind: 'number' }
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: 'boolean' }
  }
  if (ts.isArrayTypeNode(node) || ts.isTypeLiteralNode(node) || ts.isTupleTypeNode(node)) return { kind: 'json' }
  if (ts.isTypeReferenceNode(node)) {
    const ref = node.typeName.getText()
    if (ref === 'Snippet') return { kind: 'skip' }
    if (ref === 'Date') return { kind: 'date' }
    if (/^(Partial|Record|Array|ReadonlyArray|Map|Set)$/.test(ref)) return { kind: 'json' }
    const target = aliases.get(ref)
    if (target) return classify(name, target, aliases)
    return { kind: 'json' } // unknown named object type - editable as JSON
  }
  return { kind: 'skip' }
}

// --- Props resolution --------------------------------------------------------

/** Collect `type X = ...` aliases (as type nodes) from a source file. */
function collectAliases(sf, into) {
  sf.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n)) into.set(n.name.text, n.type)
  })
  return into
}

/** Property signatures of a type node, resolving intersections + known aliases
 *  + Omit<X, 'k1' | 'k2'>. Returns Array<{ name, node, optional, doc }>. */
function membersOf(node, aliases, omit = new Set()) {
  if (!node) return []
  if (ts.isParenthesizedTypeNode(node)) return membersOf(node.type, aliases, omit)
  if (ts.isIntersectionTypeNode(node)) return node.types.flatMap((t) => membersOf(t, aliases, omit))
  if (ts.isTypeLiteralNode(node)) {
    return node.members
      .filter(ts.isPropertySignature)
      .filter((m) => m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)))
      .map((m) => ({
        name: ts.isIdentifier(m.name) ? m.name.text : m.name.text,
        node: m.type,
        optional: !!m.questionToken,
        doc: docOf(m),
      }))
      .filter((m) => !omit.has(m.name))
  }
  if (ts.isTypeReferenceNode(node)) {
    const ref = node.typeName.getText()
    if (ref === 'Omit' && node.typeArguments?.length === 2) {
      const dropped = new Set(omit)
      const keys = literalUnion(node.typeArguments[1], aliases) ?? []
      for (const k of keys) dropped.add(k)
      return membersOf(node.typeArguments[0], aliases, dropped)
    }
    const target = aliases.get(ref)
    return target ? membersOf(target, aliases, omit) : []
  }
  return []
}

/** JSDoc text of a member (first comment), single line. */
function docOf(member) {
  const docs = ts.getJSDocCommentsAndTags(member)
  for (const d of docs) {
    if (ts.isJSDoc(d) && d.comment) {
      const text = typeof d.comment === 'string' ? d.comment : d.comment.map((c) => c.text ?? '').join('')
      return text.replace(/\s+/g, ' ').trim()
    }
  }
  return undefined
}

/** Literal defaults from the `let { a = 1, b = 'x' }: Props = $props()` pattern. */
function defaultsOf(sf) {
  const out = new Map()
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && n.initializer && n.initializer.getText().includes('$props()') && ts.isObjectBindingPattern(n.name)) {
      for (const el of n.name.elements) {
        if (!ts.isIdentifier(el.name) || !el.initializer) continue
        const init = el.initializer
        if (ts.isStringLiteral(init)) out.set(el.name.text, init.text)
        else if (ts.isNumericLiteral(init)) out.set(el.name.text, Number(init.text))
        else if (init.kind === ts.SyntaxKind.TrueKeyword) out.set(el.name.text, true)
        else if (init.kind === ts.SyntaxKind.FalseKeyword) out.set(el.name.text, false)
      }
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

// --- main -------------------------------------------------------------------

const sharedAliases = new Map()
for (const rel of SHARED_TYPE_FILES) {
  try {
    const sf = ts.createSourceFile(rel, readFileSync(join(GRID_SRC, rel), 'utf8'), ts.ScriptTarget.Latest, true)
    collectAliases(sf, sharedAliases)
  } catch {
    /* optional shared file */
  }
}

const eventKey = (propName) => {
  const stripped = propName.replace(/^on/, '')
  return stripped.charAt(0).toLowerCase() + stripped.slice(1)
}

const result = {}
const problems = []
for (const name of COMPONENTS) {
  let source
  try {
    source = readFileSync(join(GRID_SRC, `${name}.svelte`), 'utf8')
  } catch {
    problems.push(`${name}: component file not found`)
    continue
  }
  const script = scriptOf(source)
  const sf = ts.createSourceFile(`${name}.ts`, script, ts.ScriptTarget.Latest, true)
  const aliases = collectAliases(sf, new Map(sharedAliases))
  const propsType = aliases.get('Props')
  if (!propsType) {
    problems.push(`${name}: no \`type Props\` found`)
    continue
  }
  const defaults = defaultsOf(sf)
  const props = []
  const events = []
  for (const m of membersOf(propsType, aliases)) {
    const c = classify(m.name, m.node, aliases)
    if (c.kind === 'skip') continue
    if (c.kind === 'event') {
      events.push({ key: eventKey(m.name), label: titleCase(eventKey(m.name)), prop: m.name, ...(m.doc ? { description: m.doc } : {}) })
      continue
    }
    props.push({
      key: m.name,
      label: titleCase(m.name),
      type: c.kind,
      ...(c.options ? { options: c.options } : {}),
      ...(defaults.has(m.name) ? { default: defaults.get(m.name) } : {}),
      ...(m.doc ? { description: m.doc } : {}),
      group: groupFor(m.name),
    })
  }
  result[name] = { props, events }
}

if (problems.length) {
  console.error('extract-ui-props: unresolved components:\n  ' + problems.join('\n  '))
  process.exit(1)
}

const banner = `/**
 * AUTO-GENERATED by scripts/extract-ui-props.mjs - DO NOT EDIT.
 * Regenerate: npm run extract:ui-props (packages/enterprise).
 *
 * The full prop + event surface of every toolbox component, extracted from the
 * components' own \`Props\` types in packages/grid/src. \`description\` is the
 * prop's JSDoc comment - it renders as the property panel's guidance tooltip.
 */

export type GeneratedUiProp = {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'json' | 'date'
  options?: string[]
  default?: unknown
  description?: string
  group?: 'common' | 'appearance' | 'behavior' | 'advanced'
}

export type GeneratedUiEvent = { key: string; label: string; prop: string; description?: string }

export const GENERATED_UI_SURFACE: Record<string, { props: GeneratedUiProp[]; events: GeneratedUiEvent[] }> = `

const output = banner + JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--check')) {
  // Freshness gate (used by the test suite): fail when the generated file does
  // not match a fresh extraction - i.e. the kit's props changed but the panel's
  // surface wasn't regenerated.
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    /* missing counts as stale */
  }
  if (current !== output) {
    console.error('extract-ui-props: ui-components.generated.ts is STALE. Run: node scripts/extract-ui-props.mjs')
    process.exit(1)
  }
  console.log('extract-ui-props: generated file is current')
} else {
  writeFileSync(OUT, output)
  const total = Object.values(result).reduce((n, c) => n + c.props.length, 0)
  const totalEv = Object.values(result).reduce((n, c) => n + c.events.length, 0)
  console.log(`extract-ui-props: ${Object.keys(result).length} components, ${total} props, ${totalEv} events -> src/studio/ui-components.generated.ts`)
}
