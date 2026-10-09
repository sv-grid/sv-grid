/**
 * Build the plugin and run it against the strict Figma mock.
 *
 *   node tools/figma/check.mjs            # build + run, exit 1 on any plugin error
 *   node tools/figma/check.mjs --preview  # also write dist/preview/*.html
 *   node tools/figma/check.mjs --shots    # also screenshot the previews (needs Playwright)
 *
 * The mock throws where Figma throws (see mock-figma.mjs), so a clean run
 * means the plugin got through every API call the mock models. It cannot prove
 * the plugin renders identically in Figma; the previews are for eyeballing.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from './build.mjs'
import { createFigmaMock, renderHtml } from './mock-figma.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = new Set(process.argv.slice(2))

async function runPlugin(code, mockOpts, reuse) {
  const mock = reuse ?? createFigmaMock(mockOpts)
  mock.state.reopen()
  const errors = []
  const quietConsole = { ...console, error: (...a) => errors.push(a.map(String).join(' ')) }
  new Function('figma', 'console', code)(mock.figma, quietConsole)
  const started = Date.now()
  while (!mock.state.closed) {
    if (Date.now() - started > 60_000) throw new Error('plugin did not close within 60s')
    await new Promise((r) => setImmediate(r))
  }
  return { mock, errors }
}

function stats(mock) {
  const pages = mock.figma.root.children
  const all = pages.flatMap((p) => p.findAll())
  const by = (t) => all.filter((n) => n.type === t).length
  // Paints that are not bound to a variable: should only be the literals the CSS hard-codes.
  const unbound = new Map()
  for (const n of all) {
    for (const key of ['fills', 'strokes']) {
      for (const p of n[key] ?? []) {
        if (p.type !== 'SOLID' || p.boundVariables?.color) continue
        if (key === 'fills' && n.type === 'FRAME' && p.color.r === 1 && p.color.g === 1 && p.color.b === 1 && !p.opacity) continue
        const c = `rgb(${Math.round(p.color.r * 255)}, ${Math.round(p.color.g * 255)}, ${Math.round(p.color.b * 255)})`
        unbound.set(c, (unbound.get(c) ?? 0) + 1)
      }
    }
  }
  return {
    pages: pages.map((p) => p.name),
    components: by('COMPONENT'),
    componentSets: by('COMPONENT_SET'),
    instances: by('INSTANCE'),
    textNodes: by('TEXT'),
    variables: mock.state.variables.length,
    collections: mock.state.collections.map((c) => `${c.name} [${c.modes.map((m) => m.name).join(', ')}]`),
    textStyles: mock.state.textStyles.length,
    effectStyles: mock.state.effectStyles.length,
    unboundPaints: Object.fromEntries(unbound),
  }
}

const code = await bundle({ write: true })

const { mock, errors } = await runPlugin(code)
const last = mock.state.notifications.at(-1)?.msg ?? '(no message)'
console.log(last)
if (errors.length || /failed/i.test(last)) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(JSON.stringify(stats(mock), null, 2))

/**
 * Structure the plugin promises: each page holds one column frame (plus the
 * cover on Overview), and every Light or Dark panel has content. Catches a
 * card's stage being pulled out of its panel, which once left every card
 * empty and stacked at the page origin.
 */
function structureErrors(m) {
  const errs = []
  for (const page of m.figma.root.children.filter((p) => p.name !== 'Page 1')) {
    const top = page.children.filter((c) => c.name !== 'Cover')
    if (top.length !== 1 || top[0].layoutMode !== 'VERTICAL') errs.push(`${page.name}: expected one column, found ${page.children.map((c) => c.name).join(', ')}`)
    for (const panel of page.findAll((n) => n.name === 'Light' || n.name === 'Dark')) {
      const stage = panel.children?.find((c) => c.name === 'Stage')
      if (!stage || stage.children.length === 0) errs.push(`${page.name}: empty ${panel.name} panel in "${panel.parent?.parent?.name}"`)
    }
  }
  return errs
}
const shape = structureErrors(mock)
if (shape.length) {
  console.error(shape.slice(0, 20).join('\n'))
  process.exit(1)
}

// Starter plan: one mode per collection, three pages per file. The kit must still build.
const starter = await runPlugin(code, { maxModes: 1, maxPages: 3 })
const starterMsg = starter.mock.state.notifications.at(-1)?.msg ?? ''
if (starter.errors.length || /failed/i.test(starterMsg)) {
  console.error('Starter-plan run failed:', starterMsg, starter.errors.join('\n'))
  process.exit(1)
}
console.log(`Starter plan (1 mode, 3 pages): ${starterMsg}`)
// A second run in the same file must reuse the pages, not add more.
const again = await runPlugin(code, null, starter.mock)
const againMsg = again.mock.state.notifications.at(-1)?.msg ?? ''
if (again.errors.length || /failed/i.test(againMsg)) {
  console.error('Re-run failed:', againMsg, again.errors.join('\n'))
  process.exit(1)
}
const starterPages = starter.mock.figma.root.children.map((p) => p.name)
console.log(`Re-run in the same file: ${againMsg} Pages: ${starterPages.join(', ')}`)
if (starterPages.length > 3) {
  console.error('Starter-plan run left more than 3 pages:', starterPages)
  process.exit(1)
}

if (args.has('--preview') || args.has('--shots')) {
  const out = join(here, 'dist', 'preview')
  mkdirSync(out, { recursive: true })
  const files = []
  // --starter previews the Starter-plan run (themes in fallback collections).
  const shown = args.has('--starter') ? starter.mock : mock
  for (const page of shown.figma.root.children.filter((p) => p.name !== 'Page 1')) {
    const file = join(out, `${page.name.toLowerCase().replace(/\s+/g, '-')}.html`)
    writeFileSync(file, renderHtml(shown, { pages: [page], title: page.name }))
    files.push(file)
  }
  console.log(`previews -> ${out}`)
  if (args.has('--shots')) {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    for (const f of files) {
      await page.goto('file:///' + f.replace(/\\/g, '/'))
      await page.waitForTimeout(400)
      await page.screenshot({ path: f.replace(/\.html$/, '.png'), fullPage: true })
    }
    await browser.close()
    console.log('screenshots written')
  }
}
