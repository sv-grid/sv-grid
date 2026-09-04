/**
 * doc-snippet-preamble - write the import-only preamble a page needs.
 *
 * On the UI-component pages every block is a small usage sample -
 * `<SvBadge tone="success">Paid</SvBadge>` - and the only thing stopping it from
 * standing alone is the import line the prose never repeats. That is mechanical:
 * scan the page for the `Sv*` components it uses, emit one import, done. Eleven
 * blocks on help/ui-components/feedback.md become runnable from a single block.
 *
 * Pages whose blocks also need data (rows, columns, a row type) are NOT handled
 * here - those preambles are written by hand, because the sample data is a
 * judgement call.
 *
 *   node tools/doc-snippet-preamble.mjs --list        # pages this can fix
 *   node tools/doc-snippet-preamble.mjs --write       # insert them
 */
import { readFileSync, writeFileSync } from 'node:fs'
// @ts-expect-error - plain .mjs helper with a sibling .d.mts
import { extractFences } from './lib/md-snippets.mjs'
// @ts-expect-error - plain .mjs helper
import { loadDocs } from './demo-doc-coverage.mjs'

/**
 * Components the grid package exports - only the `export { default as X } from
 * './X.svelte'` lines.
 *
 * Matching any `Sv*` token in index.ts also picked up TYPES like `SvGridApi`,
 * and a preamble that does `import { SvGridApi }` teaches readers a value
 * import for a type. The `.svelte` re-export is the thing that actually means
 * "this is a component".
 */
export function exportedComponents(src = readFileSync('packages/grid/src/index.ts', 'utf-8')) {
  const names = new Set()
  for (const m of src.matchAll(/export\s*\{\s*default as (Sv[A-Z][A-Za-z0-9]*)/g)) {
    names.add(m[1])
  }
  return names
}

/** `Sv*` components a page's svelte blocks actually use. */
export function componentsUsedBy(file, raw) {
  const used = new Set()
  for (const fence of extractFences(file, raw)) {
    if (fence.lang !== 'svelte') continue
    if (fence.flags.has('nocheck') || fence.flags.has('preamble')) continue
    for (const m of fence.code.matchAll(/<(Sv[A-Z][A-Za-z0-9]*)\b/g)) used.add(m[1])
  }
  return used
}

/**
 * Identifiers a page's blocks reference that an import cannot supply - data,
 * columns, a row type. Their presence means the page needs a hand-written
 * preamble instead.
 */
export function needsData(file, raw) {
  for (const fence of extractFences(file, raw)) {
    if (fence.lang !== 'svelte') continue
    if (fence.flags.has('nocheck') || fence.flags.has('preamble')) continue
    const markup = fence.code.replace(/<script[\s\S]*?<\/script>/g, '')
    const hasScript = /<script/.test(fence.code)
    // A shorthand prop `{data}` or a bound expression `={rows}` in a block with
    // no script of its own is a reference the page has to satisfy.
    if (!hasScript && /[{=]\{?\s*(data|rows|columns|features|items|options|nodes)\b/.test(markup)) {
      return true
    }
  }
  return false
}

/**
 * Value type each component binds, so a generated `$state` initialiser is the
 * right shape. Anything not listed falls back to a string, which is what most
 * of the text-ish controls want.
 */
const VALUE_TYPE = {
  number: /^Sv(NumberInput|DurationInput|Slider|Rating|CircularProgress|Progress|Gauge)$/,
  boolean: /^Sv(CheckBox|SwitchButton|ToggleButton)$/,
  'string[]': /^Sv(MultiSelect|TagsInput)$/,
  date: /^Sv(Calendar|DateTimePicker|TimePicker|DateRangeInput)$/,
}

const INIT = {
  number: '$state(0)',
  boolean: '$state(false)',
  'string[]': '$state<string[]>([])',
  date: '$state<Date | null>(null)',
  string: "$state('')",
}

/**
 * Bound identifiers a page's blocks reference but never declare, with the
 * component each is bound to.
 *
 * On a component page every sample is `<SvColorInput value={color} ... />` and
 * the only thing missing is the `let color = $state('')` the prose never shows.
 * That is inferable, and it is the difference between a page of dead samples and
 * a page of runnable ones.
 */
export function undeclaredBindings(file, raw) {
  const found = new Map()
  for (const fence of extractFences(file, raw)) {
    if (fence.lang !== 'svelte') continue
    if (fence.flags.has('nocheck') || fence.flags.has('preamble')) continue
    // Only blocks with no script of their own: if a block declares things, it
    // is a fuller example and its bindings are its own business.
    if (/<script/.test(fence.code)) continue
    for (const m of fence.code.matchAll(
      /<(Sv[A-Z][A-Za-z0-9]*)\b([^>]*?)(?:\/>|>)/g,
    )) {
      const [, comp, attrs] = m
      for (const b of attrs.matchAll(/(?:bind:)?(value|checked|options|nodes)=\{([a-z][A-Za-z0-9]*)\}/g)) {
        const [, prop, name] = b
        if (found.has(name)) continue
        if (prop === 'options' || prop === 'nodes') {
          found.set(name, prop === 'options' ? 'options' : 'nodes')
          continue
        }
        const kind =
          Object.entries(VALUE_TYPE).find(([, re]) => re.test(comp))?.[0] ?? 'string'
        found.set(name, kind)
      }
    }
  }
  return found
}

function stateLines(bindings) {
  const out = []
  for (const [name, kind] of bindings) {
    if (kind === 'options') {
      out.push(
        `  const ${name}: ListOption[] = [\n` +
          `    { value: 'a', label: 'Option A' },\n` +
          `    { value: 'b', label: 'Option B' },\n` +
          `  ]`,
      )
    } else if (kind === 'nodes') {
      out.push(
        `  const ${name}: TreeNode[] = [\n` +
          `    { id: 'root', label: 'Root', children: [{ id: 'child', label: 'Child' }] },\n` +
          `  ]`,
      )
    } else {
      out.push(`  let ${name} = ${INIT[kind]}`)
    }
  }
  return out.join('\n')
}

function preambleFor(components, bindings = new Map()) {
  const sorted = [...components].sort()
  const kinds = new Set(bindings.values())
  const typeImports = [
    kinds.has('options') ? 'ListOption' : null,
    kinds.has('nodes') ? 'TreeNode' : null,
  ].filter(Boolean)

  const lines = [
    '```svelte {preamble}',
    '<script lang="ts">',
    `  import { ${sorted.join(', ')} } from '@svgrid/grid'`,
  ]
  if (typeImports.length) {
    lines.push(`  import type { ${typeImports.join(', ')} } from '@svgrid/grid'`)
  }
  if (bindings.size) {
    lines.push('', '  // The bound value behind each example below.', stateLines(bindings))
  }
  lines.push('</script>', '```', '')
  return lines.join('\n')
}

/** Insert the preamble after the page's first H2, or after the H1 intro. */
export function insertPreamble(raw, preamble) {
  const crlf = raw.includes('\r\n')
  const text = raw.replace(/\r\n/g, '\n')
  if (/```svelte \{preamble\}/.test(text)) return null

  const lines = text.split('\n')
  // Before the first fenced block, so the setup reads ahead of the samples.
  const firstFence = lines.findIndex((l) => /^```/.test(l))
  if (firstFence === -1) return null
  const out = [
    ...lines.slice(0, firstFence),
    'The examples on this page import from `@svgrid/grid`:',
    '',
    ...preamble.split('\n'),
    ...lines.slice(firstFence),
  ].join('\n')
  return crlf ? out.replace(/\n/g, '\r\n') : out
}

if (process.argv[1]?.endsWith('doc-snippet-preamble.mjs')) {
  const write = process.argv.includes('--write')
  const exported = exportedComponents()

  const rows = []
  for (const [file, raw] of loadDocs()) {
    if (/reference[\\/]auto/.test(file)) continue
    if (/```svelte \{preamble\}/.test(raw)) continue
    const used = [...componentsUsedBy(file, raw)].filter((c) => exported.has(c))
    if (!used.length) continue
    const bindings = undeclaredBindings(file, raw)
    // A page with one component and nothing to bind has nothing to gain.
    if (used.length < 2 && !bindings.size) continue
    if (needsData(file, raw)) continue
    rows.push({ file, used, bindings })
  }

  rows.sort((a, b) => b.used.length + b.bindings.size - (a.used.length + a.bindings.size))
  for (const r of rows) {
    console.log(
      `${String(r.used.length).padStart(2)} components ${String(r.bindings.size).padStart(2)} bindings  ${r.file}`,
    )
    if (!write) continue
    const next = insertPreamble(readFileSync(r.file, 'utf-8'), preambleFor(r.used, r.bindings))
    if (next) writeFileSync(r.file, next)
  }
  console.log(`\n${rows.length} pages${write ? ' written' : ' would get a preamble'}`)
}
