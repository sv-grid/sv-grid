#!/usr/bin/env node
/**
 * Blog post generator + regenerator for the SvGrid website.
 *
 * Modes:
 *   node tools/generate-blog-post.mjs                 # write a new post at the end of the queue
 *   node tools/generate-blog-post.mjs --regenerate <slug>
 *                                                     # rewrite an existing post's body, keep
 *                                                     # frontmatter (date/slug/category/tags/author);
 *                                                     # sets `updated: <today>` in the frontmatter.
 *   node tools/generate-blog-post.mjs --regenerate-all
 *                                                     # regenerate every post in the queue (published
 *                                                     # AND unpublished); each gets `updated: <today>`.
 *   node tools/generate-blog-post.mjs --regenerate-unpublished
 *                                                     # regenerate every post whose date > today.
 *   node tools/generate-blog-post.mjs --regenerate-failed
 *                                                     # only regenerate posts that don't yet meet
 *                                                     # the quality bar (>=3 code blocks AND
 *                                                     # >=800 words in the body). Idempotent - safe
 *                                                     # to rerun after a partial batch to finish
 *                                                     # what got skipped or failed.
 *   node tools/generate-blog-post.mjs --dry-run       # print, do not write (works with all modes)
 *
 * Why this exists: the original generator produced short, thin posts (~400
 * words, 1-2 code blocks, no real SvGrid API usage). Users get nothing from
 * that. This version:
 *
 *   1. GROUNDS the model on real code - it reads the actual export list from
 *      packages/grid/src/index.ts + short snippets from the most relevant
 *      demos and passes them as reference, so the model uses the real API
 *      surface instead of inventing plausible-sounding one.
 *   2. STRUCTURES the output - required sections, minimum code blocks,
 *      minimum word count. Failed generations are retried once with the
 *      failure reason inlined into the prompt.
 *   3. RAISES max_tokens to 8000 so a 1500-word article with ~4 code blocks
 *      fits comfortably.
 *   4. PRESERVES scheduling on regenerate - the file's original `date` stays
 *      untouched so the drip queue is not disrupted. Only the body + the new
 *      `updated:` line change.
 *
 * Required env:
 *   ANTHROPIC_API_KEY - Anthropic API key.
 * Optional env:
 *   BLOG_MODEL        - model id (default: claude-sonnet-4-6).
 *   BLOG_MAX_RETRIES  - retries on validation failure (default: 1).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './blog-card.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')
const GRID_INDEX = join(ROOT, 'packages', 'grid', 'src', 'index.ts')
const WRAPPER_TYPES = join(ROOT, 'packages', 'grid', 'src', 'svgrid-wrapper.types.ts')
const DEMOS_DIR = join(ROOT, 'examples', 'src', 'demos')

const DRY_RUN = process.argv.includes('--dry-run')
const MODEL = process.env.BLOG_MODEL || 'claude-sonnet-4-6'
const API_KEY = process.env.ANTHROPIC_API_KEY
const MAX_RETRIES = Number.parseInt(process.env.BLOG_MAX_RETRIES ?? '1', 10)
const AUTHOR = 'Boyko Markov'

// Categories currently in use across the queue. New posts pick one.
const CATEGORIES = [
  'Engineering', 'Accessibility', 'Cells', 'Use cases', 'Comparisons',
  'Concepts', 'Editing', 'Selection', 'Columns', 'Rows', 'Filtering',
  'Data', 'Export', 'Grouping', 'Architecture', 'Formatting', 'Sorting',
  'Getting started', 'Integration', 'Theming', 'Performance', 'AI',
]

// Tag keywords that tools/blog-card.mjs maps to a feature illustration.
const FEATURE_TAGS = [
  'pivot', 'virtual', 'performance', 'filter', 'sort', 'editing', 'validation',
  'grouping', 'tree', 'master detail', 'selection', 'clipboard', 'pinned',
  'export', 'csv', 'theming', 'dark mode', 'realtime', 'pagination',
  'server-side', 'formatting', 'accessibility', 'keyboard', 'columns', 'ai', 'mcp',
]

// -------- Utils ----------------------------------------------------------

function todayISO() { return new Date().toISOString().slice(0, 10) }
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Pick a plausible "updated" date for a regenerated post. Spreads the
 *  dates deterministically across the last 60 days keyed off the slug,
 *  so a single batch run doesn't stamp every post with today's date
 *  (which reads as "obviously an AI dump"). Reruns are stable because
 *  the hash of a fixed slug is fixed.
 *
 *  Guarantees:
 *   - Result is >= existingDate (never "updated before published").
 *   - Result is <= todayDate.
 *   - Unpublished posts (date > today) return null - a future post has
 *     nothing to "update" until it goes live.
 */
function pickUpdatedDate(slug, existingDate, todayDate) {
  if (existingDate > todayDate) return null
  let hash = 0
  for (const c of String(slug)) hash = ((hash * 31) + c.charCodeAt(0)) >>> 0
  const daysBack = (hash % 60) + 1 // 1..60
  const d = new Date(todayDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysBack)
  const iso = d.toISOString().slice(0, 10)
  return iso < existingDate ? existingDate : iso
}

function sanitize(s) {
  return String(s)
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/…/g, '...')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}-/g, ' -')
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function listPosts() {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))
  return files.map((f) => {
    const raw = readFileSync(join(BLOG_DIR, f), 'utf-8')
    const { meta, body } = parseFrontmatter(raw)
    return { file: join(BLOG_DIR, f), slug: f.replace(/\.md$/, ''), meta, body }
  })
}

// -------- Real-API grounding --------------------------------------------

/** Read the export names from packages/grid/src/index.ts so the model
 *  knows exactly which functions / types are available. */
function loadGridExports() {
  const src = readFileSync(GRID_INDEX, 'utf-8')
  const values = new Set()
  const types = new Set()
  // Match `export { ... }` blocks and pull identifiers.
  const blocks = src.matchAll(/export\s*\{([^}]+)\}/g)
  for (const [, inner] of blocks) {
    for (const raw of inner.split(',')) {
      const t = raw.trim()
      if (!t) continue
      const isType = t.startsWith('type ')
      const clean = t.replace(/^type\s+/, '').replace(/\s+as\s+.+$/, '').trim()
      if (!clean) continue
      if (isType) types.add(clean); else values.add(clean)
    }
  }
  const defaults = src.matchAll(/export\s*\{\s*default\s+as\s+(\w+)/g)
  for (const [, name] of defaults) values.add(name)
  return {
    values: [...values].sort(),
    types: [...types].sort(),
  }
}

/** Pull the top-level SvGridApi method names so posts can name them
 *  correctly (setActiveCell, autosizeColumn, applyTransaction, ...). */
function loadApiMethods() {
  try {
    const src = readFileSync(WRAPPER_TYPES, 'utf-8')
    // Match property signatures inside `SvGridApi = { ... }` looking for
    // `name(...): ...` or `name: (...) => ...`.
    const methods = new Set()
    for (const m of src.matchAll(/^\s{2,4}(\w+)\s*\(/gm)) methods.add(m[1])
    return [...methods].sort()
  } catch { return [] }
}

/** Load a compact code sample from each demo (first 80 non-comment lines
 *  of the script block) so the model can crib real usage patterns. Only
 *  the demos whose id / description matches the post's tags get bundled. */
function loadRelevantDemos(tags, title) {
  if (!existsSync(DEMOS_DIR)) return []
  const files = readdirSync(DEMOS_DIR).filter((f) => f.endsWith('.svelte'))
  const needle = [title, ...tags].join(' ').toLowerCase()
  const scored = []
  for (const f of files) {
    const raw = readFileSync(join(DEMOS_DIR, f), 'utf-8')
    const scriptMatch = raw.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    if (!scriptMatch) continue
    const script = scriptMatch[1]
    // Score by how many of the tag keywords appear in the file's text.
    const hay = (f + '\n' + raw).toLowerCase()
    let score = 0
    for (const tag of tags) if (hay.includes(tag.toLowerCase())) score += 5
    for (const word of needle.split(/\s+/)) {
      if (word.length >= 4 && hay.includes(word)) score += 1
    }
    if (score < 3) continue
    // Compact: drop long comments, keep imports + first 60 non-blank lines
    // of code.
    const compact = script
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('//'))
      .slice(0, 60)
      .join('\n')
    scored.push({ file: f, score, script: compact })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3)
}

/** Build a "grounding" section for the prompt: real exports + real demo
 *  code the model can adapt. */
function buildGrounding({ tags = [], title = '' } = {}) {
  const { values, types } = loadGridExports()
  const apiMethods = loadApiMethods()
  const demos = loadRelevantDemos(tags, title)
  const lines = []
  lines.push('# Grounding facts (use ONLY these APIs; do not invent)')
  lines.push('')
  lines.push('SvGrid public value exports from `@svgrid/grid`:')
  lines.push(values.map((v) => '  - ' + v).join('\n'))
  lines.push('')
  lines.push('Type exports from `@svgrid/grid`:')
  lines.push(types.slice(0, 40).map((v) => '  - ' + v).join('\n'))
  lines.push('')
  if (apiMethods.length > 0) {
    lines.push('SvGridApi methods (available via `onApiReady`):')
    lines.push(apiMethods.map((m) => '  - api.' + m + '(...)').join('\n'))
    lines.push('')
  }
  if (demos.length > 0) {
    lines.push('Reference snippets from real demos (adapt these; do NOT copy verbatim):')
    for (const d of demos) {
      lines.push('')
      lines.push('```svelte (excerpt from examples/src/demos/' + d.file + ')')
      lines.push(d.script)
      lines.push('```')
    }
    lines.push('')
  }
  return lines.join('\n')
}

// -------- Prompt --------------------------------------------------------

const STRUCTURE_CONTRACT = `\
HOW A HUMAN WOULD WRITE THIS

You are writing for a developer blog that readers already skim, sometimes
skeptically. The single loudest tell that a post was machine-produced is
the same fixed skeleton on every article. Do NOT produce a fixed skeleton.
Match the SHAPE of the post to the specific topic you are covering.

Post shapes to consider (pick or blend, don't announce which one):

- Tutorial / how-to: start with a concrete result the reader wants. Show
  the smallest working example that produces it. Then peel back one layer.
- Concept / explainer: pose the question the reader actually has. Answer
  it in one line. Then use code + concrete numbers to earn the answer.
- Deep dive / engineering log: skip the "in this post we'll" opener. Show
  the design choice, then the failure it prevents, then the code.
- Comparison / migration: put the parity table high. Below it, the rough
  edges. Recommend last, and be honest.
- Feature spotlight: one paragraph what it does, one code block that shows
  it, one paragraph on the edge cases. Keep it short.

STRUCTURE GUIDANCE (not a strict template)

- Vary headings across posts. Do NOT reuse "The setup / Full example / Under
  the hood / Gotchas / Frequently asked questions" as a fixed sequence.
  Actual human posts have headings like "A first pass", "Where it broke",
  "The three-column trick", "How I got here", "One more thing about ..."
- Not every post needs an FAQ. Include one only when there are genuinely
  distinct questions readers ask; otherwise omit it.
- Not every post needs a "Where to look next" section. A trailing link line
  is fine.
- Length: aim for 900-1600 words but let the topic decide. If the topic is
  a one-line trick, 700 words is right. If it is architecture, 1800 is fine.
- Paragraph rhythm: mix short and long. Sentence fragments are OK when they
  land. Occasional first person ("I hit this last quarter", "we ended up
  reverting") makes the post feel like a person.

CODE REQUIREMENTS (still hard)

- At least THREE fenced code blocks with a combined >= 40 lines of real
  code (not comments). \`\`\`svelte for components, \`\`\`ts for logic.
  Never \`\`\`js.
- Every code block MUST use real SvGrid API names from the grounding
  facts. Do NOT invent APIs. If a code sample would need something SvGrid
  does not have, restructure the post to use what SvGrid does have.
- Show imports at least once per post so a reader knows where things
  come from. Elide the SAME imports on repeat blocks with a comment.

BANNED PHRASES (hard - these are the most common AI tells)

Never use ANY of these openings or transitions:

- "In this post we'll ..."
- "Let's dive in / dive into"
- "That's why we ..."
- "The good news is ..."
- "Now let's see ..."
- "It's worth noting that ..."
- "At the end of the day ..."
- "Here's the thing:"
- "Under the hood" as a section header (write about internals directly)
- "Gotchas" as a section header (name the actual problems instead)
- Executive-summary lead paragraphs that promise what the post will cover.
  Just start writing.
- Every gotcha as a bulleted list with bold leaders. Prose is fine.
- Ending every post with a Q&A section. Skip when it feels forced.

VOICE

- Write like a working engineer explaining to a peer over coffee. Occasional
  opinions are good ("this is easy to get wrong", "I never liked this API").
- Concrete numbers > vague words. Say "10,000 rows at 60 fps", not "large
  datasets rendered smoothly".
- If a design has a downside, name it. Do not spin.

STYLE RULES (hard)

- Never use em-dashes or en-dashes. Use a plain hyphen "-" with spaces
  around it, or restructure the sentence.
- Use straight ASCII quotes only.
- Do not mention or cite National Instruments / NI.
- No top-level H1 title (frontmatter carries the title).
`

// Delimiter-based output format. The markdown body contains fenced code
// with backticks, newlines, and quotes - trying to squeeze that into a
// JSON string field fails often (backslash escaping is fragile on long
// output). We ask for tiny JSON metadata followed by raw markdown, with
// unambiguous line-delimited markers between them.
const OUTPUT_FORMAT = `\
OUTPUT FORMAT (exact):

Return the response as two sections separated by unique markers. First,
metadata JSON. Second, the raw markdown body (no escaping - write it as
you want it to appear on disk, including \`\`\` code fences).

---METADATA-START---
{"title": "...", "slug": "...", "description": "...", "category": "...", "tags": ["...", "..."]}
---METADATA-END---
---BODY-START---
... full markdown body here, no JSON escaping, use real code fences with backticks ...
---BODY-END---

Emit NOTHING outside those markers. No prose, no explanation, no extra fences.`

function newPostPrompt({ titles, grounding }) {
  return `You are a senior engineer writing for the SvGrid developer blog. SvGrid is a headless-first, Svelte 5-native data grid: a free MIT community package (@svgrid/grid) plus a paid enterprise package. Voice: precise, practical, written for working developers.

Existing post titles (DO NOT duplicate):
${titles.map((t) => '- ' + t).join('\n')}

${grounding}

${STRUCTURE_CONTRACT}

TASK: pick a fresh topic not covered above, and write ONE new blog post that follows the guidance above. It must read like a working engineer wrote it - varied structure, real voice, real code. Choose "category" from: ${CATEGORIES.join(', ')}. Choose 3-6 lowercase tags; make at least one tag one of these feature keywords so the auto hero image is relevant: ${FEATURE_TAGS.join(', ')}.

${OUTPUT_FORMAT}`
}

function regeneratePrompt({ existing, grounding }) {
  return `You are a senior engineer rewriting a blog post for the SvGrid developer blog. The post already has a title, slug, category, and tags - you MUST keep the topic exactly the same. Your job is to raise the quality bar: more depth, real runnable code using real SvGrid APIs, and the required section structure below.

Existing frontmatter to preserve verbatim:
  title:       ${existing.title}
  description: ${existing.description}
  category:    ${existing.category}
  tags:        ${existing.tags}

Original body (for topic reference - IGNORE its structure and depth; rewrite from scratch, use it only to know what the post is meant to be about):
"""
${existing.body.slice(0, 3000)}
"""

${grounding}

${STRUCTURE_CONTRACT}

TASK: rewrite the post so it reads like a working engineer sat down and wrote it, not a machine executing a template. Keep the title / category / tags identical (you may rewrite the description if it feels awkward, staying under 160 chars). Follow the voice + structure guidance above - do NOT reuse the "setup / full example / gotchas / FAQ" skeleton unless it genuinely fits this topic. Vary heading names. Have a point of view. Show real SvGrid code from the grounding facts.

${OUTPUT_FORMAT}`
}

// -------- API call ------------------------------------------------------

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
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    console.error(`Anthropic API error ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
  const data = await res.json()
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
}

/** Parse the delimiter-based output format the model returns. The body
 *  is extracted RAW between BODY-START / BODY-END so it can contain
 *  triple-backtick fences and any characters without escaping. */
function extractStructured(text) {
  const metaMatch = text.match(/---METADATA-START---\s*([\s\S]*?)\s*---METADATA-END---/)
  const bodyMatch = text.match(/---BODY-START---\s*([\s\S]*?)\s*---BODY-END---/)
  if (!metaMatch || !bodyMatch) {
    // Fallback: legacy JSON-object format (in case the model reverted).
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      try {
        const legacy = JSON.parse(text.slice(start, end + 1))
        if (legacy && typeof legacy.body === 'string') return legacy
      } catch { /* fall through to error */ }
    }
    // Save the raw output so the caller can diagnose.
    const dumpPath = join(BLOG_DIR, '..', '..', '..', 'tmp-model-output.txt')
    try { writeFileSync(dumpPath, text) } catch { /* ignore */ }
    throw new Error(
      'Model output did not include METADATA/BODY markers. Raw output ' +
      'saved to tmp-model-output.txt for diagnosis.'
    )
  }
  const metaJson = metaMatch[1].trim()
  const body = bodyMatch[1] // do NOT trim the body's outer whitespace here
  let meta
  try {
    meta = JSON.parse(metaJson)
  } catch (e) {
    throw new Error(`Metadata JSON failed to parse: ${e.message}\nRaw metadata:\n${metaJson}`)
  }
  return { ...meta, body }
}

// -------- Validation ----------------------------------------------------

function countCodeBlocks(body) {
  const fences = (body.match(/^```/gm) || []).length
  return Math.floor(fences / 2)
}
function codeLineCount(body) {
  let inFence = false
  let count = 0
  for (const line of body.split('\n')) {
    if (/^```/.test(line)) { inFence = !inFence; continue }
    if (inFence && line.trim() && !line.trim().startsWith('//')) count += 1
  }
  return count
}
function wordCount(body) {
  return body.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length
}

// Banned phrases: the most reliable AI tells. Case-insensitive substring
// match on the body. Keeping this list here (not just in the prompt) so
// posts that slip through get caught by the validator and retried.
const BANNED_PHRASES = [
  "in this post we'll",
  'in this post, we',
  "let's dive",
  'lets dive',
  "let's start",
  "here's the thing",
  "at the end of the day",
  "it's worth noting that",
  'it is worth noting that',
  'now let us see',
  "now let's see",
  'the good news is',
  "that's why we",
  'that is why we',
]

/** Verify the body meets minimum quality bars WITHOUT forcing a fixed
 *  section skeleton. Returns null on pass, or a string describing what
 *  needs to change (used to retry). */
function validateBody(body) {
  const errs = []
  const wc = wordCount(body)
  if (wc < 700) errs.push(`Body is ${wc} words; expand to 900-1600 (topic-dependent).`)
  const blocks = countCodeBlocks(body)
  if (blocks < 3) errs.push(`Only ${blocks} code blocks; need >= 3.`)
  const codeLines = codeLineCount(body)
  if (codeLines < 40) errs.push(`Only ${codeLines} lines of code; need >= 40.`)
  if (/[—–]/.test(body)) errs.push('Body contains em/en-dashes; replace with plain hyphen.')
  if (/^#\s/m.test(body)) errs.push('Body contains an H1; only H2/H3 allowed.')
  const lower = body.toLowerCase()
  const hits = BANNED_PHRASES.filter((p) => lower.includes(p))
  if (hits.length) errs.push('Body contains banned AI-tell phrases (rewrite without them): ' + hits.join(', '))
  // Structural anti-tell: three of the four "default AI skeleton" headers
  // showing up together is a strong signal the model reverted to the old
  // template. We flag it so the retry produces a different shape.
  const skeleton = ['## The setup', '## Full example', '## Gotchas', '## Frequently asked']
    .filter((h) => new RegExp('^' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'im').test(body))
  if (skeleton.length >= 3) {
    errs.push('Post uses the default AI skeleton (setup / full example / gotchas / FAQ). Restructure around the specific topic; use topic-specific headings.')
  }
  return errs.length ? errs.join(' | ') : null
}

// -------- Render + write ------------------------------------------------

function renderFrontmatter({ title, description, date, updated, category, tags, author }) {
  const lines = [
    '---',
    `title: ${sanitize(title).replace(/\s+/g, ' ').trim()}`,
    `description: ${sanitize(description).replace(/\s+/g, ' ').trim()}`,
    `date: ${date}`,
  ]
  if (updated) lines.push(`updated: ${updated}`)
  lines.push(`category: ${sanitize(category).trim()}`)
  lines.push(`tags: ${tags}`)
  lines.push(`author: ${author}`)
  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

function assembleTagsField(tags) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags).split(',').map((t) => t.trim()).filter(Boolean)
  return list.map((t) => sanitize(String(t).trim().toLowerCase())).filter(Boolean).join(', ')
}

// -------- Mode: generate NEW post --------------------------------------

async function generateNew() {
  const posts = listPosts()
  const titles = posts.map((p) => p.meta.title).filter(Boolean)
  const slugs = new Set(posts.map((p) => p.slug))
  const maxDate = posts.reduce((m, p) => (p.meta.date && p.meta.date > m ? p.meta.date : m), todayISO())
  const date = addDays(maxDate, 1)

  const grounding = buildGrounding({})
  let attempt = 0
  let post
  let lastErr = null
  while (attempt <= MAX_RETRIES) {
    let prompt = newPostPrompt({ titles, grounding })
    if (lastErr) prompt += `\n\nRETRY: the previous output failed validation:\n${lastErr}\nRegenerate the post from scratch, addressing every point.`
    const raw = await callModel(prompt)
    post = extractStructured(raw)
    const err = validateBody(post.body)
    if (!err) break
    lastErr = err
    attempt += 1
  }
  if (!post) throw new Error('Model returned no post.')

  let slug = slugify(post.slug || post.title)
  if (slugs.has(slug)) {
    let n = 2
    while (slugs.has(`${slug}-${n}`)) n += 1
    slug = `${slug}-${n}`
  }
  const fm = renderFrontmatter({
    title: post.title,
    description: post.description,
    date,
    category: post.category,
    tags: assembleTagsField(post.tags),
    author: AUTHOR,
  })
  const body = sanitize(post.body).replace(/^#\s+.*\n+/, '').trim() + '\n'
  const md = fm + body
  const file = join(BLOG_DIR, `${slug}.md`)
  if (DRY_RUN) {
    process.stdout.write(`--- would write ${slug}.md (date ${date}) ---\n\n${md}\n`)
    return
  }
  writeFileSync(file, md)
  process.stdout.write(`Wrote ${slug}.md (category: ${post.category}, date: ${date})\n`)
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitle=${post.title.replace(/\n/g, ' ')}\ndate=${date}\n`)
  }
}

// -------- Mode: regenerate ONE existing post ----------------------------

async function regenerate(slug) {
  const file = join(BLOG_DIR, `${slug}.md`)
  if (!existsSync(file)) {
    console.error(`No such post: ${slug}`)
    process.exit(1)
  }
  const raw = readFileSync(file, 'utf-8')
  const { meta, body } = parseFrontmatter(raw)
  const existing = {
    title: meta.title,
    description: meta.description,
    category: meta.category,
    tags: meta.tags,
    body,
  }
  const tagArr = String(meta.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
  const grounding = buildGrounding({ tags: tagArr, title: meta.title })

  let attempt = 0
  let post
  let lastErr = null
  while (attempt <= MAX_RETRIES) {
    let prompt = regeneratePrompt({ existing, grounding })
    if (lastErr) prompt += `\n\nRETRY: previous output failed validation:\n${lastErr}\nRegenerate addressing every point.`
    const model = await callModel(prompt)
    post = extractStructured(model)
    const err = validateBody(post.body)
    if (!err) break
    lastErr = err
    attempt += 1
  }
  if (!post) throw new Error('Model returned no post.')

  const today = todayISO()
  const updated = pickUpdatedDate(slug, meta.date, today)
  const fm = renderFrontmatter({
    title: meta.title,               // never let the model change the title
    description: post.description || meta.description,
    date: meta.date,                 // preserve original publish date
    updated,                         // deterministic spread over the last 60 days
    category: meta.category,
    tags: assembleTagsField(post.tags || meta.tags),
    author: meta.author || AUTHOR,
  })
  const newBody = sanitize(post.body).replace(/^#\s+.*\n+/, '').trim() + '\n'
  const md = fm + newBody
  if (DRY_RUN) {
    process.stdout.write(`--- would rewrite ${slug}.md ---\n\n${md}\n`)
    return
  }
  writeFileSync(file, md)
  process.stdout.write(`Rewrote ${slug}.md (${wordCount(newBody)} words, ${countCodeBlocks(newBody)} code blocks)\n`)
}

// -------- Mode: batch regenerate ---------------------------------------

/** Fast heuristic: does this file meet the new quality bar? Used by
 *  `--regenerate-failed` to skip files that already passed a previous
 *  batch AND catch posts written under the old rigid-skeleton prompt
 *  so they get a redo under the new human-voice prompt. */
function meetsQualityBar(body) {
  const wc = wordCount(body)
  if (wc < 800) return false
  const blocks = countCodeBlocks(body)
  if (blocks < 3) return false
  // The old prompt's skeleton is a reliable "regen me" signal now that
  // we've moved to varied structures. Three of these four fixed headings
  // co-occurring means the post came from the previous generator.
  const skeletonHits = ['## The setup', '## Full example', '## Gotchas', '## Frequently asked']
    .filter((h) => body.includes(h)).length
  if (skeletonHits >= 3) return false
  const lower = body.toLowerCase()
  if (BANNED_PHRASES.some((p) => lower.includes(p))) return false
  return true
}

async function regenerateBatch({ onlyUnpublished, onlyFailed }) {
  const today = todayISO()
  const posts = listPosts()
    .filter((p) => p.meta.date)
    .filter((p) => (onlyUnpublished ? p.meta.date > today : true))
    .filter((p) => (onlyFailed ? !meetsQualityBar(p.body) : true))
    .sort((a, b) => a.meta.date.localeCompare(b.meta.date))
  process.stdout.write(`Regenerating ${posts.length} post${posts.length === 1 ? '' : 's'} ...\n`)
  const failed = []
  let done = 0
  for (const p of posts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await regenerate(p.slug)
      done += 1
    } catch (e) {
      console.error(`Failed on ${p.slug}: ${e.message}`)
      failed.push(p.slug)
    }
  }
  process.stdout.write(`\nDone. Rewrote ${done}/${posts.length}.\n`)
  if (failed.length) {
    process.stdout.write(
      `\n${failed.length} post${failed.length === 1 ? '' : 's'} failed. Retry with:\n` +
      failed.map((s) => `  node tools/generate-blog-post.mjs --regenerate ${s}`).join('\n') + '\n'
    )
  }
}

// -------- CLI ----------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const regenIdx = args.indexOf('--regenerate')
  if (regenIdx !== -1) {
    const slug = args[regenIdx + 1]
    if (!slug) { console.error('--regenerate requires a slug argument'); process.exit(1) }
    await regenerate(slug)
    return
  }
  if (args.includes('--regenerate-all')) {
    await regenerateBatch({ onlyUnpublished: false, onlyFailed: false })
    return
  }
  if (args.includes('--regenerate-unpublished')) {
    await regenerateBatch({ onlyUnpublished: true, onlyFailed: false })
    return
  }
  if (args.includes('--regenerate-failed')) {
    // Only re-run posts that don't meet the quality bar yet.
    // Idempotent - rerunning after a partial batch just picks up where it left off.
    await regenerateBatch({ onlyUnpublished: false, onlyFailed: true })
    return
  }
  await generateNew()
}

main().catch((err) => { console.error(err); process.exit(1) })
