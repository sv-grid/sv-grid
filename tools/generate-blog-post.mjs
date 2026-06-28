#!/usr/bin/env node
/**
 * Generate one brand-new blog post per run with the Anthropic API and drop it
 * into website/src/content/blog/. Designed to run daily from CI
 * (.github/workflows/daily-blog.yml).
 *
 * Scheduling: the post is APPENDED to the end of the publish queue. Its `date`
 * is (highest existing date + 1 day), so it goes live on its own day via the
 * existing drip (website/src/lib/blog.ts hides future-dated posts; the daily
 * website rebuild publishes whichever post's date has arrived). New posts never
 * go live the same day - they queue behind the ~88 already-scheduled posts,
 * which leaves a long review window before anything is public.
 *
 * The post's hero / social image is generated automatically at build time from
 * its frontmatter (tools/blog-card.mjs -> /og/blog/<slug>.png), so no image
 * binary or image API is needed here. We bias the tags toward a known feature so
 * that auto-generated card illustrates the right grid feature.
 *
 * Required env:
 *   ANTHROPIC_API_KEY - Anthropic API key.
 * Optional env:
 *   BLOG_MODEL        - model id (default: claude-sonnet-4-6).
 *
 * Usage:
 *   node tools/generate-blog-post.mjs            # write a new post
 *   node tools/generate-blog-post.mjs --dry-run  # print, do not write
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './blog-card.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(HERE, '..', 'website', 'src', 'content', 'blog')

const DRY_RUN = process.argv.includes('--dry-run')
const MODEL = process.env.BLOG_MODEL || 'claude-sonnet-4-6'
const API_KEY = process.env.ANTHROPIC_API_KEY
const AUTHOR = 'Boyko Markov'

// Categories already in use; the model must pick one of these for consistency.
const CATEGORIES = [
  'Engineering', 'Accessibility', 'Cells', 'Use cases', 'Comparisons',
  'Concepts', 'Editing', 'Selection', 'Columns', 'Rows', 'Filtering',
  'Data', 'Export', 'Grouping', 'Architecture', 'Formatting', 'Sorting',
  'Getting started', 'Integration', 'Theming', 'Performance', 'AI',
]

// Tag keywords that tools/blog-card.mjs maps to a feature illustration. Biasing
// at least one tag toward this list makes the auto hero image relevant.
const FEATURE_TAGS = [
  'pivot', 'virtual', 'performance', 'filter', 'sort', 'editing', 'validation',
  'grouping', 'tree', 'master detail', 'selection', 'clipboard', 'pinned',
  'export', 'csv', 'theming', 'dark mode', 'realtime', 'pagination',
  'server-side', 'formatting', 'accessibility', 'keyboard', 'columns', 'ai', 'mcp',
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Replace em/en dashes and a few smart-punctuation glyphs with plain ASCII.
// The repo rule is: never use an em-dash glyph anywhere - always a hyphen.
function sanitize(s) {
  return String(s)
    .replace(/—/g, ' - ') // em dash
    .replace(/–/g, '-') // en dash
    .replace(/‘|’/g, "'") // smart single quotes
    .replace(/“|”/g, '"') // smart double quotes
    .replace(/…/g, '...') // ellipsis
    .replace(/[ \t]+\n/g, '\n') // trailing spaces
    .replace(/ {2,}-/g, ' -') // collapse the " - " we just inserted if doubled
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function existing() {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))
  const slugs = new Set()
  const titles = []
  let maxDate = todayISO()
  for (const f of files) {
    const slug = f.replace(/\.md$/, '')
    slugs.add(slug)
    const { meta } = parseFrontmatter(readFileSync(join(BLOG_DIR, f), 'utf-8'))
    if (meta.title) titles.push(meta.title)
    if (meta.date && meta.date > maxDate) maxDate = meta.date
  }
  return { slugs, titles, maxDate }
}

function buildPrompt({ titles }) {
  return `You are a senior engineer writing for the SvGrid developer blog. SvGrid is a headless-first, Svelte 5-native data grid (a free MIT community package "@svgrid/grid", plus a paid enterprise package). Voice: precise, practical, written for working developers. Show real Svelte 5 code with runes where it helps.

Write ONE new blog post on a topic NOT already covered. Here are the existing post titles - pick a genuinely fresh angle, do not duplicate any:
${titles.map((t) => `- ${t}`).join('\n')}

HARD STYLE RULES (must follow exactly):
- NEVER use an em-dash or en-dash character. Use a plain hyphen "-" with spaces, or rewrite the sentence.
- Use straight ASCII quotes only ('' and ""), never curly/smart quotes.
- Do NOT mention or cite National Instruments / NI.
- 700-1100 words. Markdown body only (no frontmatter, no top-level # H1 title). Use ## and ### headings, short paragraphs, and fenced code blocks (\`\`\`svelte or \`\`\`ts) for examples.
- Be technically accurate about a Svelte 5 data grid. Prefer concrete, runnable snippets over hand-waving.

Pick "category" from EXACTLY this list: ${CATEGORIES.join(', ')}.
Choose 3-6 lowercase "tags" (comma-separated later). Make at least one tag one of these feature keywords so the post's auto hero image is relevant: ${FEATURE_TAGS.join(', ')}.

Return ONLY a single JSON object, no prose, no markdown fence, with these keys:
{
  "title": "string, <= 70 chars, no trailing period",
  "slug": "kebab-case-url-slug",
  "description": "string, 110-160 chars, plain sentence for SEO/meta",
  "category": "one of the allowed categories",
  "tags": ["tag1", "tag2", "tag3"],
  "body": "the full markdown body"
}`
}

async function callModel(prompt) {
  if (!API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set.')
    process.exit(1)
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    console.error(`Anthropic API error ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
  const data = await res.json()
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  return text
}

function extractJson(text) {
  // The model may wrap the object in a ```json fence or stray prose; grab the
  // outermost {...} and parse that.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in model output.')
  return JSON.parse(candidate.slice(start, end + 1))
}

function validate(post, slugs) {
  const required = ['title', 'slug', 'description', 'category', 'tags', 'body']
  for (const k of required) {
    if (!post[k] || (k === 'tags' && !Array.isArray(post.tags))) {
      throw new Error(`Model output missing/invalid field: ${k}`)
    }
  }
  if (!CATEGORIES.includes(post.category)) {
    console.error(`Warning: category "${post.category}" not in known set; keeping it.`)
  }
  // Ensure a unique slug.
  let slug = slugify(post.slug || post.title)
  if (!slug) throw new Error('Could not derive a slug.')
  if (slugs.has(slug)) {
    let n = 2
    while (slugs.has(`${slug}-${n}`)) n++
    slug = `${slug}-${n}`
  }
  post.slug = slug
  return post
}

function render(post, date) {
  const tags = post.tags.map((t) => sanitize(String(t).trim().toLowerCase())).filter(Boolean).join(', ')
  const fm = [
    '---',
    `title: ${sanitize(post.title).replace(/\s+/g, ' ').trim()}`,
    `description: ${sanitize(post.description).replace(/\s+/g, ' ').trim()}`,
    `date: ${date}`,
    `category: ${sanitize(post.category).trim()}`,
    `tags: ${tags}`,
    `author: ${AUTHOR}`,
    '---',
    '',
  ].join('\n')
  const body = sanitize(post.body).replace(/^#\s+.*\n+/, '').trim() + '\n'
  return fm + body
}

async function main() {
  const { slugs, titles, maxDate } = existing()
  const date = addDays(maxDate, 1) // append to the very end of the queue
  const prompt = buildPrompt({ titles })

  const raw = await callModel(prompt)
  let post = extractJson(raw)
  post = validate(post, slugs)

  const md = render(post, date)
  const file = join(BLOG_DIR, `${post.slug}.md`)

  if (DRY_RUN) {
    process.stdout.write(`--- would write ${post.slug}.md (date ${date}) ---\n\n${md}\n`)
    return
  }
  writeFileSync(file, md)
  process.stdout.write(`Wrote ${post.slug}.md  (category: ${post.category}, date: ${date})\n`)
  // Expose the new path for the workflow's commit message.
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_OUTPUT, `slug=${post.slug}\ntitle=${post.title.replace(/\n/g, ' ')}\ndate=${date}\n`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
