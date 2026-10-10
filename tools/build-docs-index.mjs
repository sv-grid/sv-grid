#!/usr/bin/env node
/**
 * Build the AI-era doc indexes:
 *
 *   docs/llms.txt        — topic map (one-line summaries, grouped by section)
 *   docs/llms-full.txt   — concatenated full text of every doc page, PLUS the
 *                          unrouted API reference (see isLlmOnlyDoc)
 *   docs/docs.json       — machine-readable route manifest with metadata
 *
 * The comparison pages (/compare/<slug>/, from docs/_data/comparisons) ride
 * along in all three: a `### Comparisons` list in llms.txt, a block per page
 * in llms-full.txt and a top-level `comparisons` array in docs.json. They are
 * not docs routes and never join `pages`, `sections` or the sidebar.
 *
 * Routed pages and LLM-only pages are collected separately on purpose:
 * docs.json, llms.txt and the sitemap are all built from the routed list, so
 * the reference cannot leak into them and advertise URLs that 404.
 *
 * Run it from anywhere: `node tools/build-docs-index.mjs`.
 *
 * The generator is deliberately dependency-free so it runs on a fresh
 * clone without `pnpm install`.
 */
import { readdir, readFile, writeFile, stat, mkdir } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isHiddenDoc, isLlmOnlyDoc, parseDocFrontmatter, sectionOf } from './lib/doc-meta.mjs'
import { plainTitle } from './lib/docs-page.mjs'
import { isReleased } from './lib/releases.mjs'
import { loadComparisons, loadLedger, loadSvgridSize } from './lib/compare-data.mjs'
import { comparePageModel, renderCompareMarkdown, compareChoosingModel, renderCompareChoosingMarkdown } from './lib/compare-page.mjs'
import { compareSeo, compareKeywords } from './lib/compare-meta.mjs'
import { guardGenerator } from './lib/generator-guard.mjs'
import { clampDescription } from './lib/seo-text.mjs'
import { parseDemoRegistry } from './lib/demo-registry.mjs'
import { tutorialIdsIn, normalizeNarration } from './lib/tutorial-media.mjs'
import { readManifest as readTutorialManifest } from './tutorials/lib/manifest.mjs'
import { aiBriefLines, START_HERE, SMALL_CORPUS, OPTIONAL_SECTIONS, OPTIONAL_PAGES, plainDocBody } from './lib/ai-brief.mjs'

// Resolved from this file, not process.cwd(): the website's `prebuild` runs this
// with cwd set to website/, which used to make DOCS_DIR website/docs and fail.
const ROOT      = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR  = join(ROOT, 'docs')
const PUBLIC_DIR = join(ROOT, 'website', 'public') // served copies for crawlers
const SITE      = process.env.SVGRID_SITE_ORIGIN ?? 'https://svgrid.com'   // canonical doc origin

// The tutorials a page embeds, as manifest entries. Used to append a narrated
// cut's words to llms-full.txt: that block is only rendered visibly for silent
// clips, and a model reading the corpus cannot hear the narration.
const TUTORIAL_BY_ID = new Map(readTutorialManifest().tutorials.map((t) => [t.id, t]))
const tutorialsOn = (body) => tutorialIdsIn(body).map((id) => TUTORIAL_BY_ID.get(id)).filter(Boolean)

const SECTION_TITLES = {
  '':                  'Overview',
  'getting-started':   'Getting started',
  'help':              'Help / topic pages',
  'help/cells':        'Cells',
  'help/columns':      'Columns',
  'help/editing':      'Editing',
  'help/filtering':    'Filtering',
  'help/grouping':     'Grouping',
  'help/headless':     'Headless',
  'help/rows':         'Rows',
  'help/server':       'Server data',
  'help/state':        'State & views',
  'help/charts':       'Charts',
  'help/gantt':        'Gantt',
  'help/sheet':        'Spreadsheet',
  'help/export':       'Import & export',
  'help/pivot':        'Pivot grid',
  'help/kanban':       'Kanban',
  'help/scheduler':    'Scheduler',
  'help/alerts':       'Alerts & scheduling',
  'help/ui-components':'UI components',
  'help/web-components':'Web components',
  'recipes':           'Recipes / cookbook',
  'reference':         'API reference',
  'enterprise/studio': 'Studio',
  'enterprise':        'Enterprise tier',
  'compliance':        'Compliance',
  'legal':             'Legal',
  'brand':             'Brand',
}

// Product pillars — the top-level split a developer picks first, rendered as a
// header dropdown on the site (the demos gallery's product switcher: the free
// grid and its UI kit, then the three Enterprise products). Order here is the
// dropdown order. Mirrors PILLARS in website/src/lib/docs.ts.
const PILLARS = [
  { id: 'grid',       title: 'SvGrid',             blurb: 'The Svelte 5 data grid.' },
  { id: 'ui',         title: 'SvGrid UI',          blurb: 'The Svelte component suite.' },
  { id: 'enterprise', title: 'SvGrid Enterprise',  blurb: 'The paid modules on the grid; licensing, support, compliance, legal.' },
  { id: 'sheet',      title: 'SvGrid Spreadsheet', blurb: 'The grid as an Excel-like spreadsheet.' },
  { id: 'studio',     title: 'SvGrid Studio',      blurb: 'Turn a database or schema into a CRUD data-app.' },
]

// Which pillar each section belongs to. Sections not listed default to 'grid'.
const SECTION_PILLAR = {
  '':                  'grid',
  'getting-started':   'grid',
  'help':              'grid',
  'help/cells':        'grid',
  'help/columns':      'grid',
  'help/editing':      'grid',
  'help/filtering':    'grid',
  'help/grouping':     'grid',
  'help/headless':     'grid',
  'help/rows':         'grid',
  'help/server':       'grid',
  'help/state':        'grid',
  'help/charts':       'grid',
  'help/gantt':        'enterprise',
  'help/sheet':        'sheet',
  'help/export':       'enterprise',
  'help/pivot':        'enterprise',
  'help/kanban':       'enterprise',
  'help/scheduler':    'enterprise',
  'help/alerts':       'enterprise',
  'recipes':           'grid',
  'reference':         'grid',
  'enterprise/studio': 'studio',
  'help/ui-components':'ui',
  'help/web-components':'grid',
  'enterprise':        'enterprise',
  'compliance':        'enterprise',
  'legal':             'enterprise',
  'brand':             'enterprise',
}

// Pages whose pillar is not their folder's: the paid pages of the mixed
// folders (help/rows holds the Kanban page beside free row docs) and the
// spreadsheet's pages under help/cells and help/. Mirrors CATEGORY_OVERRIDE in
// website/src/lib/docs.ts, which routes the same slugs on the site.
const PAGE_PILLAR = {
  // Server-Side Row Model: the hub and the five Enterprise deep dives; the
  // createServerDataSource pages (infinite scroll, paging, sorting, filtering,
  // editing) stay with the free grid.
  'help/server/row-model-walkthrough': 'enterprise',
  'help/server/server-row-model':   'enterprise',
  'help/server/server-grouping':    'enterprise',
  'help/server/server-tree-data':   'enterprise',
  'help/server/server-pivot':       'enterprise',
  'help/server/server-transactions':'enterprise',
  'help/server/server-selection':   'enterprise',
  'help/server/worker-data-source': 'enterprise',
  'help/export':                    'enterprise',
  'help/import':                    'enterprise',
  'help/pivot':                     'enterprise',
  'help/rows/kanban-board':         'enterprise',
  'help/rows/scheduler':            'enterprise',
  'help/rows/gantt':                'enterprise',
  'help/gantt':                     'enterprise',
  'help/alerts':                    'enterprise',
  'help/scheduling':                'enterprise',
  'help/cells/spreadsheet-shell':   'sheet',
  'help/spreadsheet-formulas':      'sheet',
  'help/cells/workbooks':           'sheet',
  'help/cells/tables':              'sheet',
  'help/web-components/sv-sheet':   'sheet',
}
const pillarOf = (slug, section) => PAGE_PILLAR[slug] ?? SECTION_PILLAR[section] ?? 'grid'

// Curated sidebar order within a pillar (index = position; unknown → end).
// Replaces the old alphabetical sort that buried Getting started behind Brand.
const SECTION_ORDER = [
  '', 'getting-started', 'help',
  'help/cells', 'help/columns', 'help/rows',
  'help/editing', 'help/filtering', 'help/grouping',
  'help/headless', 'help/server', 'help/state', 'help/charts', 'help/gantt', 'help/sheet',
  'help/export', 'help/pivot', 'help/kanban', 'help/scheduler', 'help/alerts',
  // Before recipes, matching CATEGORY_ORDER in website/src/lib/docs.ts - this
  // list drives docs.json and llms.txt, that one drives the visible sidebar,
  // and a reader following the topic map should meet them in the same order.
  'help/web-components', 'recipes', 'reference',
  'enterprise/studio',
  'help/ui-components',
  'enterprise', 'compliance', 'legal', 'brand',
]

// Curated reading order within a section, expressed as labelled groups so one
// source drives both the sidebar order (prev/next follows it) and the group
// headers the site can render. Bare names expand to `<section>/<name>.md`;
// pages a section has that are not listed here sort after the curated ones,
// alphabetically. Sections without an entry keep the alphabetical order.
const PAGE_GROUPS = {
  // The short getting-started page before its one-page long form, which
  // sorted first by path ("-full" < ".md"); the changelog last.
  '': [{ label: '', pages: ['getting-started.md', 'why-headless.md', 'getting-started-full.md', 'changelog.md'] }],
  // The hub first, then the reading order a newcomer wants: what a spec is,
  // what it can draw, how it is styled; then the depth; then the grid and the
  // field index. Mirrors PAGE_ORDER in website/src/lib/docs.ts.
  'help/charts': [
    { label: '', pages: ['help/charts.md'] },
    { label: 'Start here', pages: ['start', 'types', 'gallery', 'axes-and-styling'] },
    { label: 'Depth', pages: ['interaction', 'financial', 'accessibility'] },
    { label: 'Grid and reference', pages: ['from-the-grid', 'api'] },
  ],
  // The Gantt guide: the hub, then the basics in the order a plan grows
  // (rows, phases, links, edits, the axis), then the planning layer, then the
  // pages that look outward. Mirrors PAGE_ORDER in website/src/lib/docs.ts.
  // Spreadsheet: the tutorials in reading order. The reference pages live in
  // other folders and sort into the site's sidebar by slug (docs.ts).
  'help/sheet': [
    { label: 'Start here', pages: ['start', 'formulas', 'formatting', 'validation'] },
    { label: 'Beyond the cells', pages: ['files', 'data-tools', 'charts-and-objects', 'review'] },
    { label: 'Reference', pages: ['help/cells/spreadsheet-shell.md', 'help/spreadsheet-formulas.md', 'help/cells/workbooks.md', 'help/cells/tables.md', 'help/web-components/sv-sheet.md'] },
  ],
  // The other Enterprise modules: the tutorial(s) first, then the reference
  // pages routed in from their own folders (SECTION_OVERRIDE in doc-meta.mjs).
  'help/export': [
    { label: 'Tutorials', pages: ['report', 'import-spreadsheet'] },
    { label: 'Reference', pages: ['help/export.md', 'help/import.md'] },
  ],
  'help/pivot': [{ label: '', pages: ['start', 'help/pivot.md'] }],
  'help/kanban': [{ label: '', pages: ['sprint-board', 'help/rows/kanban-board.md'] }],
  'help/scheduler': [{ label: '', pages: ['booking-calendar', 'help/rows/scheduler.md'] }],
  'help/alerts': [{ label: '', pages: ['start', 'help/alerts.md', 'help/scheduling.md'] }],
  // The row model: the walkthrough, the hub, the free controller pages, then
  // the Enterprise deep dives, the order the sidebar and the hub use.
  'help/server': [
    { label: '', pages: ['row-model-walkthrough', 'server-row-model', 'server-infinite-scroll', 'server-paging', 'server-sorting', 'server-filtering', 'server-editing', 'server-grouping', 'server-tree-data', 'server-pivot', 'server-transactions', 'server-selection', 'worker-data-source'] },
  ],
  'help/gantt': [
    { label: '', pages: ['help/gantt.md'] },
    { label: 'Start here', pages: ['start', 'work-breakdown', 'dependencies', 'editing', 'axis-and-working-time'] },
    { label: 'Planning', pages: ['critical-path', 'resources'] },
    { label: 'Beyond the chart', pages: ['customizing', 'views', 'api'] },
  ],
  // Reading order, not alphabetical: the attribute-vs-property rule in
  // `quick-start` is the thing every reader needs before anything else, and
  // `limitations` reads as a conclusion rather than an opening.
  'help/web-components': [
    { label: '', pages: ['help/web-components.md'] },
    { label: 'Start here', pages: ['frameworks', 'quick-start', 'sv-grid', 'sv-chart', 'sv-sheet', 'shadow-dom'] },
    { label: 'Frameworks', pages: ['react', 'vue', 'angular'] },
    { label: 'Reference', pages: ['typescript', 'enterprise', 'limitations'] },
  ],
  'enterprise/studio': [
    { label: '',                        pages: ['enterprise/studio.md'] },
    { label: 'Start here',              pages: ['getting-started', 'concepts', 'samples', 'tutorial-crm'] },
    { label: 'Three ways to build',     pages: ['cli', 'launch', 'app-designer', 'designer', 'ai-generation'] },
    { label: 'Connect to data',         pages: ['data-binding', 'databases', 'local-database', 'supabase', 'drizzle', 'prisma', 'rest-api', 'odata-graphql', 'in-memory'] },
    { label: 'One-page CRUD tutorials', pages: ['postgres-grid', 'supabase-grid', 'rest-grid', 'supabase-sample'] },
    { label: 'Screens & features',      pages: ['schema', 'server-grid', 'edit-forms', 'relations', 'master-detail', 'dashboards', 'scheduler', 'dock-layout', 'navigation', 'realtime'] },
    { label: 'Logic & generated code',  pages: ['business-logic', 'code-behind', 'code-generation'] },
    { label: 'Auth & security',         pages: ['auth', 'access-control', 'audit-log'] },
    { label: 'Ship it',                 pages: ['theming', 'i18n', 'accessibility', 'testing', 'deployment'] },
    { label: 'Reference & help',        pages: ['api', 'troubleshooting'] },
  ],
}

const expandPagePath = (sectionId, p) => (p.endsWith('.md') ? p : `${sectionId}/${p}.md`)
// path -> curated position / group label, flattened once up front.
const pageOrderIndex = new Map()
const pageGroupLabel = new Map()
for (const [sectionId, groups] of Object.entries(PAGE_GROUPS)) {
  let i = 0
  for (const g of groups) {
    for (const p of g.pages) {
      const path = expandPagePath(sectionId, p)
      pageOrderIndex.set(path, i++)
      if (g.label) pageGroupLabel.set(path, g.label)
    }
  }
}

// Whole sections that are part of the commercial tier regardless of page title.
const ENTERPRISE_SECTIONS = new Set([
  'legal', 'enterprise', 'enterprise/studio', 'help/sheet', 'help/export', 'help/pivot', 'help/kanban', 'help/scheduler', 'help/alerts'])

/** Walk a directory recursively, yielding absolute file paths. */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

/** Pull the first H1 + the first non-empty paragraph as title / summary. */
function extract(md) {
  // Strip UTF-8 BOM if present - editors on Windows add it routinely.
  if (md.charCodeAt(0) === 0xFEFF) md = md.slice(1)
  const lines = md.split(/\r?\n/)
  let title = ''
  let summary = ''
  let inFence = false
  const isProse = (t) =>
    t && !t.startsWith('#') && !t.startsWith('<') && !t.startsWith('|') &&
    !t.startsWith('>') && !t.startsWith('```') && !t.startsWith('- ') &&
    !t.startsWith('* ') && !t.startsWith('![') && !/^\d+\.\s/.test(t)
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? ''
    const t = l.trim()
    // Track fenced code so a leading ```svelte block is never mistaken for prose.
    if (t.startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue
    if (!title && l.startsWith('# ')) { title = plainTitle(l.slice(2)); continue }
    if (title && !summary && isProse(t)) {
      // Collect the paragraph, stopping at a blank line or any non-prose block
      // (HTML/demo embed, table, code fence) so markup never leaks into snippets.
      const para = []
      for (let j = i; j < lines.length; j += 1) {
        const pj = lines[j].trim()
        if (!pj || pj.startsWith('<') || pj.startsWith('|') || pj.startsWith('```')) break
        para.push(pj)
      }
      summary = para.join(' ')
        .replace(/`([^`]+)`/g, '$1')              // strip inline code marks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // strip md links
        .replace(/\s+/g, ' ')
        .trim()
      break
    }
  }
  return { title, summary }
}

// Sections come from tools/lib/doc-meta.mjs: the folder, with the per-slug
// overrides (SECTION_OVERRIDE), the one copy the MCP bundle reads too.

async function main() {
  // The served copies go into website/public and the blog index is read from
  // the submodule, so without it this writes a docs.json built from less than
  // the whole picture over one that was built from all of it.
  guardGenerator({ root: ROOT, name: 'build-docs-index', needs: ['website'] })

  const docs = []
  // Unrouted pages that still belong in the LLM bundle - the full API
  // reference. Kept in its own list so it can never leak into docs.json,
  // llms.txt or the sitemap, all of which are built from `docs`.
  const llmOnly = []
  for await (const file of walk(DOCS_DIR)) {
    if (!file.endsWith('.md')) continue
    const rel = relative(DOCS_DIR, file).replaceAll('\\', '/')
    const slug = rel.replace(/\.md$/, '')
    // Pages the site cannot route (shared with the prerenderer and the SPA via
    // tools/lib/doc-meta.mjs); listing them would advertise 404s to crawlers.
    if (isHiddenDoc(slug)) {
      if (isLlmOnlyDoc(slug)) {
        const { body } = parseDocFrontmatter(await readFile(file, 'utf-8'))
        const { title } = extract(body)
        if (title) llmOnly.push({ path: rel, title, body })
      }
      continue
    }
    // Optional search-facing frontmatter (seoTitle, seoDescription, keywords,
    // noindex); the body is what every consumer renders and indexes.
    const { meta, body } = parseDocFrontmatter(await readFile(file, 'utf-8'))
    const { title, summary } = extract(body)
    if (!title) continue
    const s = await stat(file)
    const section = sectionOf(rel)
    docs.push({
      path:        rel,
      // Must match the prerendered route shape (/docs/<slug>/, trailing slash)
      // or every link we hand to LLM crawlers 404s.
      url:         `/docs/${rel.replace(/\.md$/, '')}/`,
      title,
      summary,
      ...(meta.seoTitle ? { seoTitle: meta.seoTitle } : {}),
      ...(meta.seoDescription ? { seoDescription: meta.seoDescription } : {}),
      ...(meta.keywords?.length ? { keywords: meta.keywords } : {}),
      ...(meta.noindex ? { noindex: true } : {}),
      section,
      pillar:      pillarOf(slug, section),
      // Paid when its section is, when PAGE_PILLAR routes it into a paid pillar, or when its title says so.
      tier:        ENTERPRISE_SECTIONS.has(section) || PAGE_PILLAR[slug] !== undefined || /\bEnterprise\b/.test(title) ? 'enterprise' : 'community',
      ...(pageGroupLabel.has(rel) ? { group: pageGroupLabel.get(rel) } : {}),
      words:       body.split(/\s+/).filter(Boolean).length,
      lastUpdated: s.mtime.toISOString().slice(0, 10),
      // Demo associations come from two link styles: the `data-docs-demo`
      // embeds (help/ pages) and inline `#/demos/<id>` links (studio/ pages).
      demoIds:     [...new Set([
        ...[...body.matchAll(/data-docs-demo="([^"]+)"/g)].map((m) => m[1]),
        ...[...body.matchAll(/#\/demos\/(\d+-[a-z0-9-]+)/g)].map((m) => m[1]),
      ])],
      // 30-second tutorial embeds (tools/tutorials/embed.mjs), by id.
      ...(tutorialIdsIn(body).length ? { tutorialIds: tutorialIdsIn(body) } : {}),
    })
  }
  docs.sort((a, b) => a.path.localeCompare(b.path))

  // ---- comparisons --------------------------------------------------------
  // Same model the prerenderer and the SPA render, so the markdown a model
  // reads says what the page says. Demo titles come from the gallery registry
  // in the private website submodule; without it the live-example line is
  // simply absent.
  const comparisons = await loadComparisons()
  const ledger = await loadLedger()
  const svgridSize = await loadSvgridSize()
  const demoTitles = await parseDemoRegistry(ROOT).then((list) => new Map(list.map((d) => [d.id, d.title]))).catch(() => new Map())
  // The figures the answer-first brief quotes, each read from its source.
  const brief = aiBriefLines({
    site: SITE,
    version: await readFile(join(ROOT, 'packages', 'grid', 'package.json'), 'utf-8').then((s) => JSON.parse(s).version).catch(() => null),
    size: svgridSize,
    themeCount: await readdir(join(ROOT, 'packages', 'grid', 'themes')).then((f) => f.filter((n) => n.endsWith('.css')).length).catch(() => null),
    demoCount: demoTitles.size || null,
    ganttReleased: isReleased('gantt'),
  })
  let postTitles = new Map()
  try {
    const posts = JSON.parse(await readFile(join(ROOT, 'website', 'src', 'lib', 'blog-index.json'), 'utf-8'))
    postTitles = new Map(posts.map((p) => [p.slug, p.title]))
  } catch { /* no submodule: no post links */ }
  const comparePages = comparisons.map((c) => {
    const model = comparePageModel(c, {
      ledger,
      size: svgridSize,
      demoTitle: (id) => demoTitles.get(id) ?? null,
      docTitle: (slug) => docs.find((d) => d.path === slug + '.md')?.title ?? null,
      postTitle: (slug) => postTitles.get(slug) ?? null,
      comparisons,
    })
    const { title, description } = compareSeo(c, clampDescription)
    return {
      slug: `compare/${c.slug}`,
      url: `/compare/${c.slug}/`,
      title: `SvGrid vs ${c.competitor}`,
      competitor: c.competitor,
      seoTitle: title,
      summary: description,
      keywords: compareKeywords(c.competitor, c.aliases ?? []),
      verified: c.verified,
      published: c.published,
      tier: c.tier,
      markdown: renderCompareMarkdown(model, { site: SITE }),
    }
  })

  // ---- docs.json --------------------------------------------------------
  const orderOf = (id) => {
    const i = SECTION_ORDER.indexOf(id)
    return i === -1 ? SECTION_ORDER.length : i
  }
  const pageRank = (p) => (pageOrderIndex.has(p) ? pageOrderIndex.get(p) : Infinity)
  const sections = [...new Set(docs.map((d) => d.section))]
    .sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b))
    .map((id) => ({
      id,
      title:  SECTION_TITLES[id] ?? id,
      pillar: SECTION_PILLAR[id] ?? 'grid',
      pages:  docs
        .filter((d) => d.section === id)
        .sort((a, b) => pageRank(a.path) - pageRank(b.path) || a.path.localeCompare(b.path))
        .map((d) => d.path),
      // Labelled sub-groups for the sidebar; only pages that actually exist.
      ...(PAGE_GROUPS[id]
        ? {
            groups: PAGE_GROUPS[id]
              .filter((g) => g.label)
              .map((g) => ({
                label: g.label,
                pages: g.pages
                  .map((p) => expandPagePath(id, p))
                  .filter((p) => docs.some((d) => d.path === p)),
              }))
              .filter((g) => g.pages.length > 0),
          }
        : {}),
    }))
  const manifest = {
    name:        'sv-grid documentation',
    site:        SITE,
    generatedAt: new Date().toISOString(),
    counts:      {
      pages: docs.length,
      enterprise: docs.filter((d) => d.tier === 'enterprise').length,
      withDemo: docs.filter((d) => d.demoIds.length > 0).length,
    },
    // Product pillars — the top-level split, rendered as a header dropdown. A
    // section is listed under every pillar one of its pages belongs to (the
    // page's own `pillar` says which), so help/rows shows under the grid and,
    // for its Kanban and Scheduler pages, under Enterprise.
    pillars: PILLARS.map((p) => ({
      id:       p.id,
      title:    p.title,
      blurb:    p.blurb,
      sections: sections.filter((s) => docs.some((d) => d.section === s.id && d.pillar === p.id)).map((s) => s.id),
    })),
    sections,
    pages: docs,
    // Not routed docs: listed for models and the MCP server, keyed by the
    // /compare/ URL. `markdown` is the same text llms-full.txt carries.
    comparisons: comparePages.map(({ markdown, ...rest }) => rest),
  }
  await writeFile(join(DOCS_DIR, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

  // ---- llms.txt --------------------------------------------------------
  // Spec: https://llmstxt.org - a topic map with one-line summaries that
  // LLMs can fetch as a cheap first-pass context.
  // The header is what an LLM reads first, so it names the product the way
  // it is searched for (SvGrid, sv-grid, "Svelte data grid") and states the
  // free / paid split accurately. It used to open with "# sv-grid" alone and
  // list "AI helpers" under the paid pack; the AI helpers are free.
  // The brief (tools/lib/ai-brief.mjs) comes first: when SvGrid fits, a
  // working snippet, the free / paid line. The page map follows in reading
  // order, and the changelog, legal and brand pages sit last under
  // `## Optional`, the llmstxt.org name for what a model may skip. The
  // changelog used to be the first link in the file.
  const isOptional = (d) => OPTIONAL_PAGES.has(d.path) || OPTIONAL_SECTIONS.has(d.section)
  const docByPath = new Map(docs.map((d) => [d.path, d]))
  const listLine = (d) => {
    // Cut on a sentence or word boundary: a summary ending "an edit th..." reads worse than a shorter one.
    // A hand-written description beats the first paragraph, which on a page
    // that opens with a code sample can be "That's a complete, working grid."
    const trimmedSummary = clampDescription(d.seoDescription || d.summary, 200)
    return `- [${d.title}](${SITE}${d.url}): ${trimmedSummary || '(no summary yet)'}`
  }
  const llmsLines = [...brief]
  llmsLines.push('## Start here')
  llmsLines.push('')
  for (const p of START_HERE) if (docByPath.has(p)) llmsLines.push(listLine(docByPath.get(p)))
  llmsLines.push('')
  llmsLines.push('## Machine-readable copies')
  llmsLines.push('')
  llmsLines.push(`- Every docs page has a plain-markdown copy at its URL with the trailing slash replaced by \`.md\`, e.g. ${SITE}/docs/getting-started/1-install.md`)
  llmsLines.push(`- [llms-small.txt](${SITE}/llms-small.txt): the brief above plus the full text of the getting-started path and the pages asked about most before choosing a grid.`)
  llmsLines.push(`- [llms-full.txt](${SITE}/llms-full.txt): the full text of every docs page, the comparison pages and the API reference, in reading order.`)
  llmsLines.push(`- [docs.json](${SITE}/docs.json): the route manifest with section, tier and demo links per page.`)
  llmsLines.push('')
  // Pages in reading order: pillar, then section, then the curated page
  // order. llms-full.txt is written in the same order.
  const ordered = []
  // Each page is listed once, under its own pillar; a section whose pages
  // straddle two pillars (help/rows, help/server) appears under both with
  // only that pillar's pages.
  for (const pillar of manifest.pillars) {
    const pillarSections = manifest.sections
      .map((s) => ({ ...s, pages: s.pages.filter((p) => docByPath.get(p)?.pillar === pillar.id && !isOptional(docByPath.get(p))) }))
      .filter((s) => s.pages.length > 0)
    if (pillarSections.length === 0) continue
    llmsLines.push(`## ${pillar.title}`)
    llmsLines.push('')
    for (const { title, pages } of pillarSections) {
      llmsLines.push(`### ${title}`)
      llmsLines.push('')
      for (const p of pages) {
        const d = docByPath.get(p)
        ordered.push(d)
        llmsLines.push(listLine(d))
      }
      llmsLines.push('')
    }
  }
  const optional = docs.filter(isOptional)
  // Anything the pillar walk missed still ships, after the ordered pages.
  const listed = new Set([...ordered, ...optional])
  ordered.push(...docs.filter((d) => !listed.has(d)))
  if (comparePages.length) {
    llmsLines.push('## Comparisons')
    llmsLines.push('')
    llmsLines.push('### SvGrid vs other data grids')
    llmsLines.push('')
    for (const c of comparePages) {
      llmsLines.push(`- [${c.title}](${SITE}${c.url}): ${c.summary}`)
    }
    llmsLines.push('')
    // The answer to "which Svelte table library?", from each page's own
    // "when to choose" list (the same section the /compare/ hub opens with).
    llmsLines.push(renderCompareChoosingMarkdown(compareChoosingModel(comparisons), { site: SITE }))
  }
  if (optional.length) {
    llmsLines.push('## Optional')
    llmsLines.push('')
    for (const d of optional) llmsLines.push(listLine(d))
    llmsLines.push('')
  }
  await writeFile(join(DOCS_DIR, 'llms.txt'), llmsLines.join('\n'), 'utf-8')

  // ---- llms-full.txt ---------------------------------------------------
  // The brief first, then the pages in reading order, the comparison pages,
  // the API reference, and the optional pages (changelog, legal) last.
  const llmsFullLines = [...brief]
  llmsFullLines.push('## About this file')
  llmsFullLines.push('')
  llmsFullLines.push(
    `The full SvGrid documentation, generated ${new Date().toISOString().slice(0, 10)} from ${docs.length} pages` +
      (comparePages.length ? `, ${comparePages.length} comparison pages` : '') +
      (llmOnly.length ? `, plus ${llmOnly.length} API reference pages.` : '.') +
      ` A shorter selection is at ${SITE}/llms-small.txt.`,
  )
  llmsFullLines.push('')
  const pushDoc = async (d) => {
    const { body } = parseDocFrontmatter(await readFile(join(DOCS_DIR, d.path), 'utf-8'))
    llmsFullLines.push(`<!-- =================================================================`)
    llmsFullLines.push(`     ${d.url}  (${d.tier})`)
    llmsFullLines.push(`     ================================================================== -->`)
    llmsFullLines.push('')
    llmsFullLines.push(body.trim())
    // A narrated video's words are on the page as audio, as a captions track
    // and in its VideoObject, but not as prose - the visible transcript block
    // is only rendered for silent clips, where it is the sole text. A model
    // reading this corpus has no audio, so the narration is appended here.
    // Nothing is claimed that the page does not actually say out loud.
    for (const t of tutorialsOn(body)) {
      if (!t.player || !t.transcript?.length) continue
      llmsFullLines.push('')
      llmsFullLines.push(`## Transcript: ${t.title} (video, ${Math.round(t.duration)} s)`)
      llmsFullLines.push('')
      llmsFullLines.push(t.transcript.map((c) => normalizeNarration(c.text)).join(' '))
    }
    llmsFullLines.push('')
  }
  for (const d of ordered) await pushDoc(d)
  // The comparison pages, under the same separator shape as a docs page so
  // tools/lib/docs-corpus.mjs splits them back out for the site search. Every
  // number in them is a ledger value with its date; see the Sources section.
  for (const c of comparePages) {
    llmsFullLines.push(`<!-- =================================================================`)
    llmsFullLines.push(`     ${c.url}  (community)`)
    llmsFullLines.push(`     ================================================================== -->`)
    llmsFullLines.push('')
    llmsFullLines.push(c.markdown.trim())
    llmsFullLines.push('')
  }
  // The full typed API surface. It has no route - the /api page is the
  // human-facing one and routing both would be duplicate content - but a model
  // answering an API question has nothing else to read, so it ships here.
  // Marked as unrouted so nothing cites a URL that would 404.
  if (llmOnly.length) {
    llmsFullLines.push(`<!-- =================================================================`)
    llmsFullLines.push(`     API REFERENCE - source of truth for signatures and types.`)
    llmsFullLines.push(`     Not routed on the site: cite ${SITE}/api/ instead of a /docs URL.`)
    llmsFullLines.push(`     ================================================================== -->`)
    llmsFullLines.push('')
    for (const d of llmOnly.sort((a, b) => a.path.localeCompare(b.path))) {
      llmsFullLines.push(`<!-- docs/${d.path}  (unrouted) -->`)
      llmsFullLines.push('')
      llmsFullLines.push(d.body.trim())
      llmsFullLines.push('')
    }
  }
  for (const d of optional) await pushDoc(d)
  await writeFile(join(DOCS_DIR, 'llms-full.txt'), llmsFullLines.join('\n'), 'utf-8')

  // ---- llms-small.txt --------------------------------------------------
  // For an assistant that will spend one fetch on SvGrid: the brief plus the
  // full text of SMALL_CORPUS, with the site-only markup (video embeds, demo
  // placeholders, snippet-checker flags) reduced to plain markdown. Not
  // parsed by the docs search, so it carries no corpus separators.
  const tutorialRef = (id) => {
    const t = TUTORIAL_BY_ID.get(id)
    return t ? { title: t.title, youtube: t.youtubeId ? `https://www.youtube.com/watch?v=${t.youtubeId}` : undefined } : null
  }
  const knownSlugs = new Set(docs.map((d) => d.path.replace(/\.md$/, '')))
  const llmsSmallLines = [...brief]
  for (const p of SMALL_CORPUS) {
    const d = docByPath.get(p)
    if (!d) continue
    const { body } = parseDocFrontmatter(await readFile(join(DOCS_DIR, d.path), 'utf-8'))
    llmsSmallLines.push('---')
    llmsSmallLines.push('')
    llmsSmallLines.push(`Source: ${SITE}${d.url}`)
    llmsSmallLines.push('')
    llmsSmallLines.push(plainDocBody(body, { site: SITE, slug: d.path.replace(/\.md$/, ''), knownSlugs, demoTitle: (id) => demoTitles.get(id) ?? null, tutorial: tutorialRef }))
    llmsSmallLines.push('')
  }
  llmsSmallLines.push('---')
  llmsSmallLines.push('')
  llmsSmallLines.push(`Every other page: ${SITE}/llms.txt (index) and ${SITE}/llms-full.txt (full text).`)
  llmsSmallLines.push('')
  const llmsSmall = llmsSmallLines.join('\n')
  await writeFile(join(DOCS_DIR, 'llms-small.txt'), llmsSmall, 'utf-8')

  // ---- Sync served copies ----------------------------------------------
  // The website fetches these at /llms.txt, /llms-full.txt, /docs.json, so the
  // crawler-facing copies must live under website/public.
  await mkdir(PUBLIC_DIR, { recursive: true })
  await writeFile(join(PUBLIC_DIR, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms.txt'), llmsLines.join('\n'), 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms-full.txt'), llmsFullLines.join('\n'), 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms-small.txt'), llmsSmall, 'utf-8')

  // ---- Console summary --------------------------------------------------
  process.stdout.write(`build-docs-index: ${docs.length} pages → docs.json, llms.txt, llms-full.txt, llms-small.txt (${Math.round(llmsSmall.length / 1024)} KB) (docs/ + website/public/)\n`)
  process.stdout.write(`  enterprise: ${manifest.counts.enterprise} · with demo: ${manifest.counts.withDemo} · comparisons: ${comparePages.length}\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
