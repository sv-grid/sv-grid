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
// AG-Grid-style flat, feature-themed top-level groups (no "Help" mega-bucket).
// `dir` is the primary directory a category owns; pages outside that directory
// are routed in via CATEGORY_OVERRIDE (below). Synthetic dirs start with '@'
// and never match a real slug - those categories are populated only by the
// override map.
const CATEGORY_ORDER: {
  dir: string
  label: string
  icon?: string
  summary?: string
  defaultOpen?: boolean
}[] = [
  { dir: 'getting-started',   label: 'Getting Started', icon: '✦', defaultOpen: true,
    summary: 'Install, first grid, data & columns, going to production.' },
  { dir: '@concepts',         label: 'Concepts',     icon: '◇',
    summary: 'Architecture, glossary, why headless.' },
  { dir: 'help/headless',     label: 'Headless',     icon: '⚙',
    summary: 'Use the engine without the renderer - build your own table.' },
  { dir: '@styling',          label: 'Layout & Styling', icon: '❖',
    summary: 'Theming with --sg-* tokens, Tailwind, Web Components.' },
  { dir: 'help/columns',      label: 'Columns',      icon: '▭',
    summary: 'Definitions, sizing, pinning, groups, spanning, headers.' },
  { dir: 'help/rows',         label: 'Rows',         icon: '▤',
    summary: 'Row data, sorting, pinning, dragging, master/detail, trees.' },
  { dir: 'help/cells',        label: 'Cells',        icon: '▢',
    summary: 'Custom cells, formatting, data types, tooltips, expressions.' },
  { dir: 'help/filtering',    label: 'Filtering',    icon: '▼',
    summary: 'Text / number / date / set filters, floating filters, API.' },
  { dir: 'help/editing',      label: 'Editing',      icon: '✎',
    summary: 'Inline & full-row editing, validation, undo / redo.' },
  { dir: 'help/grouping',     label: 'Grouping & Pivoting', icon: '⊞',
    summary: 'Row grouping, aggregation, pivot tables.' },
  { dir: 'help/server',       label: 'Server-Side Data', icon: '☁',
    summary: 'Server-side row model, infinite scroll, real-time, collaboration.' },
  { dir: 'help/state',        label: 'State & Views', icon: '⚑',
    summary: 'Save / restore grid state, named views.' },
  { dir: '@io',               label: 'Import & Export', icon: '⇅',
    summary: 'Excel / CSV / PDF export, print, import with mapping.' },
  { dir: '@charts',           label: 'Charts',       icon: '◔',
    summary: 'Integrated charts and sparklines.' },
  { dir: '@a11y',             label: 'Accessibility & i18n', icon: '⚉',
    summary: 'ARIA, keyboard nav, RTL, localisation, browser support.' },
  { dir: '@ai',               label: 'AI & Integrations', icon: '✨',
    summary: 'NL filter, smart paste, MCP server, agents, observability.' },
  { dir: 'recipes',           label: 'Recipes & Guides', icon: '★',
    summary: 'Copy-paste patterns; one live demo per recipe.' },
  { dir: '@migrating',        label: 'Migrating',    icon: '⇄',
    summary: 'Column / API translation guides from other grids.' },
  { dir: '@production',       label: 'Production & Quality', icon: '✓',
    summary: 'Security, benchmarks, testing, versioning, browser support.' },
  { dir: 'enterprise',        label: 'Enterprise',   icon: '◈',
    summary: 'License, evaluation, support, Enterprise feature pack.' },
  // Nested under Enterprise (2 leading spaces => tree depth 1). Owns
  // `enterprise/studio/*`; the overview page is routed in via CATEGORY_OVERRIDE.
  { dir: 'enterprise/studio', label: '  SvGrid Studio', icon: '◧',
    summary: 'Data-app generator: bind to data, build CRUD screens, scaffold code.' },
  { dir: 'compliance',        label: 'Compliance',   icon: '⚖',
    summary: 'SOC 2 / GDPR / HIPAA / audit-log integration.' },
  // NB: the API reference is NOT a docs category - it lives on the dedicated
  // /api page (website/src/routes/Api.svelte). A nav link points there.
]

// Route flat `help/*.md` (and root) pages that don't live in a feature
// subdirectory into the right AG-Grid-style group. Keyed by slug -> category
// label. Anything not listed falls back to the longest dir-prefix match.
const CATEGORY_OVERRIDE: Record<string, string> = {
  // Getting Started (root pages)
  'getting-started': 'Getting Started',
  // Headless
  'why-headless': 'Headless',
  // Concepts
  'help/architecture': 'Concepts',
  'help/glossary': 'Concepts',
  'help/comparison': 'Concepts',
  // Layout & Styling
  'help/tailwind': 'Layout & Styling',
  'help/tokens': 'Layout & Styling',
  'help/web-components': 'Layout & Styling',
  // Columns / Cells extras
  'help/columns-hierarchy': 'Columns',
  'help/status-bar': 'Cells',
  // Grouping & Pivoting
  'help/grouping-aggregation': 'Grouping & Pivoting',
  'help/pivot': 'Grouping & Pivoting',
  // Server-Side Data
  'help/server-side-data': 'Server-Side Data',
  'help/real-time': 'Server-Side Data',
  'help/collaboration': 'Server-Side Data',
  // State & Views
  'help/saved-views': 'State & Views',
  'help/state-maintenance': 'State & Views',
  // Import & Export
  'help/export': 'Import & Export',
  'help/import': 'Import & Export',
  // Charts
  'help/charts': 'Charts',
  // Accessibility & i18n
  'help/accessibility': 'Accessibility & i18n',
  'help/i18n-rtl': 'Accessibility & i18n',
  'help/browser-support': 'Accessibility & i18n',
  // AI & Integrations
  'help/ai': 'AI & Integrations',
  'help/ai-smart-paste': 'AI & Integrations',
  'help/agents': 'AI & Integrations',
  'help/mcp-server': 'AI & Integrations',
  'help/llm-grounding': 'AI & Integrations',
  'help/observability': 'AI & Integrations',
  // Recipes & Guides
  'help/recipes': 'Recipes & Guides',
  'help/conditional-form-schema': 'Recipes & Guides',
  'help/spreadsheet-formulas': 'Recipes & Guides',
  'help/mobile-card-view': 'Recipes & Guides',
  // Production & Quality
  'help/security': 'Production & Quality',
  'help/benchmarks': 'Production & Quality',
  'help/testing': 'Production & Quality',
  'help/testing-and-quality': 'Production & Quality',
  'help/api-stability': 'Production & Quality',
  'help/versioning': 'Production & Quality',
  'help/production': 'Production & Quality',
  'help/missing-features': 'Production & Quality',
  'help/errors': 'Production & Quality',
  // The Studio overview page lands in the nested "SvGrid Studio" group. The
  // value must match the (space-indented) CATEGORY_ORDER label exactly.
  'enterprise/studio': '  SvGrid Studio',
}
const CATEGORY_BY_LABEL = new Map(CATEGORY_ORDER.map((c) => [c.label, c]))

// Pages we deliberately don't surface in the sidebar.
const HIDDEN_SLUGS = new Set([
  'examples-plan',         // historical planning doc
  'help/index',            // duplicate of the sidebar itself
  'recipes/index',         // ditto - the sidebar IS the index
  'compliance/index',
  'reference/index',
  'enterprise/README',            // landing already lives under Enterprise group
  'help/api-reference',    // duplicate of the /api page - kept only as a redirect stub
])
// Hide the entire _internal tree (planning notes, dev-only docs) AND the
// reference/ tree (API reference lives on the dedicated /api page), plus the
// non-developer marketing / legal trees.
const HIDDEN_PREFIXES = ['_internal/', 'reference/', 'legal/', 'brand/', 'schemas/']

// Curated per-category order for the pages where order matters. Anything not
// listed here sorts alphabetically.
const PAGE_ORDER: Record<string, string[]> = {
  '': ['getting-started', 'why-headless'],
  'enterprise/studio': [
    'studio', // the overview (slug enterprise/studio)
    // Start here
    'getting-started',
    // Data binding
    'data-binding', 'databases', 'postgres-grid', 'supabase', 'supabase-grid', 'realtime', 'drizzle', 'prisma', 'rest-api', 'rest-grid', 'odata-graphql', 'in-memory',
    // Build
    'launch', 'samples', 'designer', 'app-designer', 'cli', 'ai-generation',
    // Reference
    'schema', 'api', 'server-grid', 'edit-forms', 'business-logic', 'relations', 'master-detail', 'navigation', 'dashboards', 'auth', 'access-control', 'audit-log', 'i18n', 'code-generation',
    // Tutorials
    'tutorial-crm',
    // Deploy, quality & style
    'deployment', 'testing', 'accessibility', 'theming',
    // Help
    'troubleshooting',
  ],
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
    'testing', 'api-stability', 'errors',
    // Project-level
    'testing-and-quality', 'missing-features',
  ],
  'help/headless': [
    'why-headless',
    'overview',
    'build-a-table',
    'styling',
    'row-models',
    'server-side',
    'controlled-state',
    'virtualization',
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
  // 1. Explicit per-slug override wins.
  const ov = CATEGORY_OVERRIDE[slug]
  if (ov) return CATEGORY_BY_LABEL.get(ov)!
  // 2. Every "migrating-from-*" guide lands in Migrating.
  if (slug.startsWith('help/migrating-from-')) return CATEGORY_BY_LABEL.get('Migrating')!
  // 3. Otherwise the longest real dir-prefix match (synthetic '@' dirs skipped).
  let best: (typeof CATEGORY_ORDER)[number] | null = null
  for (const c of CATEGORY_ORDER) {
    if (!c.dir || c.dir.startsWith('@')) continue
    if (slug.startsWith(c.dir + '/') && (!best || c.dir.length > best.dir.length)) {
      best = c
    }
  }
  return best ?? CATEGORY_BY_LABEL.get('Recipes & Guides') ?? CATEGORY_ORDER[0]!
}

function orderFor(slug: string, dir: string): number {
  // Real-dir categories slice the dir off; override / synthetic categories use
  // the slug's last path segment so they still sort sensibly (alphabetical).
  const baseName =
    dir && !dir.startsWith('@') && slug.startsWith(dir + '/')
      ? slug.slice(dir.length + 1)
      : slug.includes('/')
        ? slug.slice(slug.lastIndexOf('/') + 1)
        : slug
  const ordered = PAGE_ORDER[dir] ?? []
  const idx = ordered.indexOf(baseName)
  return idx >= 0 ? idx : 100 + (baseName.charCodeAt(0) || 0)
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
