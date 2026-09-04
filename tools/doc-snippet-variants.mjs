/**
 * doc-snippet-variants - add variant examples to a UI-component doc page.
 *
 * A component page that shows one usage and then a prop table asks the reader
 * to imagine the rest. AG Grid's median page carries three examples; ours
 * carried one. This closes that on the `sv-*.md` pages, which are the largest
 * uniform block of them.
 *
 * Props come from the component's own `let { ... } = $props()` - never from a
 * guess - and only props this file knows how to demonstrate are used. A page
 * whose component exposes nothing recognisable is skipped rather than given
 * filler.
 *
 *   node tools/doc-snippet-variants.mjs           # list what it would add
 *   node tools/doc-snippet-variants.mjs --write
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
// @ts-expect-error - plain .mjs helper
import { loadDocs } from './demo-doc-coverage.mjs'
// @ts-expect-error - plain .mjs helper with a sibling .d.mts
import { extractFences } from './lib/md-snippets.mjs'

const SRC = 'packages/grid/src'

/** `sv-date-time-picker` -> `SvDateTimePicker`. */
export function componentFor(slug) {
  return slug
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')
}

/** Prop names a component declares, read from its destructured `$props()`. */
export function propsOf(component) {
  const file = `${SRC}/${component}.svelte`
  if (!existsSync(file)) return null
  const src = readFileSync(file, 'utf-8')
  const m = /let\s*\{([\s\S]*?)\}\s*:\s*Props\s*=\s*\$props\(\)/.exec(src)
  if (!m) return null
  const names = new Set()
  for (const line of m[1].split(/,\s*\n|,(?![^(]*\))/)) {
    const n = /^\s*([a-zA-Z_$][\w$]*)/.exec(line)
    if (n) names.add(n[1])
  }
  return names
}

/**
 * Variants worth showing, in priority order. Each names the props it needs, so
 * a component missing them simply does not get that variant.
 */
const VARIANTS = [
  {
    id: 'sizes',
    needs: ['size'],
    title: 'Sizes',
    lead: 'Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.',
    render: (c, bind) =>
      ['sm', 'md', 'lg'].map((s) => `<${c} ${bind} size="${s}" />`).join('\n'),
  },
  {
    id: 'field',
    needs: ['label', 'error'],
    title: 'In a form',
    lead: 'The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.',
    render: (c, bind) =>
      `<${c}\n  ${bind}\n  label="Label"\n  hint="A short hint"\n  required\n/>\n\n<${c}\n  ${bind}\n  label="Label"\n  error="Something is wrong"\n  invalid\n/>`,
  },
  {
    id: 'states',
    needs: ['disabled'],
    title: 'Disabled and read-only',
    lead: 'Disabled takes the control out of the tab order; read-only keeps it focusable and copyable. Reach for read-only when the value still matters to the reader.',
    render: (c, bind, props) =>
      props.has('readonly')
        ? `<${c} ${bind} disabled />\n\n<${c} ${bind} readonly />`
        : `<${c} ${bind} disabled />`,
  },
]

/**
 * The value type a component binds, so a generated variant can declare its own
 * state rather than borrow the page's.
 */
const VALUE_TYPE = [
  [/^Sv(NumberInput|DurationInput|Slider|Rating|Progress|CircularProgress|Gauge)$/, 'number', '$state(1)'],
  [/^Sv(CheckBox|SwitchButton|ToggleButton)$/, 'boolean', '$state(false)'],
  [/^Sv(MultiSelect|TagsInput)$/, 'string[]', '$state<string[]>([])'],
  [/^Sv(Calendar|DateTimePicker|TimePicker|DateRangeInput)$/, 'date', '$state<Date | null>(null)'],
]

/**
 * How the page's existing example binds the component, and whether the variant
 * can rely on that name existing.
 *
 * The first version of this reused the binding verbatim - and broke 41 examples,
 * because the name was usually declared inside another block's own `<script>`,
 * not in the page preamble, so a variant with no script of its own referenced
 * something undefined. Variants now carry their own declaration.
 */
export function bindingFor(text, component) {
  for (const fence of extractFences('x', text)) {
    if (fence.lang !== 'svelte') continue
    const m = new RegExp(`<${component}\\b([^>]*?)/?>`).exec(fence.code)
    if (!m) continue
    // Identifier start required. `value={72}` is a literal, not a binding, and
    // matching it produced `let 72 = $state(1)` on the progress pages.
    const bind = /(?:bind:)?(value|checked|options|nodes)=\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/.exec(m[1])
    if (bind) return { prop: bind[1], name: bind[2], bound: bind[0].startsWith('bind:') }
  }
  return null
}

/**
 * A binding for a component whose page shows none, derived from the props it
 * actually declares. `checked` for the toggles, `value` for everything else;
 * a component with neither is skipped rather than guessed at.
 */
export function defaultBinding(component, props) {
  const prop = props.has('value') ? 'value' : props.has('checked') ? 'checked' : null
  if (!prop) return null
  // Lowercase the component name minus its Sv prefix: SvNumberInput -> numberInput.
  const bare = component.replace(/^Sv/, '')
  const name = bare[0].toLowerCase() + bare.slice(1)
  return { prop, name, bound: true }
}

/** A `<script>` declaring the one variable the variant binds. */
export function scriptFor(component, binding) {
  if (binding.prop === 'options' || binding.prop === 'nodes') return null // needs real data
  const hit = VALUE_TYPE.find(([re]) => re.test(component))
  const init = hit ? hit[2] : "$state('')"
  return `<script lang="ts">\n  import { ${component} } from '@svgrid/grid'\n\n  let ${binding.name} = ${init}\n</script>`
}

export function plan() {
  const out = []
  for (const [file, text] of loadDocs()) {
    const m = /docs\/help\/ui-components\/(sv-[a-z0-9-]+)\.md$/.exec(file.replace(/\\/g, '/'))
    if (!m) continue
    const component = componentFor(m[1])
    const props = propsOf(component)
    if (!props) continue
    // A page with no runnable example at all is exactly the page that needs
    // one, and the variant declares its own state - so neither an existing
    // example nor an existing binding is a prerequisite. Matching the page's
    // binding when there is one just keeps the naming familiar.
    const binding = bindingFor(text, component) ?? defaultBinding(component, props)
    if (!binding) continue
    const script = scriptFor(component, binding)
    if (!script) continue
    const bind = (binding.bound ? "bind:" : "") + binding.prop + "={" + binding.name + "}"

    // Capped at two. Three identically-worded sections repeated across thirty
    // sibling pages reads as generated, which costs more trust than the third
    // example buys - and two is already enough to clear a median of three.
    const picked = VARIANTS.filter((v) => v.needs.every((n) => props.has(n))).slice(0, 2)
    if (picked.length) out.push({ file, component, bind, script, props, picked })
  }
  return out
}

function block(v, component, bind, script, props) {
  // Self-contained: the variant declares the value it binds, so it never
  // depends on a name that lives inside a different block on the page.
  const body = `${script}\n\n${v.render(component, bind, props)}`
  return [`## ${v.title}`, '', v.lead, '', '```svelte {runnable}', body, '```', ''].join('\n')
}

/** Section headings this tool owns, so a rerun can replace rather than repeat. */
export const VARIANT_TITLES = VARIANTS.map((v) => v.title)

/** Remove previously generated variant sections from a page. */
export function stripVariants(text) {
  let out = text
  for (const title of VARIANT_TITLES) {
    // Flag-agnostic: a section whose example stopped compiling has already had
    // its {runnable} flag removed by the demote pass, and it still needs
    // replacing rather than duplicating.
    const re = new RegExp(`\\n*## ${title}\\n[\\s\\S]*?\`\`\`svelte[^\\n]*\\n[\\s\\S]*?\n\`\`\`\\n?`, 'g')
    out = out.replace(re, '\n')
  }
  return out
}

if (process.argv[1]?.endsWith('doc-snippet-variants.mjs')) {
  const write = process.argv.includes('--write')
  const rows = plan()
  let added = 0
  for (const r of rows) {
    console.log(
      `+${r.picked.length}  ${r.file.replace(/^docs\//, '')}  [${r.picked.map((v) => v.id).join(' ')}]`,
    )
    added += r.picked.length
    if (!write) continue
    const raw = readFileSync(r.file, 'utf-8')
    const crlf = raw.includes('\r\n')
    let text = stripVariants(raw.replace(/\r\n/g, '\n')).replace(/\s*$/, '')
    for (const v of r.picked) text += `\n\n${block(v, r.component, r.bind, r.script, r.props)}`
    writeFileSync(r.file, crlf ? text.replace(/\n/g, '\r\n') : text)
  }
  console.log(`\n${added} variant examples across ${rows.length} pages${write ? ' written' : ''}`)
}
