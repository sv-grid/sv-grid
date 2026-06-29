#!/usr/bin/env node
/**
 * Prerender the SvGrid site to real, individually-indexable static HTML.
 *
 * The app is a Svelte SPA, but search engines and AI crawlers index URLs, not
 * client routes. This script runs after `vite build` (as website's postbuild)
 * and, for every route + every doc page, writes a static `index.html` at a
 * clean path (e.g. dist/docs/help/columns/column-definitions/index.html) that
 * contains:
 *
 *   - the correct <title>, meta description, canonical, OpenGraph/Twitter,
 *   - a TechArticle + BreadcrumbList JSON-LD graph (doc pages),
 *   - the fully-rendered doc HTML inside #root as crawlable content,
 *   - the same hashed script/style tags as the SPA shell, so the page hydrates
 *     into the live app on the client (main.ts clears #root before mounting).
 *
 * It also (re)generates sitemap.xml with every real URL and a 404.html SPA
 * fallback. Dependency-light: only `marked`, resolved from the website package.
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, relative, dirname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { blogCardSvg, rasterizePng } from './blog-card.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const DOCS_DIR = join(ROOT, 'docs')
const DEMOS_DIR = join(ROOT, 'examples', 'src', 'demos')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')
const DIST = join(ROOT, 'website', 'dist')
const PUBLIC = join(ROOT, 'website', 'public')

const BASE = process.env.SVGRID_SITE_BASE ?? '/' // "/" (custom domain) or "/sv-grid/"
const ORIGIN = process.env.SVGRID_SITE_ORIGIN ?? 'https://svgrid.com'
const CANON = ORIGIN + BASE.replace(/\/$/, '') // "https://svgrid.com"
const SITE_HOST = ORIGIN.replace(/^https?:\/\//, '') // "svgrid.com"

// marked lives in the website package; resolve it from there. require.resolve
// lands on the CJS build, whose interop exposes everything under `default`.
const requireFromWebsite = createRequire(join(ROOT, 'website', 'package.json'))
const markedNs = await import(pathToFileURL(requireFromWebsite.resolve('marked')).href)
const Marked = (markedNs.default ?? markedNs).Marked

// Blog card SVG generator + best-effort PNG rasterizer live in ./blog-card.mjs
// so the dev server (vite.config.ts middleware) and this build-time prerender
// produce identical /og/blog/<slug>.{svg,png} images.

// ---- small html helpers ----------------------------------------------------

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`)
}
function setMeta(html, attr, key, content) {
  const clean = `<meta ${attr}="${key}" content="${escapeAttr(content)}" />`
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}=["']${key}["'][^>]*>`, 'i')
  return re.test(html) ? html.replace(re, clean) : html.replace('</head>', `    ${clean}\n  </head>`)
}
function setCanonical(html, url) {
  const clean = `<link rel="canonical" href="${escapeAttr(url)}" />`
  const re = /<link\b[^>]*rel=["']canonical["'][^>]*>/i
  return re.test(html) ? html.replace(re, clean) : html.replace('</head>', `    ${clean}\n  </head>`)
}
function injectJsonLd(html, obj) {
  const snippet = `    <script type="application/ld+json" data-seo="prerender">${JSON.stringify(obj)}</script>\n  </head>`
  return html.replace('</head>', snippet)
}
function injectBody(html, bodyHtml) {
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)
}

function applyHead(html, { title, description, canonical, ogType, keywords, image, imageAlt }) {
  html = setTitle(html, title)
  html = setMeta(html, 'name', 'description', description)
  if (keywords) html = setMeta(html, 'name', 'keywords', keywords)
  html = setCanonical(html, canonical)
  html = setMeta(html, 'property', 'og:type', ogType ?? 'website')
  html = setMeta(html, 'property', 'og:title', title)
  html = setMeta(html, 'property', 'og:description', description)
  html = setMeta(html, 'property', 'og:url', canonical)
  html = setMeta(html, 'name', 'twitter:title', title)
  html = setMeta(html, 'name', 'twitter:description', description)
  // Open Graph image - section-specific card when provided, else the default
  // PNG. PNG is preferred because some scrapers (LinkedIn in particular) ignore
  // SVG OG images; the SVG default is also emitted by index.html as a secondary
  // og:image for clients that prefer it.
  const img = image || `${CANON}/og-image.png`
  const isPng = /\.png(\?|$)/i.test(img)
  const alt = imageAlt || title
  html = setMeta(html, 'property', 'og:image', img)
  html = setMeta(html, 'property', 'og:image:width', '1200')
  html = setMeta(html, 'property', 'og:image:height', '630')
  html = setMeta(html, 'property', 'og:image:type', isPng ? 'image/png' : 'image/svg+xml')
  html = setMeta(html, 'property', 'og:image:alt', alt)
  html = setMeta(html, 'name', 'twitter:image', img)
  html = setMeta(html, 'name', 'twitter:image:alt', alt)
  return html
}

// ---- doc model (mirrors tools/build-docs-index.mjs) ------------------------

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

const HIDDEN = new Set([
  'examples-plan', 'help/index', 'recipes/index', 'compliance/index', 'reference/index', 'enterprise/README',
])

const SECTION_LABEL = {
  '': 'Overview', 'getting-started': 'Getting started', help: 'Help',
  'help/cells': 'Cells', 'help/columns': 'Columns', 'help/editing': 'Editing',
  'help/filtering': 'Filtering', 'help/rows': 'Rows', recipes: 'Recipes',
  reference: 'API reference', enterprise: 'Enterprise tier', compliance: 'Compliance',
}

function extract(md) {
  if (md.charCodeAt(0) === 0xfeff) md = md.slice(1)
  const lines = md.split(/\r?\n/)
  let title = ''
  let summary = ''
  let seenTitle = false
  for (let i = 0; i < lines.length; i += 1) {
    const l = (lines[i] ?? '').trim()
    if (!title && l.startsWith('# ')) { title = l.slice(2).trim(); seenTitle = true; continue }
    if (seenTitle && !summary && l && !l.startsWith('#') && !l.startsWith('<') && !l.startsWith('|') && !l.startsWith('>')) {
      const para = []
      for (let j = i; j < lines.length; j += 1) {
        const t = (lines[j] ?? '').trim()
        if (!t || t.startsWith('<')) break
        para.push(t)
      }
      summary = para.join(' ')
        .replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()
      break
    }
  }
  if (summary.length > 160) summary = summary.slice(0, 157).replace(/\s+\S*$/, '') + '…'
  return { title, summary }
}

function sectionOf(rel) {
  const parts = rel.split('/')
  if (parts.length === 1) return ''
  if (parts[0] === 'help' && parts.length > 2) return `help/${parts[1]}`
  return parts[0]
}

function slugifyHeading(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

// Resolve a relative `.md` link to a clean in-site URL for crawlable content.
function resolveMdLink(href, currentSlug, knownSlugs) {
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return href
  const m = href.match(/^([^#?]*)([#?].*)?$/)
  let pathPart = m ? m[1] : href
  const tail = m && m[2] ? m[2] : ''
  if (!pathPart.endsWith('.md')) return href
  pathPart = pathPart.replace(/\.md$/, '')
  let segs
  if (pathPart.startsWith('/')) segs = pathPart.replace(/^\/+/, '').replace(/^docs\/+/, '').split('/').filter(Boolean)
  else {
    const dir = currentSlug.includes('/') ? currentSlug.slice(0, currentSlug.lastIndexOf('/')) : ''
    const baseSegs = dir ? dir.split('/') : []
    for (const s of pathPart.split('/')) {
      if (s === '..') baseSegs.pop()
      else if (s && s !== '.') baseSegs.push(s)
    }
    segs = baseSegs
  }
  const slug = segs.join('/')
  if (knownSlugs.has(slug)) return `${BASE}docs/${slug}${tail}`
  return href
}

// Unescape a single-quoted JS string literal's body.
function unesc(s) {
  return s.replace(/\\(['"\\])/g, '$1')
}

/** Parse "## Frequently asked questions" Q&A from a doc's markdown. */
function faqFromMarkdown(md) {
  const lines = md.replace(/^﻿/, '').split(/\r?\n/)
  const out = []
  let inFaq = false
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? ''
    if (/^##\s+Frequently asked questions/i.test(l)) { inFaq = true; continue }
    if (!inFaq) continue
    if (/^##\s+/.test(l)) break
    if (/^###\s+/.test(l)) {
      const question = l.replace(/^###\s+/, '').trim()
      const ans = []
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^#{2,3}\s+/.test(lines[j] ?? '')) break
        const t = (lines[j] ?? '').trim()
        if (t) ans.push(t)
      }
      const answer = ans.join(' ')
        .replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim()
      if (question && answer) out.push({ question, answer })
    }
  }
  return out
}

/** Parse the gallery registry (one demo(...) call per line) into metadata. */
async function parseDemos() {
  const src = await readFile(join(ROOT, 'website', 'src', 'lib', 'demos.ts'), 'utf-8')
  const re = /demo\(\s*'([^']+)'\s*,\s*'((?:\\.|[^'\\])*)'\s*,\s*'((?:\\.|[^'\\])*)'\s*,\s*'([^']+)'([^\n]*)/g
  const out = []
  let m
  while ((m = re.exec(src))) {
    out.push({ id: m[1], title: unesc(m[2]), blurb: unesc(m[3]), category: m[4], pro: /pro:\s*true/.test(m[5]) })
  }
  return out
}

/** Parse the comparison entries (slug + competitor + tagline + verdict). */
async function parseComparisons() {
  const src = await readFile(join(ROOT, 'website', 'src', 'lib', 'comparisons.ts'), 'utf-8')
  const marks = []
  const slugRe = /\bslug:\s*'([^']+)'/g
  let m
  while ((m = slugRe.exec(src))) marks.push({ slug: m[1], at: m.index })
  const out = []
  for (let i = 0; i < marks.length; i += 1) {
    const chunk = src.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : undefined)
    const comp = chunk.match(/competitor:\s*'((?:\\.|[^'\\])*)'/)
    const tag = chunk.match(/tagline:\s*'((?:\\.|[^'\\])*)'/)
    const verdict = chunk.match(/oneLineVerdict:\s*'((?:\\.|[^'\\])*)'/)
    const bottom = chunk.match(/bottomLine:\s*'((?:\\.|[^'\\])*)'/)
    const mig = chunk.match(/migrationSlug:\s*'([^']+)'/)
    const faq = []
    const faqRe = /question:\s*'((?:\\.|[^'\\])*)'\s*,\s*answer:\s*'((?:\\.|[^'\\])*)'/g
    let fm
    while ((fm = faqRe.exec(chunk))) faq.push({ question: unesc(fm[1]), answer: unesc(fm[2]) })
    out.push({
      slug: marks[i].slug,
      competitor: comp ? unesc(comp[1]) : marks[i].slug,
      tagline: tag ? unesc(tag[1]) : '',
      oneLineVerdict: verdict ? unesc(verdict[1]) : '',
      bottomLine: bottom ? unesc(bottom[1]) : '',
      migrationSlug: mig ? mig[1] : '',
      faq,
    })
  }
  return out
}

/** Parse a blog post's YAML-ish frontmatter + markdown body. Mirrors the
 * parser in website/src/lib/blog.ts so the static HTML and the SPA agree. */
function parseFrontmatter(raw) {
  let text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  text = text.replace(/\r\n/g, '\n')
  const meta = {}
  let body = text
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4)
    if (end !== -1) {
      for (const line of text.slice(4, end).split('\n')) {
        const idx = line.indexOf(':')
        if (idx === -1) continue
        const key = line.slice(0, idx).trim()
        let value = line.slice(idx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        meta[key] = value
      }
      const after = text.indexOf('\n', end + 1)
      body = after === -1 ? '' : text.slice(after + 1)
    }
  }
  return { meta, body }
}

// Top-level groups for the blog index - mirrors BLOG_GROUPS in lib/blog.ts.
const BLOG_GROUPS = ['Tutorials', 'Compare', 'Performance', 'Engineering', 'Guides', 'AI', 'Enterprise', 'Company']
const CATEGORY_TO_GROUP = {
  'Getting started': 'Tutorials', Sorting: 'Tutorials', Filtering: 'Tutorials', Editing: 'Tutorials',
  Grouping: 'Tutorials', Selection: 'Tutorials', Columns: 'Tutorials', Cells: 'Tutorials', Rows: 'Tutorials',
  Formatting: 'Tutorials', Data: 'Tutorials', 'Use cases': 'Tutorials', Comparisons: 'Compare',
  Performance: 'Performance', Engineering: 'Engineering', Architecture: 'Engineering',
  Accessibility: 'Guides', Theming: 'Guides', Integration: 'Guides', Concepts: 'Guides', Reference: 'Guides',
  AI: 'AI', Enterprise: 'Enterprise', Export: 'Enterprise', Product: 'Enterprise', Company: 'Company',
}
const blogGroupOf = (cat) => CATEGORY_TO_GROUP[cat] ?? 'Guides'

/** Collect every blog post (newest first) from src/content/blog/*.md. */
async function parseBlog() {
  let entries
  try {
    entries = await readdir(BLOG_DIR, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const raw = await readFile(join(BLOG_DIR, entry.name), 'utf-8')
    const { meta, body } = parseFrontmatter(raw)
    const words = body.trim().split(/\s+/).filter(Boolean).length
    const category = meta.category ?? 'General'
    out.push({
      slug: entry.name.replace(/\.md$/, ''),
      title: meta.title ?? entry.name.replace(/\.md$/, ''),
      description: meta.description ?? '',
      date: meta.date ?? '1970-01-01',
      category,
      group: blogGroupOf(category),
      tags: (meta.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      author: meta.author ?? 'SvGrid Team',
      pinned: meta.pinned === 'true',
      markdown: body,
      readingMinutes: Math.max(1, Math.round(words / 200)),
    })
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/** Parse the /faq route's Q&A pairs from Faq.svelte. */
async function parseFaqRoute() {
  const src = await readFile(join(ROOT, 'website', 'src', 'routes', 'Faq.svelte'), 'utf-8')
  const re = /q:\s*'((?:\\.|[^'\\])*)'\s*,\s*a:\s*'((?:\\.|[^'\\])*)'/g
  const out = []
  let m
  while ((m = re.exec(src))) out.push({ question: unesc(m[1]), answer: unesc(m[2]) })
  return out
}

/** Parse the homeFaqs Q&A from Home.svelte (q/a keys). */
async function parseHomeFaqs() {
  const src = await readFile(join(ROOT, 'website', 'src', 'routes', 'Home.svelte'), 'utf-8')
  const re = /q:\s*'((?:\\.|[^'\\])*)'\s*,\s*a:\s*'((?:\\.|[^'\\])*)'/g
  const out = []
  let m
  while ((m = re.exec(src))) out.push({ question: unesc(m[1]), answer: unesc(m[2]) })
  return out
}

/** Crawlable body for the landing page - hero, features, comparisons, FAQ. */
function homeCrawlBody(faq) {
  const feats = [
    'Headless engine plus a drop-in &lt;SvGrid&gt; render component',
    'Sorting, Excel-style filters, grouping, aggregation, tree, and master/detail',
    'Row + column virtualization - 100,000 rows by 100 columns stay smooth',
    'Inline editing with typed editors, validation, and cascade formulas',
    'Server-side data, WAI-ARIA accessibility, and full keyboard navigation',
    'AI-native: a bundled MCP server plus llms.txt for Claude, Cursor, and Zed',
    'MIT-licensed Community core; @svgrid/enterprise adds export, print, pivot, and AI',
  ]
  const cmp = [
    ['ag-grid', 'AG Grid'], ['tanstack-table', 'TanStack Table'], ['mui-x-datagrid', 'MUI X DataGrid'],
    ['handsontable', 'Handsontable'], ['svelte-headless-table', 'svelte-headless-table'],
  ]
  let html = '<main class="prerender-home" data-prerender="1">'
  html += '<h1>SvGrid - the Svelte 5 data grid</h1>'
  html += '<p>SvGrid is a modern data grid for Svelte 5: a headless engine you can compose plus a full-featured render component you can drop in. Sorting, filtering, grouping, virtualization, inline editing, server-side data, and 150+ production-quality examples. Free under the MIT License; @svgrid/enterprise adds export, print, pivot, and AI helpers.</p>'
  html += `<h2>Features</h2><ul>${feats.map((f) => `<li>${f}</li>`).join('')}</ul>`
  html += `<h2>How SvGrid compares</h2><ul>${cmp.map(([s, l]) => `<li><a href="${BASE}compare/${s}">SvGrid vs ${escapeAttr(l)}</a></li>`).join('')}</ul>`
  html += `<p><a href="${BASE}docs/getting-started">Get started</a> &middot; <a href="${BASE}demos">Browse 150+ demos</a> &middot; <a href="${BASE}docs">Documentation</a> &middot; <a href="${BASE}compare">All comparisons</a> &middot; <a href="${BASE}blog">Blog</a> &middot; <a href="${BASE}pricing">Pricing</a></p>`
  if (faq.length) html += `<h2>Frequently asked questions</h2>${faq.map((f) => `<h3>${escapeAttr(f.question)}</h3><p>${escapeAttr(f.answer)}</p>`).join('')}`
  return html + '</main>'
}

// ---- crawlable index bodies + collection JSON-LD ---------------------------

function collectionLd(name, url, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url,
    isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: CANON + '/' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
    },
  }
}

function faqLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

function demosIndexBody(demos) {
  const byCat = new Map()
  for (const d of demos) { if (!byCat.has(d.category)) byCat.set(d.category, []); byCat.get(d.category).push(d) }
  let html = `<main class="prerender-index" data-prerender="1"><h1>SvGrid Demos - Svelte 5 Data Grid Examples</h1><p>${demos.length} live, editable examples covering sorting, filtering, grouping, editing, virtualization, server-side data, and more.</p>`
  for (const [cat, list] of byCat) {
    html += `<h2>${escapeAttr(cat)}</h2><ul>`
    for (const d of list) html += `<li><a href="${BASE}demos/${d.id}">${escapeAttr(d.title)}</a> - ${escapeAttr(d.blurb)}</li>`
    html += `</ul>`
  }
  return html + `</main>`
}

function communityIndexBody(data) {
  const discussions = data.discussions ?? []
  const ghUrl = 'https://github.com/sv-grid/sv-grid/discussions'
  let html = `<main class="prerender-index" data-prerender="1"><h1>SvGrid Community - Discussions, Q&amp;A, and Ideas</h1><p>Ask questions, propose ideas, and share what you built. The SvGrid community runs on GitHub Discussions - browse threads below or <a href="${ghUrl}">open Discussions on GitHub</a>.</p>`
  if (discussions.length) {
    html += `<ul>`
    for (const d of discussions) {
      const cat = d.category ? `${escapeAttr(d.category.name)}: ` : ''
      html += `<li><a href="${escapeAttr(d.url)}">${cat}${escapeAttr(d.title)}</a> - ${d.comments ?? 0} comments</li>`
    }
    html += `</ul>`
  } else {
    html += `<p>No discussions yet. <a href="${ghUrl}/new">Start the first one.</a></p>`
  }
  return html + `</main>`
}

function docsIndexBody(docs) {
  const bySec = new Map()
  for (const d of docs) { const s = SECTION_LABEL[d.section] ?? 'Docs'; if (!bySec.has(s)) bySec.set(s, []); bySec.get(s).push(d) }
  let html = `<main class="prerender-index" data-prerender="1"><h1>SvGrid Documentation</h1><p>${docs.length} topic pages for the Svelte 5 data grid: getting started, columns, rows, cells, filtering, editing, and more.</p>`
  for (const [sec, list] of bySec) {
    html += `<h2>${escapeAttr(sec)}</h2><ul>`
    for (const d of list) html += `<li><a href="${BASE}docs/${d.slug}">${escapeAttr(d.title)}</a></li>`
    html += `</ul>`
  }
  return html + `</main>`
}

function compareIndexBody(comparisons) {
  let html = `<main class="prerender-index" data-prerender="1"><h1>SvGrid vs Other Svelte Data Grids</h1><p>Honest, feature-by-feature comparisons.</p><ul>`
  for (const c of comparisons) {
    html += `<li><a href="${BASE}compare/${c.slug}">SvGrid vs ${escapeAttr(c.competitor)}</a> - ${escapeAttr(c.oneLineVerdict || c.tagline)}</li>`
  }
  return html + `</ul></main>`
}

function blogIndexBody(posts) {
  let html = `<main class="prerender-index" data-prerender="1"><h1>SvGrid Blog - Svelte Data Grid Tips &amp; Guides</h1><p>${posts.length} practical, copy-paste tips and the story behind building a Svelte 5 data grid: sorting, filtering, virtualization, editing, server-side data, theming, and more.</p>`
  // Featured (pinned) posts first.
  const pinned = posts.filter((p) => p.pinned)
  if (pinned.length) {
    html += `<h2>Featured</h2><ul>`
    for (const p of pinned) html += `<li><a href="${BASE}blog/${p.slug}">${escapeAttr(p.title)}</a> - ${escapeAttr(p.description)}</li>`
    html += `</ul>`
  }
  // Then a section per top-level group.
  for (const group of BLOG_GROUPS) {
    const inGroup = posts.filter((p) => p.group === group && !p.pinned)
    if (!inGroup.length) continue
    html += `<h2>${escapeAttr(group)}</h2><ul>`
    for (const p of inGroup) html += `<li><a href="${BASE}blog/${p.slug}">${escapeAttr(p.title)}</a> - ${escapeAttr(p.description)}</li>`
    html += `</ul>`
  }
  return html + `</main>`
}

function faqIndexBody(items) {
  let html = `<main class="prerender-index" data-prerender="1"><h1>SvGrid - Frequently Asked Questions</h1>`
  for (const it of items) html += `<h2>${escapeAttr(it.question)}</h2><p>${escapeAttr(it.answer)}</p>`
  return html + `</main>`
}

// The three pricing tiers - kept in step with website/src/routes/Pricing.svelte.
const PRICING_TIERS = [
  { name: 'Community', price: '0', cadence: 'forever', desc: 'The full data grid, MIT-licensed and free for commercial use. No license key, no row-count cap. Sorting, Excel-style filters, grouping, virtualization, inline editing, master/detail, tree, server-side data, and WAI-ARIA.' },
  { name: 'Pro - Single Application Developer License', price: '599', cadence: 'per developer', desc: 'For one deployed production application. A perpetual license that includes 1 year of updates and support and renews automatically each year (cancel anytime, keep your paid-term versions). Adds the @svgrid/enterprise feature pack: Excel/PDF/CSV/TSV/HTML export, import, print, AI assistant, and pivot tables, plus email support within one business day, a private Slack channel, and prioritized bug fixes.' },
  { name: 'Pro - Multiple Application Developer License', price: '999', cadence: 'per developer', desc: 'For an unlimited number of deployed applications under your organisation. A perpetual license that includes 1 year of updates and support and renews automatically each year (cancel anytime). Everything in Single Application plus volume / multi-year discounts.' },
]

function pricingBody() {
  let html = `<main class="prerender-index" data-prerender="1"><h1>SvGrid Pricing</h1><p>SvGrid Community is free under the MIT License. The optional @svgrid/enterprise pack is licensed per developer per year.</p>`
  for (const t of PRICING_TIERS) {
    const price = t.price === '0' ? '$0' : `$${t.price}`
    html += `<h2>${escapeAttr(t.name)} - ${price} ${escapeAttr(t.cadence)}</h2><p>${escapeAttr(t.desc)}</p>`
  }
  return html + `</main>`
}

function pricingLd(url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'SvGrid',
    description: 'SvGrid is a Svelte 5 data grid. Community is free under the MIT License; @svgrid/enterprise adds export, import, print, pivot, and AI helpers.',
    brand: { '@type': 'Brand', name: 'SvGrid' },
    url,
    offers: PRICING_TIERS.map((t) => ({
      '@type': 'Offer',
      name: t.name,
      price: t.price,
      priceCurrency: 'USD',
      description: t.desc,
      url,
      availability: 'https://schema.org/InStock',
    })),
  }
}

// ---- per-section Open Graph cards (1200x630) -------------------------------
// Templated from public/og-image.svg with a section eyebrow + headline so each
// area of the site gets a distinct branded social card.

function ogSvg({ eyebrow, line1, line2white, line2accent, sub1, sub2 }) {
  const F = 'Inter, system-ui, sans-serif'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1224"/><stop offset="1" stop-color="#161f38"/></linearGradient>
    <linearGradient id="markBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e2a45"/><stop offset="1" stop-color="#0c1426"/></linearGradient>
    <linearGradient id="markEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    <linearGradient id="markAccent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
    <radialGradient id="glow" cx="0.7" cy="0.15" r="0.55"><stop offset="0" stop-color="#3b82f6" stop-opacity="0.18"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
    <pattern id="dot" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#9aa6c2" fill-opacity="0.06"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#page)"/><rect width="1200" height="630" fill="url(#dot)"/><rect width="1200" height="630" fill="url(#glow)"/>
  <g transform="translate(80, 72)">
    <rect x="0" y="0" width="72" height="72" rx="14" fill="url(#markBg)"/>
    <rect x="0" y="0" width="72" height="36" rx="14" fill="url(#markEdge)"/>
    <rect x="0.5" y="0.5" width="71" height="71" rx="13.5" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <g transform="translate(18, 18)">
      <rect width="15" height="15" rx="2.8" fill="#cbd5e1" fill-opacity="0.80"/><rect x="21" width="15" height="15" rx="2.8" fill="url(#markAccent)"/>
      <rect y="21" width="15" height="15" rx="2.8" fill="#cbd5e1" fill-opacity="0.62"/><rect x="21" y="21" width="15" height="15" rx="2.8" fill="#cbd5e1" fill-opacity="0.80"/>
    </g>
    <text x="92" y="50" font-family="${F}" font-weight="800" font-size="40" fill="#e8ecf6" letter-spacing="-1"><tspan>Sv</tspan><tspan fill-opacity="0.78">Grid</tspan></text>
  </g>
  <text x="80" y="238" font-family="${F}" font-weight="700" font-size="24" fill="#22d3ee" letter-spacing="4">${escapeAttr(eyebrow)}</text>
  <text x="80" y="312" font-family="${F}" font-weight="800" font-size="66" fill="#ffffff" letter-spacing="-2">${escapeAttr(line1)}</text>
  <text x="80" y="392" font-family="${F}" font-weight="800" font-size="66" letter-spacing="-2"><tspan fill="#ffffff">${escapeAttr(line2white)} </tspan><tspan fill="url(#markAccent)">${escapeAttr(line2accent)}</tspan></text>
  <text x="80" y="462" font-family="${F}" font-weight="500" font-size="26" fill="#9aa6c2">${escapeAttr(sub1)}</text>
  ${sub2 ? `<text x="80" y="500" font-family="${F}" font-weight="500" font-size="26" fill="#9aa6c2">${escapeAttr(sub2)}</text>` : ''}
  <rect x="0" y="566" width="1200" height="64" fill="#0d152a"/>
  <line x1="0" y1="566" x2="1200" y2="566" stroke="rgba(154,166,194,0.18)" stroke-width="1"/>
  <text x="80" y="606" font-family="${F}" font-weight="600" font-size="22" fill="#9aa6c2" letter-spacing="0.5">${SITE_HOST}</text>
  <text x="1120" y="606" text-anchor="end" font-family="${F}" font-weight="600" font-size="22" fill="#9aa6c2" letter-spacing="0.5">Built by jQWidgets</text>
</svg>`
}

const OG_SECTIONS = {
  docs:    { eyebrow: 'DOCUMENTATION', line1: 'Guides for the', line2white: 'Svelte 5', line2accent: 'data grid.', sub1: 'Columns, rows, cells, filtering, editing,', sub2: 'each with copy-paste examples.' },
  demos:   { eyebrow: 'EXAMPLES', line1: '150+ live', line2white: 'Svelte 5 grid', line2accent: 'demos.', sub1: 'Sorting, filtering, grouping, editing,', sub2: 'virtualization, server-side data, and more.' },
  compare: { eyebrow: 'COMPARISONS', line1: 'SvGrid vs the', line2white: 'other Svelte', line2accent: 'data grids.', sub1: 'Honest, feature-by-feature matrices.', sub2: '' },
  pricing: { eyebrow: 'PRICING', line1: 'Free core.', line2white: 'Pro for export', line2accent: '& pivot.', sub1: 'Community is MIT-licensed and free.', sub2: '@svgrid/enterprise from $599/dev/yr.' },
  roadmap: { eyebrow: 'ROADMAP', line1: 'What SvGrid is', line2white: 'building', line2accent: 'next.', sub1: 'An honest, living feature list,', sub2: 'plus a recently-shipped track record.' },
  faq:     { eyebrow: 'FAQ', line1: 'Common questions', line2white: 'about', line2accent: 'SvGrid.', sub1: 'Production readiness, licensing, SSR,', sub2: 'bundle size, and the MCP server.' },
  api:     { eyebrow: 'API REFERENCE', line1: 'Every prop, type,', line2white: 'and', line2accent: 'export.', sub1: 'SvGrid, ColumnDef, the headless core,', sub2: 'and the imperative SvGridApi.' },
  mcp:     { eyebrow: 'MCP SERVER', line1: 'Ground your AI', line2white: 'in real', line2accent: 'SvGrid docs.', sub1: 'Model Context Protocol server for', sub2: 'Claude, Cursor, Zed, and more.' },
  blog:    { eyebrow: 'BLOG', line1: 'Tips & guides for', line2white: 'the Svelte 5', line2accent: 'data grid.', sub1: 'Sorting, filtering, virtualization, editing,', sub2: 'server-side data, theming, and more.' },
}

// ---- main ------------------------------------------------------------------

async function main() {
  // 1. Collect docs.
  const docs = []
  for await (const file of walk(DOCS_DIR)) {
    if (!file.endsWith('.md')) continue
    const rel = relative(DOCS_DIR, file).replaceAll(sep, '/')
    const slug = rel.replace(/\.md$/, '')
    if (HIDDEN.has(slug)) continue
    const src = await readFile(file, 'utf-8')
    const { title, summary } = extract(src)
    if (!title) continue
    const s = await stat(file)
    const section = sectionOf(rel)
    docs.push({ slug, title, summary, markdown: src, section, lastmod: s.mtime.toISOString().slice(0, 10) })
  }
  const knownSlugs = new Set(docs.map((d) => d.slug))
  const demos = await parseDemos()
  const comparisons = await parseComparisons()
  const faqItems = await parseFaqRoute()
  // Scheduled publishing: only build posts whose date has arrived. Future-dated
  // posts stay out of the static HTML, cards, and sitemap until a build runs on
  // or after their date (the daily deploy cron handles the drip).
  const buildDate = new Date().toISOString().slice(0, 10)
  const blogPosts = (await parseBlog()).filter((p) => p.date <= buildDate)
  // Community discussions baked by tools/fetch-discussions.mjs (runs as the
  // website prebuild, before this). Empty when no token / no discussions.
  let discussionsData = { discussions: [], categories: [], totalCount: 0 }
  try {
    discussionsData = JSON.parse(
      await readFile(join(ROOT, 'website', 'src', 'lib', 'discussions-data.json'), 'utf-8'),
    )
  } catch { /* keep the empty default */ }

  // Generate per-section Open Graph cards into /og/*.svg.
  const ogDir = join(DIST, 'og')
  await mkdir(ogDir, { recursive: true })
  for (const [key, opts] of Object.entries(OG_SECTIONS)) {
    await writeFile(join(ogDir, `${key}.svg`), ogSvg(opts), 'utf-8')
  }

  // Per-post hero / social images into /og/blog/<slug>.{svg,png}. Each post
  // gets a distinct branded card used as its OG/Twitter image, its BlogPosting
  // structured-data image, and the visible hero at the top of the article. The
  // SVG is always written; a PNG raster is written too when available, and is
  // preferred for OG / structured data because image search favors raster.
  const ogBlogDir = join(ogDir, 'blog')
  await mkdir(ogBlogDir, { recursive: true })
  const blogImgExt = new Map() // slug -> 'png' | 'svg'
  let rasterCount = 0
  for (const p of blogPosts) {
    const svg = blogCardSvg(p, SITE_HOST)
    await writeFile(join(ogBlogDir, `${p.slug}.svg`), svg, 'utf-8')
    const png = rasterizePng(svg)
    if (png) {
      await writeFile(join(ogBlogDir, `${p.slug}.png`), png)
      blogImgExt.set(p.slug, 'png')
      rasterCount += 1
    } else {
      blogImgExt.set(p.slug, 'svg')
    }
  }

  // Rasterize the global /og-image.svg -> /og-image.png. Some social scrapers
  // (notably LinkedIn) ignore SVG OG images, so the PNG is the primary card
  // referenced in index.html and seo.ts; the SVG remains as a fallback.
  let ogPngWritten = false
  try {
    const ogSvg = await readFile(join(DIST, 'og-image.svg'), 'utf-8')
    const ogPng = rasterizePng(ogSvg)
    if (ogPng) {
      await writeFile(join(DIST, 'og-image.png'), ogPng)
      ogPngWritten = true
    }
  } catch {
    // dist/og-image.svg is not present yet (e.g. first build) - skip silently.
  }

  // 2. Load the built SPA shell as the template.
  let template
  try {
    template = await readFile(join(DIST, 'index.html'), 'utf-8')
  } catch {
    console.error('prerender: website/dist/index.html not found - run `vite build` first.')
    process.exit(1)
  }

  // marked renderer that adds heading ids (matches the Docs route) + rewrites
  // intra-doc .md links to clean URLs.
  function renderDoc(doc) {
    const m = new Marked({
      walkTokens(token) {
        if (token.type === 'link') token.href = resolveMdLink(token.href, doc.slug, knownSlugs)
      },
    })
    m.use({
      renderer: {
        heading({ tokens, depth }) {
          const text = this.parser.parseInline(tokens)
          const plain = tokens.map((t) => ('text' in t ? t.text : '')).join('').trim()
          const id = slugifyHeading(plain.replace(/^(\d+)\.\s+/, '$1-'))
          return `<h${depth} id="${id}">${text}</h${depth}>`
        },
      },
    })
    return m.parse(doc.markdown, { async: false })
  }

  // 3. Prerender each doc page.
  let written = 0
  for (const doc of docs) {
    const url = `${CANON}/docs/${doc.slug}`
    const title = `${doc.title} - SvGrid Docs`
    const description = doc.summary || `${doc.title} - documentation for SvGrid, the Svelte 5 data grid.`
    const sectionLabel = SECTION_LABEL[doc.section] ?? 'Docs'

    let html = applyHead(template, { title, description, canonical: url, ogType: 'article', image: `${CANON}/og/docs.svg`, imageAlt: `${doc.title} - SvGrid documentation` })
    const docGraph = [
      {
        '@context': 'https://schema.org', '@type': 'TechArticle',
        headline: doc.title, description, url, inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: CANON + '/' },
        about: { '@type': 'SoftwareApplication', name: 'SvGrid', applicationCategory: 'DeveloperApplication' },
        publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SvGrid', item: CANON + '/' },
          { '@type': 'ListItem', position: 2, name: 'Docs', item: `${CANON}/docs` },
          { '@type': 'ListItem', position: 3, name: sectionLabel, item: `${CANON}/docs` },
          { '@type': 'ListItem', position: 4, name: doc.title, item: url },
        ],
      },
    ]
    const faq = faqFromMarkdown(doc.markdown)
    if (faq.length) {
      docGraph.push({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question', name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      })
    }
    html = injectJsonLd(html, docGraph)
    const article = `<main class="prerender-doc" data-prerender="1">${renderDoc(doc)}</main>`
    html = injectBody(html, article)

    const outDir = join(DIST, 'docs', ...doc.slug.split('/'))
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'index.html'), html, 'utf-8')
    written += 1
  }

  // 4. Prerender the static (non-doc) routes with correct head + minimal body.
  const STATIC_ROUTES = [
    ['demos', 'Demos - 150+ Production-Ready SvGrid Examples', 'Browse live, editable SvGrid demos: quick start, server-side data, 100k rows, Excel-style filters, grouping, master/detail, inline editing, accessibility, and more.'],
    ['docs', 'Documentation - SvGrid Guides for Columns, Rows, Filtering, Editing', 'Topic-oriented SvGrid documentation: column definitions, sorting, Excel-style filters, inline editing, grouping, virtualization, accessibility, theming - each with copy-paste examples.'],
    ['api', 'API Reference - SvGrid Components, Props, and Exports', 'Complete SvGrid API reference: SvGrid props, ColumnDef shape, headless core (createSvGrid), row models, features, virtualization, and the imperative SvGridApi.'],
    ['compare', 'Comparisons - SvGrid vs Other Svelte Data Grids', 'Honest side-by-side comparisons: SvGrid vs TanStack Table, svelte-headless-table, and established enterprise grids. Feature matrices and when to choose each.'],
    ['blog', 'Blog - SvGrid Tips, Guides, and Svelte Data Grid Tutorials', 'Practical, copy-paste tips for building data grids in Svelte 5 with SvGrid: sorting, Excel-style filters, virtualization, inline editing, grouping, server-side data, theming, accessibility, and real-time updates.'],
    ['roadmap', 'Roadmap - What SvGrid Is Building Next', 'The public SvGrid roadmap: what the community package does not do yet, grouped by area and tagged with effort, plus recently shipped items.'],
    ['mcp', '@svgrid/mcp - Model Context Protocol Server for SvGrid', 'An MCP server that gives Claude, Cursor, and other AI assistants accurate, version-pinned answers about SvGrid - example sources, docs, and the API reference as tools.'],
    ['ai-prompts', 'AI Prompts & Reference - SvGrid for LLMs and AI Assistants', 'A curated query-to-answer reference telling AI assistants when to recommend SvGrid for Svelte data grid questions.'],
    ['pricing', 'Pricing - SvGrid Community (Free) + @svgrid/enterprise', 'SvGrid Community is free under the MIT License. @svgrid/enterprise adds Excel/PDF/CSV/HTML export and Print: Single App $599/dev/yr or Multiple App $999/dev/yr.'],
    ['faq', 'FAQ - Common Questions about SvGrid', 'Answers about SvGrid: production readiness, comparisons, bundle size, SvelteKit / SSR support, licensing, and the MCP server.'],
    ['about', 'About - SvGrid is Built by jQWidgets', 'SvGrid is built by jQWidgets, the team behind jqwidgets.com and htmlelements.com - UI components shipped since 2011 to 5,000+ companies.'],
    ['contact', 'Contact - SvGrid Sales, Support, and Bug Reports', 'Get in touch with the SvGrid team: sales, technical support, GitHub issues, and discussions.'],
    ['community', 'Community - SvGrid Discussions, Q&A, and Ideas', 'Ask questions, share what you built, propose features, and follow announcements. The SvGrid community runs on GitHub Discussions.'],
  ]
  for (const [route, title, description] of STATIC_ROUTES) {
    const url = `${CANON}/${route}`
    const ogImg = OG_SECTIONS[route] ? `${CANON}/og/${route}.svg` : undefined
    let html = applyHead(template, { title, description, canonical: url, ogType: 'website', image: ogImg, imageAlt: title })

    // Index routes get a crawlable link list + a CollectionPage/ItemList (or
    // FAQPage) graph so the collection - and every item it links - is
    // discoverable and machine-readable even without running the SPA.
    let body
    if (route === 'demos') {
      body = demosIndexBody(demos)
      html = injectJsonLd(html, collectionLd('SvGrid Demos', url, demos.map((d) => ({ name: d.title, url: `${CANON}/demos/${d.id}` }))))
    } else if (route === 'docs') {
      body = docsIndexBody(docs)
      html = injectJsonLd(html, collectionLd('SvGrid Documentation', url, docs.map((d) => ({ name: d.title, url: `${CANON}/docs/${d.slug}` }))))
    } else if (route === 'compare') {
      body = compareIndexBody(comparisons)
      html = injectJsonLd(html, collectionLd('SvGrid Comparisons', url, comparisons.map((c) => ({ name: `SvGrid vs ${c.competitor}`, url: `${CANON}/compare/${c.slug}` }))))
    } else if (route === 'blog') {
      body = blogIndexBody(blogPosts)
      html = injectJsonLd(html, collectionLd('SvGrid Blog', url, blogPosts.map((p) => ({ name: p.title, url: `${CANON}/blog/${p.slug}` }))))
    } else if (route === 'community') {
      body = communityIndexBody(discussionsData)
      if (discussionsData.discussions?.length) {
        html = injectJsonLd(html, collectionLd('SvGrid Community Discussions', url, discussionsData.discussions.map((d) => ({ name: d.title, url: d.url }))))
      }
    } else if (route === 'faq') {
      body = faqIndexBody(faqItems)
      if (faqItems.length) html = injectJsonLd(html, faqLd(faqItems))
    } else if (route === 'pricing') {
      body = pricingBody()
      html = injectJsonLd(html, pricingLd(url))
    } else {
      body = `<main class="prerender-route" data-prerender="1"><h1>${escapeAttr(title)}</h1><p>${escapeAttr(description)}</p><p><a href="${BASE}docs">Documentation</a> · <a href="${BASE}demos">Demos</a></p></main>`
    }
    html = injectBody(html, body)
    const outDir = join(DIST, route)
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'index.html'), html, 'utf-8')
    written += 1
  }

  // 4b. Prerender each demo page (per-example SEO + crawlable blurb).
  for (const d of demos) {
    const url = `${CANON}/demos/${d.id}`
    const title = `${d.title} - SvGrid Svelte Data Grid Example`
    const description = d.blurb
    let html = applyHead(template, { title, description, canonical: url, ogType: 'article', image: `${CANON}/og/demos.svg`, imageAlt: `${d.title} - SvGrid demo` })
    html = injectJsonLd(html, [
      {
        '@context': 'https://schema.org', '@type': 'SoftwareSourceCode',
        name: d.title, description, codeSampleType: 'full (compile ready) solution',
        programmingLanguage: 'Svelte', runtimePlatform: 'Svelte 5', url,
        isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: CANON + '/' },
        about: { '@type': 'SoftwareApplication', name: 'SvGrid', applicationCategory: 'DeveloperApplication' },
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SvGrid', item: CANON + '/' },
          { '@type': 'ListItem', position: 2, name: 'Demos', item: `${CANON}/demos` },
          { '@type': 'ListItem', position: 3, name: d.category, item: `${CANON}/demos` },
          { '@type': 'ListItem', position: 4, name: d.title, item: url },
        ],
      },
    ])
    const tier = d.pro ? ' (requires @svgrid/enterprise)' : ''
    const body = `<main class="prerender-demo" data-prerender="1"><nav><a href="${BASE}demos">Demos</a> / ${escapeAttr(d.category)}</nav><h1>${escapeAttr(d.title)}</h1><p>${escapeAttr(d.blurb)}${tier}</p><p>A live, editable Svelte 5 data grid example. <a href="${BASE}demos/${d.id}">Open the interactive demo</a> or <a href="${BASE}docs">read the documentation</a>.</p></main>`
    html = injectBody(html, body)
    const outDir = join(DIST, 'demos', d.id)
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'index.html'), html, 'utf-8')
    written += 1
  }

  // 4c. Prerender each comparison page (SvGrid vs X - high commercial intent).
  for (const c of comparisons) {
    const url = `${CANON}/compare/${c.slug}`
    const title = `SvGrid vs ${c.competitor} - Svelte Data Grid Comparison`
    const description = (c.oneLineVerdict || c.tagline).slice(0, 200)
    let html = applyHead(template, { title, description, canonical: url, ogType: 'article', image: `${CANON}/og/compare.svg`, imageAlt: `SvGrid vs ${c.competitor}` })
    const cmpGraph = [
      {
        '@context': 'https://schema.org', '@type': 'TechArticle',
        headline: `SvGrid vs ${c.competitor}`, description, url, inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: 'SvGrid', url: CANON + '/' },
        publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SvGrid', item: CANON + '/' },
          { '@type': 'ListItem', position: 2, name: 'Comparisons', item: `${CANON}/compare` },
          { '@type': 'ListItem', position: 3, name: `SvGrid vs ${c.competitor}`, item: url },
        ],
      },
    ]
    if (c.faq && c.faq.length) {
      cmpGraph.push({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: c.faq.map((f) => ({
          '@type': 'Question', name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      })
    }
    html = injectJsonLd(html, cmpGraph)
    const migLink = c.migrationSlug
      ? `<p><a href="${BASE}docs/help/${c.migrationSlug}">Migration guide: moving from ${escapeAttr(c.competitor)} to SvGrid</a></p>`
      : ''
    const bottom = c.bottomLine ? `<h2>The bottom line</h2><p>${escapeAttr(c.bottomLine)}</p>` : ''
    const faqHtml = c.faq && c.faq.length
      ? `<h2>Frequently asked questions</h2>${c.faq.map((f) => `<h3>${escapeAttr(f.question)}</h3><p>${escapeAttr(f.answer)}</p>`).join('')}`
      : ''
    const body = `<main class="prerender-compare" data-prerender="1"><nav><a href="${BASE}compare">Comparisons</a></nav><h1>SvGrid vs ${escapeAttr(c.competitor)}</h1><p>${escapeAttr(c.oneLineVerdict || c.tagline)}</p>${migLink}<p><a href="${BASE}compare/${c.slug}">See the full feature-by-feature comparison</a>.</p>${bottom}${faqHtml}</main>`
    html = injectBody(html, body)
    const outDir = join(DIST, 'compare', c.slug)
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'index.html'), html, 'utf-8')
    written += 1
  }

  // 4d. Prerender each blog post (per-post SEO + the full rendered article as
  // crawlable HTML, so the tip is indexable and AI-ingestible without JS).
  const renderMarked = new Marked()
  renderMarked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        const plain = tokens.map((t) => ('text' in t ? t.text : '')).join('').trim()
        return `<h${depth} id="${slugifyHeading(plain)}">${text}</h${depth}>`
      },
    },
  })
  for (const p of blogPosts) {
    const url = `${CANON}/blog/${p.slug}`
    const title = `${p.title} - SvGrid Blog`
    const description = p.description
    const heroImg = `${CANON}/og/blog/${p.slug}.${blogImgExt.get(p.slug) || 'svg'}`
    const heroAlt = `${p.title} - SvGrid blog illustration`
    let html = applyHead(template, { title, description, canonical: url, ogType: 'article', image: heroImg, imageAlt: heroAlt })
    const blogGraph = [
      {
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: p.title, description, url, image: [heroImg], datePublished: p.date, dateModified: p.date,
        inLanguage: 'en', keywords: p.tags.join(', '), articleSection: p.category,
        author: { '@type': 'Person', name: p.author },
        publisher: { '@type': 'Organization', name: 'jQWidgets', url: 'https://www.jqwidgets.com' },
        isPartOf: { '@type': 'Blog', name: 'SvGrid Blog', url: `${CANON}/blog` },
        about: { '@type': 'SoftwareApplication', name: 'SvGrid', applicationCategory: 'DeveloperApplication' },
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SvGrid', item: CANON + '/' },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${CANON}/blog` },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
    ]
    const faq = faqFromMarkdown(p.markdown)
    if (faq.length) {
      blogGraph.push({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question', name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      })
    }
    html = injectJsonLd(html, blogGraph)
    const article = renderMarked.parse(p.markdown, { async: false })
    const hero = `<img src="${heroImg}" width="1200" height="630" alt="${escapeAttr(heroAlt)}" loading="eager" />`
    const body = `<main class="prerender-doc" data-prerender="1"><nav><a href="${BASE}blog">Blog</a> / ${escapeAttr(p.category)}</nav>${hero}<h1>${escapeAttr(p.title)}</h1><p>${escapeAttr(p.description)}</p>${article}</main>`
    html = injectBody(html, body)
    const outDir = join(DIST, 'blog', p.slug)
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'index.html'), html, 'utf-8')
    written += 1
  }

  // 5. Sitemap with every real URL.
  const today = new Date().toISOString().slice(0, 10)
  const urls = []
  const push = (loc, priority, lastmod) => urls.push({ loc, priority, lastmod })
  push(`${CANON}/`, '1.0', today)
  for (const [route] of STATIC_ROUTES) push(`${CANON}/${route}`, '0.8', today)
  for (const c of comparisons) push(`${CANON}/compare/${c.slug}`, '0.7', today)
  for (const p of blogPosts) push(`${CANON}/blog/${p.slug}`, '0.6', p.date)
  for (const d of docs) push(`${CANON}/docs/${d.slug}`, d.slug.startsWith('getting-started') ? '0.8' : '0.6', d.lastmod)
  for (const d of demos) push(`${CANON}/demos/${d.id}`, '0.5', today)

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n')}\n</urlset>\n`
  await writeFile(join(DIST, 'sitemap.xml'), sitemap, 'utf-8')
  await writeFile(join(PUBLIC, 'sitemap.xml'), sitemap, 'utf-8').catch(() => {})

  // 5b. Enrich the landing page (dist/index.html) with crawlable body content
  // + FAQPage JSON-LD. The home route is the SPA shell otherwise, so its hero,
  // features, comparisons, and FAQ would never reach a non-JS crawler.
  const homeFaqs = await parseHomeFaqs()
  let homeHtml = await readFile(join(DIST, 'index.html'), 'utf-8')
  homeHtml = injectBody(homeHtml, homeCrawlBody(homeFaqs))
  if (homeFaqs.length) {
    homeHtml = injectJsonLd(homeHtml, {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: homeFaqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }
  await writeFile(join(DIST, 'index.html'), homeHtml, 'utf-8')

  // 6. SPA 404 fallback (also handled by the workflow, harmless to repeat).
  // Uses the clean shell template, not the enriched home body.
  await writeFile(join(DIST, '404.html'), template, 'utf-8')

  process.stdout.write(`prerender: ${written + 1} static pages · sitemap ${urls.length} urls (${docs.length} docs, ${demos.length} demos, ${comparisons.length} comparisons, ${blogPosts.length} blog posts) · ${rasterCount}/${blogPosts.length} blog card PNGs · og-image.png ${ogPngWritten ? 'ok' : 'skipped'}\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
