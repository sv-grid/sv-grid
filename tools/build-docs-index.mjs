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
import { readdir, readFile, writeFile, stat, mkdir, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
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
import { parseTypeMembers } from '../packages/mcp/scripts/api-surface.mjs'
import { tutorialIdsIn, normalizeNarration } from './lib/tutorial-media.mjs'
import { readManifest as readTutorialManifest } from './tutorials/lib/manifest.mjs'
import { aiBriefLines, START_HERE, SMALL_CORPUS, OPTIONAL_SECTIONS, OPTIONAL_PAGES, plainDocBody, tutorialPointers } from './lib/ai-brief.mjs'

// Resolved from this file, not process.cwd(): the website's `prebuild` runs this
// with cwd set to website/, which used to make DOCS_DIR website/docs and fail.
const ROOT      = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR  = join(ROOT, 'docs')
const PUBLIC_DIR = join(ROOT, 'website', 'public') // served copies for crawlers
const SITE      = process.env.SVGRID_SITE_ORIGIN ?? 'https://svgrid.com'   // canonical doc origin
const MCP_REMOTE = 'https://mcp.svgrid.com/mcp'

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
  'help/base':         'SvGrid Base',
  'help/export':       'Import & export',
  'help/pivot':        'Pivot grid',
  'help/kanban':       'Kanban',
  'help/scheduler':    'Scheduler',
  'help/alerts':       'Alerts & scheduling',
  'help/review':       'Change review',
  'help/ui-components':'UI components',
  'help/ui-blocks':    'UI blocks',
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
// grid and its UI kit, then the Enterprise products). Order here is the
// dropdown order. Mirrors PILLARS in website/src/lib/docs.ts.
const PILLARS = [
  { id: 'grid',       title: 'SvGrid',             blurb: 'The Svelte 5 data grid.' },
  { id: 'ui',         title: 'SvGrid UI',          blurb: 'The Svelte component suite.' },
  { id: 'enterprise', title: 'SvGrid Enterprise',  blurb: 'The paid modules on the grid; licensing, support, compliance, legal.' },
  { id: 'sheet',      title: 'SvGrid Spreadsheet', blurb: 'The grid as an Excel-like spreadsheet.' },
  { id: 'base',       title: 'SvGrid Base',        blurb: 'A table database: fields, views, forms and records.' },
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
  'help/base':         'base',
  'help/export':       'enterprise',
  'help/pivot':        'enterprise',
  'help/kanban':       'enterprise',
  'help/scheduler':    'enterprise',
  'help/alerts':       'enterprise',
  'help/review':       'enterprise',
  'recipes':           'grid',
  'reference':         'grid',
  'enterprise/studio': 'studio',
  'help/ui-components':'ui',
  'help/ui-blocks':    'ui',
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
  'help/rows/gallery':              'enterprise',
  'help/rows/scheduler':            'enterprise',
  'help/rows/gantt':                'enterprise',
  'help/gantt':                     'enterprise',
  'help/fields':                    'base',
  'help/alerts':                    'enterprise',
  'help/scheduling':                'enterprise',
  'help/cells/spreadsheet-shell':   'sheet',
  'help/spreadsheet-formulas':      'sheet',
  'help/cells/workbooks':           'sheet',
  'help/cells/tables':              'sheet',
  'help/web-components/sv-sheet':   'sheet',
}
/**
 * When each page last changed, for docs.json `lastUpdated`. A file's mtime is
 * when the checkout wrote it, so in CI and in any fresh clone every page read
 * as changed that day, and each release commit rewrote all of the dates. The
 * last commit that touched the page is the answer; a page edited and not yet
 * committed is today's (its mtime). A shallow clone (the site deploy) has no
 * history, so it keeps the date the committed docs.json already holds, and
 * mtime is the last resort for a page in neither.
 */
function lastUpdatedDates() {
  const fromGit = new Map()
  const dirty = new Set()
  const git = (args) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  try {
    if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'true') {
      let date = ''
      for (const line of git(['log', '--format=%x00%cs', '--name-only', '--', 'docs']).split('\n')) {
        if (line.startsWith('\0')) date = line.slice(1)
        else if (line.startsWith('docs/') && !fromGit.has(line.slice(5))) fromGit.set(line.slice(5), date)
      }
      for (const line of git(['status', '--porcelain', '--', 'docs']).split('\n')) {
        const path = line.slice(3).split(' -> ').pop()
        if (path?.startsWith('docs/')) dirty.add(path.slice(5))
      }
    }
  } catch { /* not a git checkout: the committed dates, then mtime */ }
  const committed = new Map()
  try {
    for (const p of JSON.parse(readFileSync(join(DOCS_DIR, 'docs.json'), 'utf-8')).pages ?? []) {
      if (p.path && p.lastUpdated) committed.set(p.path, p.lastUpdated)
    }
  } catch { /* no manifest yet */ }
  const day = (d) => d.toISOString().slice(0, 10)
  return (rel, mtime) => (dirty.has(rel) ? day(mtime) : fromGit.get(rel) ?? committed.get(rel) ?? day(mtime))
}

const pillarOf = (slug, section) => PAGE_PILLAR[slug] ?? SECTION_PILLAR[section] ?? 'grid'

// Curated sidebar order within a pillar (index = position; unknown → end).
// Replaces the old alphabetical sort that buried Getting started behind Brand.
// Block group ids, in sidebar order: one docs page each under help/ui-blocks/.
const BLOCK_GROUP_IDS = JSON.parse(
  readFileSync(join(ROOT, 'examples', 'src', 'shared', 'block-groups.json'), 'utf8'),
).map((g) => g.id)

const SECTION_ORDER = [
  '', 'getting-started', 'help',
  'help/cells', 'help/columns', 'help/rows',
  'help/editing', 'help/filtering', 'help/grouping',
  'help/headless', 'help/server', 'help/state', 'help/charts', 'help/gantt', 'help/sheet', 'help/base',
  'help/export', 'help/pivot', 'help/kanban', 'help/scheduler', 'help/alerts', 'help/review',
  // Before recipes, matching CATEGORY_ORDER in website/src/lib/docs.ts - this
  // list drives docs.json and llms.txt, that one drives the visible sidebar,
  // and a reader following the topic map should meet them in the same order.
  'help/web-components', 'recipes', 'reference',
  'enterprise/studio',
  'help/ui-components',
  'help/ui-blocks',
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
  // SvGrid Base: the tutorial, the ready-to-use bases, a base on a database,
  // then the field types
  // reference routed in from help/ (SECTION_OVERRIDE in doc-meta.mjs).
  'help/base': [
    { label: 'Start here', pages: ['quick-start', 'start', 'templates'] },
    { label: 'Build it out', pages: ['linked-records', 'formulas', 'views', 'forms', 'collaboration', 'custom-field-type'] },
    { label: 'Automate', pages: ['automations'] },
    { label: 'Connect your data', pages: ['data', 'supabase', 'postgres', 'rest-api'] },
    { label: 'AI agents', pages: ['ai-agents', 'review-queue'] },
    { label: 'Reference', pages: ['help/fields.md'] },
  ],
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
  // The suite overview first, then the component families in the sidebar's
  // order (UI_FAMILIES in website/src/lib/docs.ts). Alphabetical put "Buttons"
  // ahead of the overview. No labels, so docs.json gets no extra groups.
  'help/ui-components': [{ label: '', pages: [
    'index', 'cli', 'headless-editors', 'i18n-rtl',
    'buttons', 'sv-button', 'sv-button-group', 'sv-repeat-button', 'sv-toggle-button', 'sv-switch-button', 'sv-check-box', 'sv-radio-group', 'sv-segmented', 'sv-rating',
    'inputs', 'sv-text-input', 'sv-text-area', 'sv-number-input', 'sv-password-input', 'sv-masked-input', 'sv-phone-input', 'sv-color-input', 'sv-otp-input', 'sv-duration-input', 'sv-tags-input',
    'selection', 'sv-list-box', 'sv-drop-down-list', 'sv-combo-box', 'sv-auto-complete', 'sv-multi-select', 'sv-tree-select', 'sv-grid-select', 'sv-grid-dropdown', 'sv-country-input',
    'date-time', 'sv-calendar', 'sv-time-picker', 'sv-date-time-picker', 'sv-date-range-input',
    'range', 'sv-slider', 'sv-gauge', 'sv-progress', 'sv-circular-progress', 'sv-sparkline', 'sv-stat',
    'overlays', 'sv-popover', 'sv-hover-card', 'sv-tooltip', 'sv-popconfirm', 'sv-modal', 'sv-drawer', 'sv-toaster', 'sv-context-menu', 'sv-menu', 'sv-menu-list', 'sv-menubar',
    'layout', 'sv-layout-primitives', 'sv-tabs', 'sv-accordion', 'sv-collapsible', 'sv-splitter', 'sv-dock-layout', 'sv-dock-manager', 'sv-card', 'sv-divider', 'sv-scroll-area', 'sv-grid-chart', 'sv-chart-panes', 'sv-form', 'sv-field', 'sv-file-upload',
    'feedback', 'sv-badge', 'sv-skeleton', 'sv-spinner', 'sv-loading-overlay', 'sv-alert', 'sv-empty-state', 'sv-result', 'sv-chip', 'sv-timeline', 'sv-avatar', 'sv-avatar-group', 'sv-carousel', 'sv-typography', 'sv-display-primitives',
    'navigation', 'sv-breadcrumb', 'sv-pagination', 'sv-stepper', 'sv-nav-pane', 'sv-tree', 'sv-command', 'sv-tour', 'sv-rich-text',
  ] }],
  // The blocks overview, then one page per block group in the gallery's
  // order (examples/src/shared/block-groups.json).
  'help/ui-blocks': [{ label: '', pages: ['index', ...BLOCK_GROUP_IDS] }],
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
  'legal', 'enterprise', 'enterprise/studio', 'help/sheet', 'help/base', 'help/export', 'help/pivot', 'help/kanban', 'help/scheduler', 'help/alerts'])

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

  const lastUpdated = lastUpdatedDates()
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
      lastUpdated: lastUpdated(rel, s.mtime),
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
  // Sizes are filled in once every file is built (SIZE_OF below): an agent
  // deciding what to fetch needs them, and llms-full.txt is past what any fetch
  // tool returns whole.
  llmsLines.push(`- Every docs page has a plain-markdown copy at its URL with the trailing slash replaced by \`.md\`, e.g. ${SITE}/docs/getting-started/1-install.md`)
  llmsLines.push(`- This index by product, each part on its own and sized for one fetch: ${[...manifest.pillars.map((p) => `[${p.title}](${SITE}/llms/${p.id}.txt) (@@size:llms/${p.id}@@)`), `[Comparisons: which Svelte table library to use](${SITE}/llms/compare.txt) (@@size:llms/compare@@)`].join(', ')}`)
  llmsLines.push(`- [llms-small.txt](${SITE}/llms-small.txt) (@@size:small@@): not an index. The brief above plus the FULL TEXT of the getting-started path and the pages asked about most before choosing a grid.`)
  llmsLines.push(`- [llms-full.txt](${SITE}/llms-full.txt) (@@size:full@@): the full text of every docs page, the comparison pages and the API reference, in reading order. Too large for one fetch; read the parts above, or one page as .md.`)
  llmsLines.push(`- [docs.json](${SITE}/docs.json): the route manifest with section, tier and demo links per page.`)
  llmsLines.push(`- [demos.md](${SITE}/demos.md): every live demo by category. Each has a markdown copy with its full source at /demos/<id>.md, e.g. ${SITE}/demos/01-quick-start.md`)
  llmsLines.push(`- [API reference as JSON](${SITE}/api.json): look up any function, type, option or api method of @svgrid/grid and @svgrid/enterprise by name. Every export by module, with the member names of each type (options objects, props, SvGridApi). ${SITE}/api/<name lowercased>.json has a symbol's doc and signature, e.g. ${SITE}/api/createsvgrid.json; a member name (getRowPosition, onCellClick) has a file naming its type. \`<SvGrid>\` props, each with its signature: ${SITE}/api/svgrid.json`)
  llmsLines.push(`- MCP server: the remote endpoint ${MCP_REMOTE} (streamable HTTP, no install), or \`npx -y @svgrid/mcp\` locally. Described at ${SITE}/.well-known/mcp.json.`)
  llmsLines.push('')
  // Pages in reading order: pillar, then section, then the curated page
  // order. llms-full.txt is written in the same order.
  const ordered = []
  // Each page is listed once, under its own pillar; a section whose pages
  // straddle two pillars (help/rows, help/server) appears under both with
  // only that pillar's pages.
  // Each pillar's part of this file, kept for its own /llms/<pillar>.txt.
  const sliceStarts = []
  for (const pillar of manifest.pillars) {
    const pillarSections = manifest.sections
      .map((s) => ({ ...s, pages: s.pages.filter((p) => docByPath.get(p)?.pillar === pillar.id && !isOptional(docByPath.get(p))) }))
      .filter((s) => s.pages.length > 0)
    if (pillarSections.length === 0) continue
    sliceStarts.push({ id: pillar.id, title: pillar.title, at: llmsLines.length })
    llmsLines.push(`## ${pillar.title}`)
    llmsLines.push('')
    // The component list opens on the grid: <SvGrid> is the suite's hero
    // component and the reason the rest of it exists, so a model reading the
    // UI section should not meet "Buttons & toggles" first.
    if (pillar.id === 'ui') {
      llmsLines.push('### The hero component')
      llmsLines.push('')
      llmsLines.push(`- [<SvGrid>](${SITE}/docs/getting-started/): the Svelte 5 data grid, and the component the rest of SvGrid UI is built around. Every editor below doubles as a cell editor inside it. \`import { SvGrid } from '@svgrid/grid'\`. Live demos with source: ${SITE}/demos/`)
      llmsLines.push('')
    }
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
    sliceStarts.push({ id: 'compare', title: 'Comparisons', at: llmsLines.length })
    llmsLines.push('## Comparisons')
    llmsLines.push('')
    llmsLines.push(`- [Which Svelte table library should I use?](${SITE}/compare/): every comparison on one page, with when to choose each library.`)
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
  const slicesEnd = llmsLines.length
  if (optional.length) {
    llmsLines.push('## Optional')
    llmsLines.push('')
    for (const d of optional) llmsLines.push(listLine(d))
    llmsLines.push('')
  }
  // This file is past 100 KB, about where an agent's fetch tool cuts a
  // response, and the last pillars (Studio) and the comparisons sat beyond the
  // cut. Each part also stands alone, linked from the top of this file.
  const llmsSlices = sliceStarts.map((s, i) => ({
    id: s.id,
    text: [
      `# ${s.title}: SvGrid docs index`,
      '',
      `> Part of ${SITE}/llms.txt. Each docs page has a markdown copy at its URL with the trailing slash replaced by \`.md\`.`,
      '',
      ...llmsLines.slice(s.at + 1, sliceStarts[i + 1]?.at ?? slicesEnd),
    ].join('\n'),
  }))
  await mkdir(join(DOCS_DIR, 'llms'), { recursive: true })
  for (const s of llmsSlices) await writeFile(join(DOCS_DIR, 'llms', `${s.id}.txt`), s.text, 'utf-8')

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
    // The <figure><video> markup becomes one pointer line; the narration
    // follows below as text, which is the part a model can use.
    llmsFullLines.push(tutorialPointers(body, (id) => {
      const t = TUTORIAL_BY_ID.get(id)
      return t ? { title: t.title, youtube: t.youtubeId ? `https://www.youtube.com/watch?v=${t.youtubeId}` : undefined } : null
    }).trim())
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

  // ---- llms.txt, with the size of each file it points at ----------------
  // Written last: the sizes are the files' own, measured here, not typed.
  const SIZE_OF = {
    full: llmsFullLines.join('\n'),
    small: llmsSmall,
    ...Object.fromEntries(llmsSlices.map((sl) => [`llms/${sl.id}`, sl.text])),
  }
  const humanSize = (text) => {
    const kb = Buffer.byteLength(text, 'utf-8') / 1024
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`
  }
  const llmsText = llmsLines
    .join('\n')
    .replace(/ \(@@size:([a-z0-9/-]+)@@\)/g, (_, key) => (key in SIZE_OF ? ` (${humanSize(SIZE_OF[key])})` : ''))
  await writeFile(join(DOCS_DIR, 'llms.txt'), llmsText, 'utf-8')

  // ---- Sync served copies ----------------------------------------------
  // The website fetches these at /llms.txt, /llms-full.txt, /docs.json, so the
  // crawler-facing copies must live under website/public.
  await mkdir(PUBLIC_DIR, { recursive: true })
  await writeFile(join(PUBLIC_DIR, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms.txt'), llmsText, 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms-full.txt'), llmsFullLines.join('\n'), 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms-small.txt'), llmsSmall, 'utf-8')
  await mkdir(join(PUBLIC_DIR, 'llms'), { recursive: true })
  for (const s of llmsSlices) await writeFile(join(PUBLIC_DIR, 'llms', `${s.id}.txt`), s.text, 'utf-8')
  // The hand-written API reference (reference/SvGrid.md for <SvGrid>'s props,
  // ColumnDef, SvGridApi, ...) has no HTML route - /docs/reference/* redirects
  // to /api/ - so an agent following check_svgrid_code's `see: reference/SvGrid`
  // or /api/svgrid.json's `props` link had nothing to fetch outside
  // llms-full.txt. A markdown copy is not a second page for search engines.
  // reference/auto/* is per-module and already served as /api/<name>.json.
  for (const d of llmOnly) {
    if (!/^reference\/[^/]+\.md$/.test(d.path)) continue
    const file = join(PUBLIC_DIR, 'docs', ...d.path.split('/'))
    await mkdir(dirname(file), { recursive: true })
    const body = plainDocBody(d.body, { site: SITE, slug: d.path.replace(/\.md$/, ''), knownSlugs, demoTitle: (id) => demoTitles.get(id) ?? null, tutorial: tutorialRef })
    await writeFile(file, `${body}\n`, 'utf-8')
  }
  const apiCount = await writeApiJson()
  await writeMcpDiscovery()

  // ---- Console summary --------------------------------------------------
  process.stdout.write(`build-docs-index: ${docs.length} pages → docs.json, llms.txt, llms-full.txt, llms-small.txt (${Math.round(llmsSmall.length / 1024)} KB) (docs/ + website/public/), api.json (${apiCount} symbols)\n`)
  process.stdout.write(`  enterprise: ${manifest.counts.enterprise} · with demo: ${manifest.counts.withDemo} · comparisons: ${comparePages.length}\n`)
}

/**
 * The API reference for agents that look a name up: /api.json, every symbol
 * by module and kind with the member names of each type, small enough for one
 * fetch (a fetch tool cuts near 100 KB), and /api/<name>.json with the doc
 * and signature. Files are named by the lowercased name and hold every symbol
 * of that name, so `tableFeatures` and `TableFeatures` share one file instead
 * of overwriting each other on a case-insensitive disk.
 * Source: docs/reference/auto/api.json, written by tools/build-reference.mjs.
 */
async function writeApiJson() {
  const { symbols } = JSON.parse(await readFile(join(DOCS_DIR, 'reference', 'auto', 'api.json'), 'utf-8'))
  const version = (pkg) => JSON.parse(readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf-8')).version
  const modules = new Map()
  const byName = new Map()
  // A function's one-line summary, cut at a word: with them the index still fits one fetch.
  const short = (s) => (s.length <= 70 ? s : `${s.slice(0, s.lastIndexOf(' ', 67))}...`)
  for (const s of symbols) {
    if (!modules.has(s.module)) modules.set(s.module, { module: s.module, import: s.import, functions: {}, values: [], types: {} })
    const m = modules.get(s.module)
    if (s.kind === 'function' || s.kind === 'class') m.functions[s.name] = short(s.summary)
    else if (s.kind === 'const') m.values.push(s.name)
    else m.types[s.name] = s.members
    const key = s.name.toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    const usage = `import ${s.kind === 'type' || s.kind === 'interface' ? 'type ' : ''}{ ${s.name} } from '${s.import}'`
    byName.get(key).push({ name: s.name, kind: s.kind, usage, summary: s.summary, ...(s.members.length ? { members: s.members } : {}), doc: s.doc, signature: s.signature })
  }
  const index = {
    name: 'SvGrid API reference',
    versions: { '@svgrid/grid': version('grid'), '@svgrid/enterprise': version('enterprise') },
    symbol: `${SITE}/api/<name lowercased>.json has a symbol's doc and signature, e.g. ${SITE}/api/svgridapi.json`,
    // Agents asked for /api/getRowPosition.json first: a member has no file of its own.
    member: `A member (a method or option such as getRowPosition) has a small file naming the types it belongs to, e.g. ${SITE}/api/getrowposition.json -> ${SITE}/api/svgridapi.json`,
    component: `<SvGrid> props, each with its signature: ${SITE}/api/svgrid.json (component.props). The SvGrid type in this index is the headless instance, not the component.`,
    docs: `${SITE}/llms.txt`,
    modules: [...modules.values()],
  }
  // One module per line: readable, and still small.
  const lines = JSON.stringify({ ...index, modules: [] }).replace('"modules":[]}', '"modules":[\n')
  await writeFile(join(PUBLIC_DIR, 'api.json'), lines + index.modules.map((m) => JSON.stringify(m)).join(',\n') + '\n]}\n', 'utf-8')
  const dir = join(PUBLIC_DIR, 'api')
  await mkdir(dir, { recursive: true })
  // Clear the old files first: a removed export must not keep its page.
  for (const f of await readdir(dir)) if (f.endsWith('.json')) await rm(join(dir, f))

  // Agents guess /api/<member>.json (getRowPosition, onCellClick) before they
  // read the hint above, and got the HTML 404. Each member name now answers
  // with the types it belongs to; a name that is also a symbol says both.
  const memberOf = new Map()
  const addMember = (member, type, entry) => {
    const key = member.toLowerCase()
    if (!memberOf.has(key)) memberOf.set(key, { name: member, of: new Map() })
    memberOf.get(key).of.set(type, entry)
  }
  for (const s of symbols) {
    for (const m of s.members) addMember(m, s.name, { url: `${SITE}/api/${s.name.toLowerCase()}.json` })
  }
  // <SvGrid>'s own props (onCellClick, rowHeight, ...) are not members of any
  // exported type, so they come from the component's Props, read the same way
  // the MCP server reads them for check_svgrid_code.
  const propsText = readFileSync(join(ROOT, 'packages', 'grid', 'src', 'SvGrid.types.ts'), 'utf-8')
  const gridProps = parseTypeMembers(propsText, 'Props').map((p) => ({ name: p.name, signature: `${p.name}${p.optional ? '?' : ''}: ${p.type}` }))
  for (const p of gridProps) addMember(p.name, '<SvGrid> prop', { url: `${SITE}/api/svgrid.json`, signature: p.signature })
  const pointers = (key) => [...memberOf.get(key).of].map(([type, entry]) => ({ type, ...entry }))

  // `SvGrid` the type is the headless instance; `<SvGrid>` the component has
  // the same name and its props live elsewhere. /api/svgrid.json is the first
  // URL an agent tries for the component, so it says so up front.
  const COMPONENTS = {
    svgrid: {
      name: '<SvGrid>',
      usage: "import { SvGrid } from '@svgrid/grid'",
      summary: 'The render component. Its props are listed here, read from its Props type; they are NOT the members of the `SvGrid` type below (that type is the headless instance createSvGrid returns).',
      guide: `${SITE}/docs/reference/SvGrid.md`,
      api: `${SITE}/api/svgridapi.json`,
      props: gridProps,
    },
  }

  for (const [key, list] of byName) {
    const body = {
      ...(COMPONENTS[key] ? { component: COMPONENTS[key] } : {}),
      symbols: list,
      ...(memberOf.has(key) ? { memberOf: pointers(key) } : {}),
    }
    await writeFile(join(dir, `${key}.json`), JSON.stringify(body, null, 1) + '\n', 'utf-8')
  }
  for (const [key, { name }] of memberOf) {
    if (byName.has(key)) continue
    // A member name can contain characters a file name cannot hold.
    if (!/^[a-z0-9_$-]+$/.test(key)) continue
    await writeFile(join(dir, `${key}.json`), JSON.stringify({ member: name, memberOf: pointers(key) }, null, 1) + '\n', 'utf-8')
  }
  return symbols.length
}

/**
 * Where the MCP server is, for clients that look before they are told:
 * /.well-known/mcp/server.json is the registry manifest the release keeps
 * current (packages/mcp/server.json), and /.well-known/mcp.json says the same
 * in a few lines with the setup commands and the docs page.
 */
async function writeMcpDiscovery() {
  const server = JSON.parse(await readFile(join(ROOT, 'packages', 'mcp', 'server.json'), 'utf-8'))
  const dir = join(PUBLIC_DIR, '.well-known', 'mcp')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'server.json'), JSON.stringify(server, null, 2) + '\n', 'utf-8')
  const summary = {
    name: server.title,
    description: server.description,
    remote: { url: MCP_REMOTE, transport: 'streamable-http' },
    local: { command: 'npx -y @svgrid/mcp', package: '@svgrid/mcp', version: server.version, transport: 'stdio' },
    setup: {
      'claude-code': `claude mcp add --transport http svgrid ${MCP_REMOTE}`,
      json: { mcpServers: { svgrid: { type: 'http', url: MCP_REMOTE } } },
    },
    manifest: `${SITE}/.well-known/mcp/server.json`,
    docs: server.websiteUrl,
  }
  await writeFile(join(PUBLIC_DIR, '.well-known', 'mcp.json'), JSON.stringify(summary, null, 2) + '\n', 'utf-8')
}

main().catch((err) => { console.error(err); process.exit(1) })
