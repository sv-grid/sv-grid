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
  category: string
  tags: string[]
  author: string
  /** Raw markdown body (frontmatter stripped). */
  markdown: string
  /** Estimated reading time in minutes, derived from word count. */
  readingMinutes: number
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

export const blogPosts: BlogPost[] = Object.entries(files)
  .map(([path, raw]) => {
    const { meta, body } = parse(raw)
    return {
      slug: slugFromPath(path),
      title: meta.title ?? slugFromPath(path),
      description: meta.description ?? '',
      date: meta.date ?? '1970-01-01',
      category: meta.category ?? 'General',
      tags: (meta.tags ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      author: meta.author ?? 'SvGrid Team',
      markdown: body,
      readingMinutes: readingTime(body),
    } satisfies BlogPost
  })
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
