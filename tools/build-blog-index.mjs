/**
 * Build the blog's metadata index: website/src/lib/blog-index.json.
 *
 * website/src/lib/blog.ts used to pull every post in with an eager `?raw`
 * glob and parse the frontmatter in the browser. App.svelte imports that
 * module on every page (route SEO needs a post's title), so the whole 3 MB
 * corpus of markdown rode in the entry chunk of the homepage, the docs and all
 * 370 demo pages. The index is what the SPA needs everywhere - slug, title,
 * dates, category, tags, reading time - and the bodies load on demand from a
 * lazy glob when a post is opened.
 *
 * Same frontmatter parser as the prerenderer's blog cards, so the static
 * pages and the SPA read one source of truth. Runs from the website's
 * `predev` and `prebuild` scripts; the output is committed so a fresh clone
 * builds without it having run.
 *
 * Usage: node tools/build-blog-index.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './blog-card.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')
const OUT = join(ROOT, 'website', 'src', 'lib', 'blog-index.json')

/** Mirrors readingTime() in blog.ts: words / 200, at least one minute. */
function readingMinutes(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

const posts = []
for (const name of (await readdir(BLOG_DIR)).filter((n) => n.endsWith('.md')).sort()) {
  const { meta, body } = parseFrontmatter(await readFile(join(BLOG_DIR, name), 'utf-8'))
  const slug = name.replace(/\.md$/, '')
  const entry = {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? '',
    date: meta.date ?? '1970-01-01',
    category: meta.category ?? 'General',
    tags: (meta.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    author: meta.author ?? 'SvGrid Team',
    pinned: meta.pinned === 'true',
    readingMinutes: readingMinutes(body),
  }
  // Optional keys only when set, so the index stays small and the diff quiet.
  if (meta.seoTitle) entry.seoTitle = meta.seoTitle
  if (meta.seoDescription) entry.seoDescription = meta.seoDescription
  if (meta.canonical) entry.canonical = meta.canonical
  if (meta.updated) entry.updated = meta.updated
  const hero = body.match(/!\[[^\]]*\]\((\/blog-media\/[^)]+)\)/)?.[1]
  if (hero) entry.heroImage = hero
  posts.push(entry)
}

await writeFile(OUT, JSON.stringify(posts, null, 2) + '\n', 'utf-8')
console.log(`build-blog-index: ${posts.length} posts -> ${OUT}`)
