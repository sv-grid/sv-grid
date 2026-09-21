// Build src/data.ts from the workspace at build time. This bundles the
// example sources + docs + curated API info into the MCP server so it works
// when installed from npm with no access to the original repo.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocFrontmatter, sectionOf, SECTION_TITLES } from '../../../tools/lib/doc-meta.mjs'
import { isPendingDoc, pendingDemoIds } from '../../../tools/lib/releases.mjs'
import { parseDemoRegistry } from '../../../tools/lib/demo-registry.mjs'
import { buildApiSurface } from './api-surface.mjs'
import { loadComparisons, loadLedger, loadSvgridSize } from '../../../tools/lib/compare-data.mjs'
import { comparePageModel, renderCompareMarkdown } from '../../../tools/lib/compare-page.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(__dirname, '..')
const repoRoot = join(pkgRoot, '..', '..')

function readAll(dir, ext) {
  const out = []
  function walk(d) {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry)
      const s = statSync(p)
      if (s.isDirectory()) walk(p)
      else if (entry.endsWith(ext)) out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

const demosDir = join(repoRoot, 'examples', 'src', 'demos')
const docsDir = join(repoRoot, 'docs')

// Gallery categories, so `list_examples` can be filtered instead of returning
// all 373 demos. The registry lives in the PRIVATE website submodule.
//
// Without it this used to warn and write "Other" for every example. That is
// wrong for a file that is committed with the real categories already in it:
// the rebuild reported success and silently replaced 423 of them, and the
// CI smoke build (`pnpm --filter @svgrid/mcp build`, no submodule) does
// exactly that on every push. So fall back to the categories the committed
// data.ts already carries, and only lose them when there is nothing to keep.
const categoryById = await (async () => {
  try {
    const entries = await parseDemoRegistry(repoRoot)
    return new Map(entries.map((e) => [e.id, e.category]))
  } catch {
    const kept = previousCategories()
    if (kept.size > 0) {
      console.warn(
        `build-manifests: demo registry unreadable, keeping the ${kept.size} categories ` +
          'already in src/data.ts',
      )
      return kept
    }
    console.warn('build-manifests: demo registry unreadable, examples will have no category')
    return new Map()
  }
})()

/** Read the categories out of the previously generated src/data.ts.
 *  Parsed off the emitted JSON rather than imported: this script runs before
 *  build:ts, so there is no compiled module to load, and a half-written file
 *  should degrade to "no categories" rather than throw. */
function previousCategories() {
  const out = new Map()
  try {
    const prev = readFileSync(join(pkgRoot, 'src', 'data.ts'), 'utf8')
    // Entries emit "id" and "category" as sibling keys; pair them positionally
    // within each object rather than assuming a global ordering.
    for (const block of prev.split('{')) {
      const id = block.match(/"id":\s*"([^"]+)"/)
      const category = block.match(/"category":\s*"([^"]+)"/)
      if (id && category) out.set(id[1], category[1])
    }
  } catch { /* no previous build, or unreadable: fall through to empty */ }
  return out
}

// A feature that has not reached its release date is not in the manifests:
// the server would otherwise answer with demos and docs the site does not show.
const pendingDemos = pendingDemoIds()
const examples = readAll(demosDir, '.svelte').filter((path) => !pendingDemos.has(path.split(/[\\/]/).pop().replace('.svelte', ''))).map((path) => {
  const base = path.split(/[\\/]/).pop().replace('.svelte', '')
  const source = readFileSync(path, 'utf8')
  // Extract a short blurb from the leading JSDoc-style comment if any.
  const blurbMatch = source.match(/\/\*\*([\s\S]*?)\*\//)
  const blurb = blurbMatch
    ? blurbMatch[1]
        .split('\n')
        .map((l) => l.replace(/^\s*\*\s?/, '').trim())
        .filter((l) => l && !l.startsWith('--'))
        .slice(0, 3)
        .join(' ')
    : ''
  return {
    id: base,
    path: relative(repoRoot, path).replaceAll('\\', '/'),
    title: base
      .replace(/^\d+-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    category: categoryById.get(base) ?? 'Other',
    blurb,
    source,
  }
})

const routedDocs = readAll(docsDir, '.md')
  .filter((p) => !p.includes('examples-plan'))
  .filter((p) => !isPendingDoc(relative(docsDir, p).replaceAll('\\', '/').replace(/\.md$/, '')))
  .map((path) => {
    // Search-facing frontmatter (seoTitle etc.) is for the website; the model
    // gets the page body only.
    const markdown = parseDocFrontmatter(readFileSync(path, 'utf8')).body
    const slug = relative(docsDir, path).replaceAll('\\', '/').replace(/\.md$/, '')
    const titleMatch = markdown.replace(/^﻿/, '').match(/^#\s+(.+?)\s*$/m)
    const section = sectionOf(slug)
    return {
      slug,
      path: 'docs/' + slug + '.md',
      title: titleMatch ? titleMatch[1].trim() : slug,
      // Readable group name, so `list_docs` can be browsed a section at a time
      // rather than dumping all 370 pages.
      section: SECTION_TITLES[section] ?? (section || 'Overview'),
      markdown,
    }
  })

// The comparison pages (/compare/<slug>/), rendered from docs/_data through
// the same model the website and the prerenderer use, so `svgrid_get
// compare/ag-grid` returns what the page says, verified numbers and all.
// They have no .md file, which is why the docs walk above never saw them.
const comparisonDocs = await (async () => {
  const comparisons = await loadComparisons()
  const ledger = await loadLedger()
  const size = await loadSvgridSize()
  const demoTitle = (id) => examples.find((e) => e.id === id)?.title ?? null
  const docTitle = (slug) => routedDocs.find((d) => d.slug === slug)?.title ?? null
  return comparisons.map((c) => ({
    slug: `compare/${c.slug}`,
    path: `docs/_data/comparisons/${c.slug}.json`,
    title: `SvGrid vs ${c.competitor}`,
    section: 'Comparisons',
    markdown: renderCompareMarkdown(comparePageModel(c, { ledger, size, demoTitle, docTitle, comparisons }), { site: 'https://svgrid.com' }),
  }))
})()

const docs = [...routedDocs, ...comparisonDocs]

const apiReference = {
  components: ['SvGrid', 'SvGridBoard', 'FlexRender', 'renderComponent', 'renderSnippet'],
  headless: ['createSvGrid', 'createGrid', 'createGridState', 'subscribeGrid', 'createTable'],
  scheduler: ['registerSchedulerView', 'getSchedulerView', 'hasSchedulerView', 'resolveEvents', 'layoutDayEvents'],
  dataOps: ['applyGroupAggregate', 'filterFns', 'sortFns'],
  export: ['serializeDelimited', 'serializeJson', 'serializeHtml', 'serializeMarkdown', 'downloadTextFile', 'copyTextToClipboard'],
  rowModels: [
    'createCoreRowModel',
    'createFilteredRowModel',
    'createSortedRowModel',
    'createGroupedRowModel',
    'createExpandedRowModel',
    'createPaginatedRowModel',
  ],
  features: [
    'tableFeatures',
    'rowSortingFeature',
    'columnFilteringFeature',
    'columnGroupingFeature',
    'rowExpandingFeature',
    'rowPaginationFeature',
    'rowSelectionFeature',
  ],
  virtualization: ['createVirtualizer', 'createSvelteVirtualizer', 'createColumnVirtualizer'],
  accessibility: [
    'getGridRootA11yProps',
    'getGridHeaderA11yProps',
    'getGridCellA11yProps',
    'getGridRowA11yProps',
    'getGridCellDomId',
  ],
  utilities: [
    'getKeyboardIntent',
    'getNextActiveCell',
    'parseEditorValue',
    'applyExcelFilter',
    'formatNumericWithConfig',
    'resolveDatePattern',
  ],
}

// The REAL exported surface, read out of the workspace sources. This is what
// `check_svgrid_code` validates against, so it must be generated rather than
// curated - a hand-kept list would go stale and start rejecting valid code.
const apiSurface = buildApiSurface(repoRoot)
// The JSON schemas (docs/schemas, built by tools/build-schemas.mjs), so a
// model can ask for "the chart spec schema" and validate what it writes.
const schemasDir = join(repoRoot, 'docs', 'schemas')
const schemaIndex = JSON.parse(readFileSync(join(schemasDir, 'index.json'), 'utf8'))
const schemas = schemaIndex.schemas.map((s) => ({
  id: s.id,
  describes: s.describes,
  json: readFileSync(join(schemasDir, s.file), 'utf8'),
}))

// The arrays carry explicit types rather than `as const`. Inferring literal
// types for 373 demo sources blows past what tsc will serialize into a .d.ts
// ("TS7056"), and nothing needs the literals.
const out = `// Generated by scripts/build-manifests.mjs. Do not edit by hand.
import type { ApiSurface } from './validate.js'

export type ExampleEntry = {
  id: string
  path: string
  title: string
  category: string
  blurb: string
  source: string
}

export type DocEntry = {
  slug: string
  path: string
  title: string
  section: string
  markdown: string
}

export const examples: readonly ExampleEntry[] = ${JSON.stringify(examples, null, 2)}

export const docs: readonly DocEntry[] = ${JSON.stringify(docs, null, 2)}

export const apiReference = ${JSON.stringify(apiReference, null, 2)} as const

export const apiSurface: ApiSurface = ${JSON.stringify(apiSurface, null, 2)}

/** The JSON schemas under https://svgrid.com/schemas/, by id. */
export const schemas: ReadonlyArray<{ id: string; describes: string; json: string }> = ${JSON.stringify(schemas, null, 2)}
`

mkdirSync(join(pkgRoot, 'src'), { recursive: true })
writeFileSync(join(pkgRoot, 'src', 'data.ts'), out, 'utf8')

console.log(
  `Built manifests: ${examples.length} examples, ${docs.length} docs, ` +
    `${apiSurface.grid.values.length + apiSurface.grid.types.length} grid exports, ` +
    `${apiSurface.props.length} <SvGrid> props, ${apiSurface.columnDef.length} column keys`,
)
