#!/usr/bin/env node
/**
 * Build the AI-era doc indexes:
 *
 *   docs/llms.txt        — topic map (one-line summaries, grouped by section)
 *   docs/llms-full.txt   — concatenated full text of every doc page
 *   docs/docs.json       — machine-readable route manifest with metadata
 *
 * Run it from anywhere: `node tools/build-docs-index.mjs`.
 *
 * The generator is deliberately dependency-free so it runs on a fresh
 * clone without `pnpm install`.
 */
import { readdir, readFile, writeFile, stat, mkdir } from 'node:fs/promises'
import { join, relative, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isHiddenDoc, parseDocFrontmatter } from './lib/doc-meta.mjs'

// Resolved from this file, not process.cwd(): the website's `prebuild` runs this
// with cwd set to website/, which used to make DOCS_DIR website/docs and fail.
const ROOT      = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR  = join(ROOT, 'docs')
const PUBLIC_DIR = join(ROOT, 'website', 'public') // served copies for crawlers
const SITE      = process.env.SVGRID_SITE_ORIGIN ?? 'https://svgrid.com'   // canonical doc origin

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
  'help/ui-components':'UI components',
  'recipes':           'Recipes / cookbook',
  'reference':         'API reference',
  'enterprise/studio': 'Studio',
  'enterprise':        'Enterprise tier',
  'compliance':        'Compliance',
  'legal':             'Legal',
  'brand':             'Brand',
}

// Product pillars — the top-level split a developer picks first, rendered as a
// header dropdown on the site (mirrors the demos dropdown). Order here is the
// dropdown order.
const PILLARS = [
  { id: 'grid',    title: 'SvGrid',        blurb: 'The Svelte 5 data grid.' },
  { id: 'studio',  title: 'SvGrid Studio', blurb: 'Turn a database or schema into a CRUD data-app.' },
  { id: 'ui',      title: 'SvGrid UI',     blurb: 'The Svelte component suite.' },
  { id: 'company', title: 'Enterprise & company', blurb: 'Licensing, support, compliance, legal.' },
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
  'recipes':           'grid',
  'reference':         'grid',
  'enterprise/studio': 'studio',
  'help/ui-components':'ui',
  'enterprise':        'company',
  'compliance':        'company',
  'legal':             'company',
  'brand':             'company',
}

// Curated sidebar order within a pillar (index = position; unknown → end).
// Replaces the old alphabetical sort that buried Getting started behind Brand.
const SECTION_ORDER = [
  '', 'getting-started', 'help',
  'help/cells', 'help/columns', 'help/rows',
  'help/editing', 'help/filtering', 'help/grouping',
  'help/headless', 'help/server', 'help/state',
  'recipes', 'reference',
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
const ENTERPRISE_SECTIONS = new Set(['enterprise', 'enterprise/studio'])

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
    !t.startsWith('* ') && !/^\d+\.\s/.test(t)
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? ''
    const t = l.trim()
    // Track fenced code so a leading ```svelte block is never mistaken for prose.
    if (t.startsWith('```')) { inFence = !inFence; continue }
    if (inFence) continue
    if (!title && l.startsWith('# ')) { title = l.slice(2).trim(); continue }
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

/** Group docs by their parent folder. */
function sectionOf(relPath) {
  const parts = relPath.split(sep)
  if (parts.length === 1) return ''
  // Studio is its own section (and pillar), split out of the broad `enterprise`
  // bucket so its ~40 pages don't share a sidebar with licensing/support.
  if (parts[0] === 'enterprise' && parts[1] && parts[1].startsWith('studio')) return 'enterprise/studio'
  if (parts[0] === 'help' && parts.length > 2) return `help/${parts[1]}`
  return parts[0]
}

async function main() {
  const docs = []
  for await (const file of walk(DOCS_DIR)) {
    if (!file.endsWith('.md')) continue
    const rel = relative(DOCS_DIR, file).replaceAll('\\', '/')
    // Pages the site cannot route (shared with the prerenderer and the SPA via
    // tools/lib/doc-meta.mjs); listing them would advertise 404s to crawlers.
    if (isHiddenDoc(rel.replace(/\.md$/, ''))) continue
    // Optional search-facing frontmatter (seoTitle, seoDescription, keywords,
    // noindex); the body is what every consumer renders and indexes.
    const { meta, body } = parseDocFrontmatter(await readFile(file, 'utf-8'))
    const { title, summary } = extract(body)
    if (!title) continue
    const s = await stat(file)
    const section = sectionOf(rel.replaceAll('/', sep))
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
      pillar:      SECTION_PILLAR[section] ?? 'grid',
      tier:        ENTERPRISE_SECTIONS.has(section) || /\bEnterprise\b/.test(title) ? 'enterprise' : 'community',
      ...(pageGroupLabel.has(rel) ? { group: pageGroupLabel.get(rel) } : {}),
      words:       body.split(/\s+/).filter(Boolean).length,
      lastUpdated: s.mtime.toISOString().slice(0, 10),
      // Demo associations come from two link styles: the `data-docs-demo`
      // embeds (help/ pages) and inline `#/demos/<id>` links (studio/ pages).
      demoIds:     [...new Set([
        ...[...body.matchAll(/data-docs-demo="([^"]+)"/g)].map((m) => m[1]),
        ...[...body.matchAll(/#\/demos\/(\d+-[a-z0-9-]+)/g)].map((m) => m[1]),
      ])],
    })
  }
  docs.sort((a, b) => a.path.localeCompare(b.path))

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
    // Product pillars — the top-level split, rendered as a header dropdown.
    pillars: PILLARS.map((p) => ({
      id:       p.id,
      title:    p.title,
      blurb:    p.blurb,
      sections: sections.filter((s) => s.pillar === p.id).map((s) => s.id),
    })),
    sections,
    pages: docs,
  }
  await writeFile(join(DOCS_DIR, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

  // ---- llms.txt --------------------------------------------------------
  // Spec: https://llmstxt.org - a topic map with one-line summaries that
  // LLMs can fetch as a cheap first-pass context.
  const llmsLines = []
  llmsLines.push('# sv-grid')
  llmsLines.push('')
  llmsLines.push('> The Svelte 5-native data grid. Headless engine + render component, AI-native, WAI-ARIA, virtualized to 100k rows.')
  llmsLines.push('')
  llmsLines.push('Two npm packages: `@svgrid/grid` (MIT, open source) and `@svgrid/enterprise` (commercial - export, import, pivot, AI helpers).')
  llmsLines.push('')
  llmsLines.push('For the full text of every doc page concatenated: see [llms-full.txt](/llms-full.txt).')
  llmsLines.push('For a machine-readable manifest: see [docs.json](/docs.json).')
  llmsLines.push('')
  for (const pillar of manifest.pillars) {
    const pillarSections = manifest.sections.filter(
      (s) => s.pillar === pillar.id && s.pages.length > 0,
    )
    if (pillarSections.length === 0) continue
    llmsLines.push(`## ${pillar.title}`)
    llmsLines.push('')
    for (const { title, pages } of pillarSections) {
      llmsLines.push(`### ${title}`)
      llmsLines.push('')
      for (const p of pages) {
        const d = docs.find((x) => x.path === p)
        const trimmedSummary = d.summary.length > 200 ? d.summary.slice(0, 197) + '…' : d.summary
        llmsLines.push(`- [${d.title}](${SITE}${d.url}): ${trimmedSummary || '(no summary yet)'}`)
      }
      llmsLines.push('')
    }
  }
  await writeFile(join(DOCS_DIR, 'llms.txt'), llmsLines.join('\n'), 'utf-8')

  // ---- llms-full.txt ---------------------------------------------------
  const llmsFullLines = []
  llmsFullLines.push('# sv-grid - full documentation')
  llmsFullLines.push('')
  llmsFullLines.push(`Generated ${new Date().toISOString().slice(0, 10)} from ${docs.length} pages.`)
  llmsFullLines.push('')
  for (const d of docs) {
    const { body } = parseDocFrontmatter(await readFile(join(DOCS_DIR, d.path), 'utf-8'))
    llmsFullLines.push(`<!-- =================================================================`)
    llmsFullLines.push(`     ${d.url}  (${d.tier})`)
    llmsFullLines.push(`     ================================================================== -->`)
    llmsFullLines.push('')
    llmsFullLines.push(body.trim())
    llmsFullLines.push('')
  }
  await writeFile(join(DOCS_DIR, 'llms-full.txt'), llmsFullLines.join('\n'), 'utf-8')

  // ---- Sync served copies ----------------------------------------------
  // The website fetches these at /llms.txt, /llms-full.txt, /docs.json, so the
  // crawler-facing copies must live under website/public.
  await mkdir(PUBLIC_DIR, { recursive: true })
  await writeFile(join(PUBLIC_DIR, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms.txt'), llmsLines.join('\n'), 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms-full.txt'), llmsFullLines.join('\n'), 'utf-8')

  // ---- Console summary --------------------------------------------------
  process.stdout.write(`build-docs-index: ${docs.length} pages → docs.json, llms.txt, llms-full.txt (docs/ + website/public/)\n`)
  process.stdout.write(`  enterprise: ${manifest.counts.enterprise} · with demo: ${manifest.counts.withDemo}\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
