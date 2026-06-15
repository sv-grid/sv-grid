// Blog content model. Posts live as markdown files with YAML-ish frontmatter
// under src/content/blog/*.md. Vite's glob import pulls every file in as a raw
// string at build time; we parse the frontmatter here so both the Blog route
// and (separately) the prerenderer read the exact same source of truth.
//
// The prerender script (tools/prerender-site.mjs) reads the same directory
// from disk and renders each post to static HTML for SEO - keep the frontmatter
// keys here in step with the parser there.

export type BlogPost = {
  slug: string
  title: string
  description: string
  /** ISO date string, e.g. "2026-06-09". */
  date: string
  /** Fine-grained category from frontmatter (e.g. "Sorting"). */
  category: string
  /** Top-level group used for the index filter (e.g. "Tutorials"). */
  group: string
  tags: string[]
  author: string
  /** Featured at the top of the blog index, above the dated list. */
  pinned: boolean
  /** Raw markdown body (frontmatter stripped). */
  markdown: string
  /** Estimated reading time in minutes, derived from word count. */
  readingMinutes: number
  /** First real screenshot in the body (/blog-media/...), used as the card image. */
  heroImage?: string
}

// The blog has ~20 fine-grained per-post categories, which is too many for a
// usable filter bar. We roll them up into a small set of top-level groups for
// navigation, in this display order. The post keeps its specific category too.
export const BLOG_GROUPS = ['Tutorials', 'Compare', 'Performance', 'Engineering', 'Guides', 'AI', 'Pro', 'Company'] as const
export type BlogGroup = (typeof BLOG_GROUPS)[number]

const CATEGORY_TO_GROUP: Record<string, BlogGroup> = {
  'Getting started': 'Tutorials',
  Sorting: 'Tutorials', Filtering: 'Tutorials', Editing: 'Tutorials', Grouping: 'Tutorials',
  Selection: 'Tutorials', Columns: 'Tutorials', Cells: 'Tutorials', Rows: 'Tutorials',
  Formatting: 'Tutorials', Data: 'Tutorials', 'Use cases': 'Tutorials',
  Comparisons: 'Compare',
  Performance: 'Performance',
  Engineering: 'Engineering', Architecture: 'Engineering',
  Accessibility: 'Guides', Theming: 'Guides', Integration: 'Guides', Concepts: 'Guides', Reference: 'Guides',
  AI: 'AI',
  Pro: 'Pro', Export: 'Pro', Product: 'Pro',
  Company: 'Company',
}

function groupOf(category: string): BlogGroup {
  return CATEGORY_TO_GROUP[category] ?? 'Guides'
}

// Eagerly import every post as a raw string. The keys are file paths like
// "../content/blog/render-your-first-svelte-data-grid.md".
const files = import.meta.glob('../content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Strip a leading BOM and split frontmatter from the markdown body. */
function parse(raw: string): { meta: Record<string, string>; body: string } {
  let text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  text = text.replace(/\r\n/g, '\n')
  const meta: Record<string, string> = {}
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4)
    if (end !== -1) {
      const front = text.slice(4, end)
      for (const line of front.split('\n')) {
        const idx = line.indexOf(':')
        if (idx === -1) continue
        const key = line.slice(0, idx).trim()
        let value = line.slice(idx + 1).trim()
        // Tolerate quoted values.
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        meta[key] = value
      }
      const after = text.indexOf('\n', end + 1)
      return { meta, body: after === -1 ? '' : text.slice(after + 1) }
    }
  }
  return { meta, body: text }
}

function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

function slugFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.md$/, '')
}

// Scheduled publishing: a post is live only once its `date` has arrived. Posts
// dated in the future are hidden from the index, related lists, and direct
// lookup, so we can queue a backlog and release one per day (see
// tools/schedule-blog.mjs + the daily deploy cron). The prerenderer applies the
// same gate at build time, so future posts are not in the static HTML/sitemap.
const TODAY = new Date().toISOString().slice(0, 10)
const isPublished = (dateISO: string): boolean => dateISO <= TODAY

export const blogPosts: BlogPost[] = Object.entries(files)
  .map(([path, raw]) => {
    const { meta, body } = parse(raw)
    const category = meta.category ?? 'General'
    return {
      slug: slugFromPath(path),
      title: meta.title ?? slugFromPath(path),
      description: meta.description ?? '',
      date: meta.date ?? '1970-01-01',
      category,
      group: groupOf(category),
      tags: (meta.tags ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      author: meta.author ?? 'SvGrid Team',
      pinned: meta.pinned === 'true',
      markdown: body,
      readingMinutes: readingTime(body),
      heroImage: body.match(/!\[[^\]]*\]\((\/blog-media\/[^)]+)\)/)?.[1],
    } satisfies BlogPost
  })
  // Hide posts whose publish date has not arrived yet.
  .filter((p) => isPublished(p.date))
  // Newest first.
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

export function findPost(slug: string | null | undefined): BlogPost | null {
  if (!slug) return null
  return blogPosts.find((p) => p.slug === slug) ?? null
}

/** Distinct categories in display order (by most recent post). */
export function blogCategories(): string[] {
  const seen: string[] = []
  for (const p of blogPosts) if (!seen.includes(p.category)) seen.push(p.category)
  return seen
}

/** Pinned posts, featured above the dated list on the index. Newest first. */
export const pinnedPosts: BlogPost[] = blogPosts.filter((p) => p.pinned)

/** Top-level groups that actually have posts, with counts - for the filter bar. */
export function blogGroups(): { group: BlogGroup; count: number }[] {
  return BLOG_GROUPS.map((group) => ({
    group,
    count: blogPosts.filter((p) => p.group === group).length,
  })).filter((g) => g.count > 0)
}

/** Human-readable date, e.g. "June 9, 2026". */
export function formatPostDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Up to `n` other posts sharing a tag or category with the given post. */
export function relatedPosts(post: BlogPost, n = 3): BlogPost[] {
  const scored = blogPosts
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const sharedTags = p.tags.filter((t) => post.tags.includes(t)).length
      const sameCat = p.category === post.category ? 1 : 0
      return { p, score: sharedTags * 2 + sameCat }
    })
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, n).map((s) => s.p)
}
