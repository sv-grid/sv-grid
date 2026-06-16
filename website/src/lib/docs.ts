// Auto-discover every markdown file under docs/ and surface it on the website.
// The previous version curated a handful by hand; this version mirrors the
// tree on disk so adding a new doc requires no code change here.
//
// Vite resolves the glob at build time. `?raw` inlines each file as a string,
// and `eager: true` makes the map synchronous.

const FILES = import.meta.glob('../../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export type DocPage = {
  /** Route slug, e.g. "help/columns/column-definitions" or "getting-started". */
  slug: string
  /** Display title (derived from the first `# ...` line, falling back to the slug). */
  title: string
  /** Sidebar grouping. */
  category: string
  /** Raw markdown. */
  markdown: string
  /** One-line summary (first paragraph) - used for the meta description. */
  description: string
  /** Per-page SEO keywords derived from the title + category. */
  keywords: string[]
  /** Parsed "## Frequently asked questions" Q&A, for FAQPage rich results. */
  faq: { question: string; answer: string }[]
  /** Path under the repo root - used for the "Edit on GitHub" link. */
  githubPath: string
  /** Sort key inside the category. */
  order: number
}

/**
 * Drives the sidebar tree. Each entry is one navigable group; nesting
 * is implied by the `dir` prefix - `help/columns` renders under `help`,
 * `compliance` is its own top-level group. Anything not listed here
 * falls through to "Other".
 *
 * Each entry can declare `icon` (single glyph) + `summary` (one-line
 * blurb shown on the group header tooltip) + `defaultOpen` (whether
 * the tree starts expanded).
 */
const CATEGORY_ORDER: {
  dir: string
  label: string
  icon?: string
  summary?: string
  defaultOpen?: boolean
}[] = [
  { dir: '',                  label: 'Overview',     icon: '✦', defaultOpen: true,
    summary: 'Getting started, why-headless, changelog.' },
  { dir: 'help',              label: 'Help',         icon: '◆', defaultOpen: true,
    summary: 'Topic pages organised by feature area.' },
  { dir: 'help/columns',      label: '  Columns',    icon: '▭',
    summary: 'Column definitions, sizing, pinning, headers.' },
  { dir: 'help/rows',         label: '  Rows',       icon: '▤',
    summary: 'Row data, sorting, pinning, tree rows.' },
  { dir: 'help/cells',        label: '  Cells',      icon: '▢',
    summary: 'Custom cells, formatting, tooltips, expressions.' },
  { dir: 'help/filtering',    label: '  Filtering',  icon: '▼',
    summary: 'Built-in filter operators + custom column filters.' },
  { dir: 'help/editing',      label: '  Editing',    icon: '✎',
    summary: 'Inline editing, validation, undo / redo.' },
  { dir: 'recipes',           label: 'Recipes',      icon: '★',
    summary: '28 copy-paste patterns; one demo per recipe.' },
  { dir: 'compliance',        label: 'Compliance',   icon: '✓',
    summary: 'SOC 2 / GDPR / HIPAA / audit-log integration.' },
  { dir: 'enterprise',               label: 'Enterprise tier',     icon: '◈',
    summary: 'License, evaluation, support, Enterprise features.' },
  { dir: 'reference',         label: 'API reference',icon: '⟨⟩',
    summary: '<SvGrid> / SvGridApi / ColumnDef / features tables.' },
  { dir: 'reference/auto',    label: '  Auto-generated', icon: '⚙',
    summary: 'JSDoc-extracted reference; regenerated per release.' },
]

// Pages we deliberately don't surface in the sidebar.
const HIDDEN_SLUGS = new Set([
  'examples-plan',         // historical planning doc
  'help/index',            // duplicate of the sidebar itself
  'recipes/index',         // ditto - the sidebar IS the index
  'compliance/index',
  'reference/index',
  'enterprise/README',            // landing already lives under Enterprise group
])
// Hide the entire _internal tree (planning notes, dev-only docs).
const HIDDEN_PREFIXES = ['_internal/']

// Curated per-category order for the pages where order matters. Anything not
// listed here sorts alphabetically.
const PAGE_ORDER: Record<string, string[]> = {
  '': ['getting-started', 'why-headless'],
  'getting-started': [
    'starters',
    '1-install',
    '2-first-grid',
    '3-data-and-columns',
    '4-features',
    '5-theme-and-density',
    '6-going-to-production',
  ],
  help: [
    // Background + headline features first
    'architecture', 'glossary',
    'tailwind', 'web-components', 'export', 'import', 'ai', 'ai-smart-paste', 'pivot',
    'migrating-from-ag-grid',
    // Patterns + playbooks
    'recipes', 'spreadsheet-formulas', 'mobile-card-view', 'conditional-form-schema',
    'server-side-data', 'real-time', 'grouping-aggregation',
    'columns-hierarchy', 'state-maintenance', 'saved-views', 'i18n-rtl',
    // Enterprise readiness
    'security', 'browser-support', 'accessibility', 'benchmarks',
    'testing', 'api-stability', 'api-reference', 'errors',
    // Project-level
    'testing-and-quality', 'missing-features',
  ],
  'help/columns': [
    'column-definitions',
    'updating-definitions',
    'column-state',
    'column-headers',
    'column-groups',
    'column-sizing',
    'column-moving',
    'column-pinning',
    'column-spanning',
    'custom-header-components',
  ],
  'help/rows': [
    'row-data',
    'row-sorting',
    'row-spanning',
    'row-pinning',
    'row-height',
    'styling-rows',
    'row-pagination',
    'accessing-rows',
    'row-dragging',
    'full-width-rows',
    'tree-rows',
  ],
  'help/cells': [
    'getting-values',
    'text-formatting',
    'cell-components',
    'cell-data-types',
    'styling-cells',
    'highlighting-changes',
    'tooltips',
    'expressions',
    'view-refresh',
    'cell-text-selection',
  ],
  'help/filtering': [
    'overview',
    'text-filter',
    'number-filter',
    'date-filter',
    'set-filter',
    'filter-conditions',
    'applying-filters',
    'filter-api',
    'custom-column-filters',
    'floating-filters',
  ],
  'help/editing': [
    'overview',
    'start-stop-editing',
    'parsing-values',
    'saving-values',
    'edit-components',
    'provided-editors',
    'undo-redo',
    'full-row',
    'validation',
  ],
}

function titleFromMarkdown(md: string, fallback: string): string {
  // Strip BOM, look for first `# ...`.
  const cleaned = md.replace(/^﻿/, '')
  const m = cleaned.match(/^#\s+(.+?)\s*$/m)
  if (!m) return fallback
  return m[1]!.trim()
}

/**
 * First real paragraph after the H1 - the meta description for the page.
 * Mirrors tools/build-docs-index.mjs so the on-page meta and the generated
 * docs.json/llms.txt stay in lockstep. Skips headings, HTML (demo embeds),
 * tables, and blockquotes; strips inline code marks and link syntax.
 */
function descriptionFromMarkdown(md: string): string {
  const lines = md.replace(/^﻿/, '').split(/\r?\n/)
  let seenTitle = false
  for (let i = 0; i < lines.length; i += 1) {
    const l = (lines[i] ?? '').trim()
    if (!seenTitle) {
      if (l.startsWith('# ')) seenTitle = true
      continue
    }
    if (!l || l.startsWith('#') || l.startsWith('<') || l.startsWith('|') || l.startsWith('>')) continue
    const para: string[] = []
    for (let j = i; j < lines.length; j += 1) {
      const t = (lines[j] ?? '').trim()
      if (!t || t.startsWith('<')) break
      para.push(t)
    }
    const text = para
      .join(' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
    // Meta descriptions sweet-spot ~155-160 chars.
    return text.length > 160 ? text.slice(0, 157).replace(/\s+\S*$/, '') + '…' : text
  }
  return ''
}

/**
 * Parse a "## Frequently asked questions" section into Q&A pairs. Each `###`
 * heading is a question; the text until the next heading is the answer. Feeds
 * FAQPage JSON-LD so the Q&A can surface as a rich result and AI answer.
 */
function faqFromMarkdown(md: string): { question: string; answer: string }[] {
  const lines = md.replace(/^﻿/, '').split(/\r?\n/)
  const out: { question: string; answer: string }[] = []
  let inFaq = false
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? ''
    if (/^##\s+Frequently asked questions/i.test(l)) { inFaq = true; continue }
    if (!inFaq) continue
    if (/^##\s+/.test(l)) break // next H2 ends the FAQ block
    if (/^###\s+/.test(l)) {
      const question = l.replace(/^###\s+/, '').trim()
      const ans: string[] = []
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^#{2,3}\s+/.test(lines[j] ?? '')) break
        const t = (lines[j] ?? '').trim()
        if (t) ans.push(t)
      }
      const answer = ans
        .join(' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
      if (question && answer) out.push({ question, answer })
    }
  }
  return out
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'your', 'a', 'an', 'of', 'to', 'in', 'on', 'or'])

/** Per-page SEO keywords: title words + category + the SvGrid baseline. */
function keywordsFor(title: string, category: string): string[] {
  const fromTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  const base = ['svelte data grid', 'svelte 5', 'sv-grid']
  const cat = category.trim().toLowerCase()
  return [...new Set([...fromTitle, cat, ...base].filter(Boolean))]
}

function slugFor(path: string): string {
  // path looks like "../../../docs/help/columns/column-definitions.md"
  const i = path.indexOf('/docs/')
  if (i < 0) return path
  return path.slice(i + '/docs/'.length).replace(/\.md$/, '')
}

function categoryFor(slug: string): { dir: string; label: string } {
  // Match the longest CATEGORY_ORDER prefix.
  let best = CATEGORY_ORDER[0]!
  for (const c of CATEGORY_ORDER) {
    if (c.dir === '' && !slug.includes('/')) {
      best = c
      continue
    }
    if (c.dir && slug.startsWith(c.dir + '/') && c.dir.length > best.dir.length) {
      best = c
    }
  }
  return best
}

function orderFor(slug: string, dir: string): number {
  const baseName = dir === '' ? slug : slug.slice(dir.length + 1)
  const ordered = PAGE_ORDER[dir] ?? []
  const idx = ordered.indexOf(baseName)
  return idx >= 0 ? idx : 100 + baseName.charCodeAt(0)
}

const allPages: DocPage[] = Object.entries(FILES)
  .map(([path, markdown]) => {
    const slug = slugFor(path)
    if (HIDDEN_SLUGS.has(slug)) return null
    if (HIDDEN_PREFIXES.some((p) => slug.startsWith(p))) return null
    const { dir, label } = categoryFor(slug)
    const baseName = dir === '' ? slug : slug.slice(dir.length + 1)
    const title = titleFromMarkdown(markdown, baseName)
    const category = label.trim()
    return {
      slug,
      title,
      // Trim leading indentation spaces - they're only there to drive
      // the sidebar tree depth, not the display label.
      category,
      markdown,
      description: descriptionFromMarkdown(markdown),
      keywords: keywordsFor(title, category),
      faq: faqFromMarkdown(markdown),
      githubPath: `docs/${slug}.md`,
      order: orderFor(slug, dir),
    }
  })
  .filter((p): p is DocPage => p !== null)
  .sort((a, b) => {
    const aDir = CATEGORY_ORDER.find((c) => c.label.trim() === a.category)?.dir ?? ''
    const bDir = CATEGORY_ORDER.find((c) => c.label.trim() === b.category)?.dir ?? ''
    const aCatIdx = CATEGORY_ORDER.findIndex((c) => c.dir === aDir)
    const bCatIdx = CATEGORY_ORDER.findIndex((c) => c.dir === bDir)
    if (aCatIdx !== bCatIdx) return aCatIdx - bCatIdx
    return a.order - b.order
  })

export const docs: DocPage[] = allPages

export type DocGroup = {
  category: string
  dir: string
  icon?: string
  summary?: string
  defaultOpen?: boolean
  pages: DocPage[]
  /** Depth (in spaces of the label) - drives the tree indentation. */
  depth: number
}

function depthOf(label: string): number {
  let n = 0
  while (label[n] === ' ') n += 1
  return Math.floor(n / 2)
}

export const docGroups: DocGroup[] = CATEGORY_ORDER.map(({ dir, label, icon, summary, defaultOpen }) => ({
  category:    label.trim(),
  dir,
  icon,
  summary,
  defaultOpen,
  depth:       depthOf(label),
  pages:       docs.filter((d) => d.category === label.trim()),
})).filter((g) => g.pages.length > 0)

export function findDoc(slug: string | null | undefined): DocPage {
  if (!slug) return docs[0]!
  return docs.find((d) => d.slug === slug) ?? docs[0]!
}
