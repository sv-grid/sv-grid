/**
 * Blog tag hubs: a controlled vocabulary turned into indexable collection
 * pages at /blog/tag/<slug>.
 *
 * The blog carries 317 distinct tags, 223 of them used exactly once, which is
 * what freeform tagging produces. Tag chips were rendered as inert text and no
 * tag had a URL, so none of that structure was indexable. A hub per raw tag
 * would be 223 near-empty pages, so this file names the tags worth a page
 * instead: topical, feature-shaped terms people actually search.
 *
 * Tags that duplicate a blog category (engineering, concepts, use case,
 * comparison, integration, recipe, tips) are deliberately absent - the
 * category archives at /blog/category/<group>/ cover those. "svelte data grid"
 * is absent too: it is on 112 of 175 posts, so a hub for it is the blog index.
 *
 * The vocabulary is a module rather than a JSON file because both the
 * prerenderer (Node) and the site (Vite) import it, and JSON import
 * attributes are not portable across the Node versions CI runs.
 */

export const MIN_POSTS = 3

/** canonical term -> { label, aliases }. `aliases` catch the spelling
 *  variants the blog generator produced over time. */
export const TAG_VOCABULARY = {
  'server-side': { label: 'Server-side data', aliases: ['server side', 'serverside', 'server-side data', 'server data'] },
  performance: { label: 'Performance', aliases: ['perf', 'speed'] },
  virtualization: { label: 'Virtualization', aliases: ['virtual', 'virtual scroll', 'virtual scrolling', 'windowing'] },
  editing: { label: 'Inline editing', aliases: ['inline editing', 'edit', 'editors'] },
  'cell editor': { label: 'Cell editors', aliases: ['cell editors', 'editor'] },
  grouping: { label: 'Row grouping', aliases: ['row grouping', 'groups'] },
  aggregation: { label: 'Aggregation', aliases: ['aggregations', 'aggregate', 'aggregators'] },
  selection: { label: 'Selection', aliases: ['row selection', 'cell selection'] },
  clipboard: { label: 'Clipboard and copy-paste', aliases: ['copy paste', 'copy-paste', 'paste'] },
  columns: { label: 'Columns', aliases: ['column', 'column definitions'] },
  rows: { label: 'Rows', aliases: ['row'] },
  cells: { label: 'Cells', aliases: ['cell'] },
  'custom cells': { label: 'Custom cell renderers', aliases: ['custom cell', 'cell renderer', 'cell renderers', 'renderers'] },
  formatting: { label: 'Formatting', aliases: ['format', 'formatters', 'number formatting'] },
  export: { label: 'Export', aliases: ['exports', 'excel export', 'xlsx'] },
  csv: { label: 'CSV', aliases: ['csv export', 'csv import'] },
  accessibility: { label: 'Accessibility', aliases: ['a11y', 'aria', 'wcag', 'screen reader', 'keyboard'] },
  theming: { label: 'Theming', aliases: ['theme', 'themes', 'styling', 'css'] },
  'dark mode': { label: 'Dark mode', aliases: ['dark theme'] },
  'design system': { label: 'Design systems', aliases: ['design systems', 'tokens', 'design tokens'] },
  realtime: { label: 'Real-time data', aliases: ['real-time', 'real time', 'streaming', 'live data', 'websocket', 'websockets'] },
  reactivity: { label: 'Reactivity', aliases: ['reactive'] },
  runes: { label: 'Svelte runes', aliases: ['rune', '$state', '$derived'] },
  snippets: { label: 'Snippets', aliases: ['snippet'] },
  'svelte 5': { label: 'Svelte 5', aliases: ['svelte5', 'svelte-5'] },
  sveltekit: { label: 'SvelteKit', aliases: ['svelte kit', 'ssr'] },
  headless: { label: 'Headless core', aliases: ['headless core', 'headless ui', 'headless-table'] },
  architecture: { label: 'Architecture', aliases: ['internals'] },
  'master detail': { label: 'Master-detail', aliases: ['master-detail', 'detail rows'] },
  tree: { label: 'Tree data', aliases: ['tree data', 'hierarchy', 'hierarchies', 'tree grid'] },
  pivot: { label: 'Pivot tables', aliases: ['pivot table', 'pivot tables', 'crosstab'] },
  kanban: { label: 'Kanban boards', aliases: ['kanban board', 'board'] },
  migration: { label: 'Migrating to SvGrid', aliases: ['migrating', 'migrate', 'porting'] },
  alternatives: { label: 'Alternatives', aliases: ['alternative'] },
  'svelte-headless-table': { label: 'svelte-headless-table', aliases: ['svelte headless table'] },
  ai: { label: 'AI and LLMs', aliases: ['llm', 'llms', 'claude', 'cursor', 'copilot', 'ai assistant'] },
  mcp: { label: 'MCP server', aliases: ['model context protocol'] },
  testing: { label: 'Testing', aliases: ['tests', 'playwright', 'vitest'] },
  tutorial: { label: 'Tutorials', aliases: ['how to', 'how-to', 'guide'] },
}

// alias (and the canonical term itself) -> canonical term
const BY_ALIAS = new Map()
for (const [canonical, entry] of Object.entries(TAG_VOCABULARY)) {
  BY_ALIAS.set(canonical.toLowerCase(), canonical)
  for (const alias of entry.aliases ?? []) BY_ALIAS.set(alias.toLowerCase(), canonical)
}

/** The vocabulary term a raw post tag belongs to, or null when it is not one. */
export function canonicalTag(raw) {
  return BY_ALIAS.get(String(raw ?? '').trim().toLowerCase()) ?? null
}

export function tagSlug(canonical) {
  return String(canonical).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function tagLabel(canonical) {
  return TAG_VOCABULARY[canonical]?.label ?? canonical
}

const SLUG_TO_TAG = new Map(Object.keys(TAG_VOCABULARY).map((t) => [tagSlug(t), t]))
export function tagFromSlug(slug) {
  return SLUG_TO_TAG.get(String(slug ?? '').toLowerCase()) ?? null
}

/** Every vocabulary term a post belongs to, deduplicated. */
export function postTags(post) {
  const out = new Set()
  for (const raw of post.tags ?? []) {
    const c = canonicalTag(raw)
    if (c) out.add(c)
  }
  return [...out]
}

/**
 * The hubs worth building: vocabulary terms with at least MIN_POSTS posts.
 * Posts that defer to another URL via `canonical` are neither counted nor
 * listed - a hub should not push link equity at a page that points elsewhere.
 * Returns [{ tag, slug, label, posts }] ordered by size, then label.
 */
export function buildTagHubs(posts) {
  const eligible = posts.filter((p) => !p.canonical)
  const byTag = new Map()
  for (const post of eligible) {
    for (const tag of postTags(post)) {
      if (!byTag.has(tag)) byTag.set(tag, [])
      byTag.get(tag).push(post)
    }
  }
  return [...byTag.entries()]
    .filter(([, list]) => list.length >= MIN_POSTS)
    .map(([tag, list]) => ({ tag, slug: tagSlug(tag), label: tagLabel(tag), posts: list }))
    .sort((a, b) => b.posts.length - a.posts.length || a.label.localeCompare(b.label))
}
