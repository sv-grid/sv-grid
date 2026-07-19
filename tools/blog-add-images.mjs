// Give a blog post a hero screenshot ONLY when it matches a specific grid
// FEATURE - the image is that feature's grid (an existing /blog-media/*.png).
// Posts with no feature match keep their generated branded card (no embed).
//
// Idempotent: it first strips any image this tool previously inserted (its alt
// equals the post title), then re-inserts one only if a feature matches. So it
// doubles as the "revert generic ones" pass.
//
// Usage:
//   node tools/blog-add-images.mjs            # dry run - prints ADD / CARD / KEEP
//   node tools/blog-add-images.mjs --write     # apply
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BLOG = join(ROOT, 'website', 'src', 'content', 'blog')
const MEDIA = join(ROOT, 'website', 'public', 'blog-media')
const WRITE = process.argv.includes('--write')

// Grid FEATURES only. Ordered, specific-first. No generic/use-case/migration
// bucket and no default - a post that matches nothing here keeps its card.
const FEATURES = [
  [['pivot'], 'pivot'],
  [['conditional format', 'heatmap', 'data bar', 'color scale', 'cell style', 'row styling'], 'conditional-formatting'],
  [['saved view', 'named view', 'persist', 'url state', 'state to url', 'sync grid state', 'sync state'], 'named-views'],
  [['set filter', 'faceted', 'multi-condition', 'advanced filter'], 'set-filter'],
  [['natural language', 'nl filter', 'ai filter'], 'nl-filter'],
  [['locale', 'i18n', 'internationaliz', 'rtl'], 'locale-filter'],
  [['excel-style', 'excel filter', 'floating filter', 'filter'], 'excel-filters'],
  [['sort'], 'sorting'],
  [['fill handle'], 'fill-handle'],
  [['inline edit', 'inline-edit', 'editing', 'editor', 'validation', 'undo', 'staged edit'], 'inline-editing'],
  [['group', 'aggreg', 'summary footer', 'sticky summary'], 'group-aggregators'],
  [['master detail', 'master-detail', 'detail row', 'hierarch'], 'tree-master-detail'],
  [['tree'], 'tree-master-detail'],
  [['org chart'], 'org-chart'],
  [['lazy'], 'lazy-tree'],
  [['range', 'clipboard', 'cell selection', 'copy', 'paste'], 'range-selection'],
  [['bulk', 'select all', 'tri-state', 'row selection', 'selection'], 'selection'],
  [['pin', 'frozen', 'sticky column'], 'column-pinning'],
  [['column reorder', 'reorder column', 'move column', 'column drag'], 'column-reorder'],
  [['column group', 'multi-level header', 'column definition', 'column def', 'nested header'], 'columns-hierarchy'],
  [['row reorder', 'row drag', 'drag and drop', 'dragging'], 'row-reorder'],
  [['column resiz', 'column visib', 'column layout', 'autosize', 'column menu'], 'column-layout'],
  [['context menu', 'right-click', 'right click'], 'context-menu'],
  [['tooltip', 'note', 'comment'], 'tooltips'],
  [['optimistic'], 'optimistic-updates'],
  [['websocket', 'streaming'], 'websocket-live'],
  [['realtime', 'real-time', 'live update', 'throttle', 'animation frame'], 'realtime-orders'],
  [['cursor', 'infinite', 'paginat'], 'server-side'],
  [['graphql', 'rest api', 'rest'], 'rest-loading'],
  [['server row model', 'ssrm', 'server-side data', 'server side', 'server', 'sveltekit', 'ssr', 'prisma', 'drizzle', 'trpc', 'laravel', 'convex', 'firebase', 'pocketbase'], 'server-side'],
  [['export', 'xlsx', 'csv', 'pdf', 'print'], 'export'],
  [['spreadsheet', 'formula', 'hyperformula'], 'spreadsheet'],
  [['accessib', 'a11y', 'wcag', 'keyboard', 'aria', 'screen reader', 'focus'], 'accessibility'],
  [['high contrast'], 'high-contrast'],
  [['theme', 'dark mode', 'tailwind', 'shadcn', 'skeleton', 'flowbite', 'css var', 'styling'], 'theme-integrations'],
  [['custom cell', 'cell renderer', 'render component', 'snippet', 'avatar', 'image cell', 'sparkline', 'progress bar', 'status badge', 'badge cell'], 'custom-cells-themes'],
  [['custom editor', 'cell editor', 'autocomplete', 'dropdown editor', 'dependent dropdown'], 'custom-cell-editors'],
  [['status bar'], 'status-bar'],
  [['tool panel', 'side panel'], 'tool-panel'],
  [['search', 'highlight', 'find in'], 'highlighted-search'],
  [['anomaly'], 'anomaly'],
  [['barcode', 'qr'], 'barcode'],
  [['million', 'virtual', 'virtualiz', 'virtualize', '100k', 'performance', 'benchmark', 'large array', 'large data'], 'million-rows'],
]

// Fallback for NON-feature posts (use-cases + generic topics) so every post ends
// up with a real screenshot. Ordered; anything unmatched uses DEFAULT_IMG.
const TOPICS = [
  [['ecommerce', 'product', 'catalog', 'seller', 'marketplace', 'shop', 'saas', 'billing', 'subscription', 'invoice', 'order'], 'seller-panel'],
  [['crm', 'pipeline', 'sales', 'lead', 'deal'], 'crm'],
  [['admin', 'user management', 'settings', 'permission', 'role'], 'admin-dashboard'],
  [['timesheet', 'schedul', 'gantt', 'calendar', 'booking', 'shift'], 'scheduler'],
  [['hr', 'employee', 'team', 'people', 'payroll'], 'hr-team'],
  [['finance', 'trading', 'stock', 'portfolio', 'trade', 'ledger'], 'trading-desk'],
  [['healthcare', 'clinic', 'patient', 'medical', 'ehr', 'emr'], 'reporting'],
  [['logistics', 'fleet', 'warehouse', 'inventory', 'manufactur', 'industrial', 'supply'], 'industrial-dashboard'],
  [['dashboard', 'kpi', 'report', 'analytic', 'metric'], 'live-dashboard'],
  [['headless', 'render component', 'primitive', 'unstyled', 'tanstack', 'slot'], 'custom-cells-themes'],
]
const DEFAULT_IMG = 'quick-start' // migrations, comparisons, opinion, conceptual

function parse(raw) {
  const text = raw.replace(/\r\n/g, '\n')
  const m = text.match(/^﻿?---\n([\s\S]*?)\n---\n?/)
  if (!m) return null
  const meta = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    meta[line.slice(0, i).trim()] = v
  }
  return { fmBlock: m[0], meta, body: text.slice(m[0].length) }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const norm = (s) => s.toLowerCase().replace(/[-_]+/g, ' ')
function matchIn(list, slug, meta) {
  // Normalize hyphens/underscores to spaces so slugs and titles match uniformly.
  const raw = norm(`${slug} ${meta.title || ''} ${meta.tags || ''} ${meta.category || ''}`)
  // Word-boundary PREFIX match: `group` hits "grouping" and `aggreg` hits
  // "aggregation", but `form` does NOT hit "per*form*ance" (no boundary) nor
  // `ai` "expl*ai*ned".
  const has = (k) => new RegExp('\\b' + esc(norm(k))).test(raw)
  for (const [keys, img] of list) if (keys.some(has)) return img
  return null
}
/** Feature image (grid feature) or, failing that, a topical / default image. */
const pickImage = (slug, meta) => ({
  img: matchIn(FEATURES, slug, meta) ?? matchIn(TOPICS, slug, meta) ?? DEFAULT_IMG,
  feature: matchIn(FEATURES, slug, meta) != null,
})

/** Remove an image line this tool inserted (alt === post title). Returns body. */
function stripInserted(body, title) {
  const re = new RegExp(`\\n*!\\[${esc(title)}\\]\\(/blog-media/[^)]+\\.png\\)\\n*`, 'g')
  return body.replace(re, (m0) => (m0.startsWith('\n\n') ? '\n\n' : '\n'))
}

/** Insert the feature image after the first paragraph. */
function insertImage(body, img, alt) {
  const md = `![${alt}](/blog-media/${img}.png)`
  const lead = body.length - body.replace(/^\n+/, '').length
  const brk = body.slice(lead).indexOf('\n\n')
  if (brk === -1) return body.replace(/\n*$/, '\n') + '\n' + md + '\n'
  const at = lead + brk
  return body.slice(0, at) + '\n\n' + md + body.slice(at)
}

const files = (await readdir(BLOG)).filter((f) => f.endsWith('.md'))
let added = 0, kept = 0
const rows = []
for (const f of files.sort()) {
  const raw = await readFile(join(BLOG, f), 'utf-8')
  const p = parse(raw)
  if (!p) continue
  const slug = f.replace(/\.md$/, '')
  const title = (p.meta.title || slug).replace(/[[\]]/g, '')

  // Strip any image WE inserted (alt === title), so the pass is idempotent.
  let body = stripInserted(p.body, title)
  const hadOriginal = /!\[[^\]]*\]\(\/blog-media\//.test(body) // an author's own image survives the strip

  let action
  if (hadOriginal) { action = 'KEEP'; kept++ }
  else {
    let { img, feature } = pickImage(slug, p.meta)
    if (!existsSync(join(MEDIA, `${img}.png`))) img = DEFAULT_IMG
    body = insertImage(body, img, title)
    action = `${feature ? 'FEAT' : 'topic'} ${img}`; added++
  }
  rows.push([action, slug])
  if (WRITE && body !== p.body) await writeFile(join(BLOG, f), p.fmBlock + body, 'utf-8')
}
for (const [a, slug] of rows.filter((r) => r[0] !== 'KEEP')) process.stdout.write(`  ${a.padEnd(22)} ${slug}\n`)
const feat = rows.filter((r) => r[0].startsWith('FEAT')).length
process.stdout.write(`\n${WRITE ? 'WROTE' : 'DRY RUN'}: ${added} images added (${feat} feature, ${added - feat} topical/default), ${kept} already had an author image\n`)
