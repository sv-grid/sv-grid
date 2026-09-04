#!/usr/bin/env node
/**
 * Blog post generator + regenerator for the SvGrid website.
 *
 * Modes:
 *   node tools/generate-blog-post.mjs                 # same as --next
 *   node tools/generate-blog-post.mjs --next          # write the next unwritten topic from
 *                                                     # tools/blog-topics.json at the end of the
 *                                                     # publish queue; an empty topic queue is a
 *                                                     # no-op (exit 0, nothing written)
 *   node tools/generate-blog-post.mjs --topic <slug>  # write one specific queued topic
 *   node tools/generate-blog-post.mjs --list-topics   # show the queue with done / next marks
 *   node tools/generate-blog-post.mjs --freeform      # let the model pick a topic (the old
 *                                                     # behaviour; kept for one-offs)
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
 *   ANTHROPIC_WORKSPACE_ID - required when the key above is an IDENTITY-LINKED
 *                     key, which rejects every request without it:
 *                     "anthropic-workspace-id is required when authenticating
 *                     with an identity-linked API key". Find it in the Console
 *                     under Settings -> Workspaces. A plain key ignores it.
 *   BLOG_MODEL        - model id (default: claude-sonnet-4-6).
 *   BLOG_MAX_RETRIES  - retries on validation failure (default: 1).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './blog-card.mjs'
import { BLOG_CATEGORIES, loadTopics, nextTopic, findTopic, isTopicConsumed } from './lib/blog-topics.mjs'
import { loadGridExports, loadApiMethods } from './lib/grid-api-facts.mjs'
import { clampDescription } from './lib/seo-text.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')
const DEMOS_DIR = join(ROOT, 'examples', 'src', 'demos')

const DRY_RUN = process.argv.includes('--dry-run')
const MODEL = process.env.BLOG_MODEL || 'claude-sonnet-4-6'
const API_KEY = process.env.ANTHROPIC_API_KEY
// Required when ANTHROPIC_API_KEY is an identity-linked key; ignored otherwise.
const WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID
const MAX_RETRIES = Number.parseInt(process.env.BLOG_MAX_RETRIES ?? '1', 10)
const AUTHOR = 'Boyko Markov'

// Categories currently in use across the queue (shared with the topic queue
// validator so a queued topic cannot name one the site does not group).
const CATEGORIES = BLOG_CATEGORIES

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

// The export list and SvGridApi method names come from tools/lib/grid-api-facts.mjs,
// shared with the topic queue validator.

/** Load a compact code sample from each demo (first 80 non-comment lines
 *  of the script block) so the model can crib real usage patterns. Only
 *  the demos whose id / description matches the post's tags get bundled,
 *  plus any the topic contract requires the post to link. */
function loadRelevantDemos(tags, title, required = []) {
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
    let score = required.includes(f.replace(/\.svelte$/, '')) ? 100 : 0
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
    // The <SvGrid ...> element lives in the MARKUP, not the script, so a
    // script-only sample showed the model setup code and hid the thing a post
    // actually has to demonstrate: which props exist and how they nest. Left
    // out, the model invents plausible ones - a generated kanban post used
    // `rows`, `laneField` and `cardSnippet`, none of which exist, and none of
    // which would have compiled.
    const markup = raw.slice(scriptMatch.index + scriptMatch[0].length)
    const usage = [...markup.matchAll(/<SvGrid\b[\s\S]*?(?:\/>|<\/SvGrid>)/g)]
      .map((m) => m[0])
      .join('\n\n')
      .split('\n')
      .slice(0, 60)
      .join('\n')
    scored.push({ file: f, score, script: compact, usage })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, Math.max(3, required.length))
}

/** Build a "grounding" section for the prompt: real exports + real demo
 *  code the model can adapt. */
function buildGrounding({ tags = [], title = '', demos: required = [] } = {}) {
  const { values, types } = loadGridExports(ROOT)
  const apiMethods = loadApiMethods(ROOT)
  const demos = loadRelevantDemos(tags, title, required)
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
      if (d.usage) {
        // The element itself, verbatim. These are the ONLY prop names that
        // exist; anything else the model reaches for is invented.
        lines.push('')
        lines.push('<!-- how the component is actually called in this demo -->')
        lines.push(d.usage)
      }
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
- Length: 900-1600 words of PROSE, counted with every code block removed. 900
  is a hard floor and a post under it is rejected and rewritten, so do not aim
  at the floor - aim at 1100 and let the topic pull it up. Architecture pieces
  can run to 1800.
  Earn the words rather than padding: the failure mode is a post that shows six
  snippets and explains none of them. For each block, say why it is shaped that
  way, what it costs, and what breaks without it. A paragraph on the mistake
  you would otherwise make is worth more than another snippet.
- Paragraph rhythm: mix short and long. Sentence fragments are OK when they
  land. Occasional first person ("I hit this last quarter", "we ended up
  reverting") makes the post feel like a person.

CODE REQUIREMENTS (still hard)

- At least THREE fenced code blocks with a combined >= 90 lines of real
  code (>= 45 for a comparison post, where prose does more of the work).
  \`\`\`svelte for components, \`\`\`ts for logic. Never \`\`\`js.
  Show the whole component once - imports, types, columns, the element - so a
  reader can paste it and run it. Elided fragments full of "..." are what make
  a post useless; the existing posts on this blog average 130 lines and that is
  the bar.
- Every code block MUST use real SvGrid API names from the grounding
  facts. Do NOT invent APIs. If a code sample would need something SvGrid
  does not have, restructure the post to use what SvGrid does have.
- The two required props are \`data\` and \`columns\`. If your local variable is
  called \`rows\`, write \`data={rows}\` - NOT \`{rows}\`, which would be a prop
  named "rows" and does not exist. Copy prop names from the "how the component
  is actually called" block in the reference snippets; every <SvGrid> prop you
  write is checked against the real type, and a post using an invented one is
  rejected and rewritten.
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

BANNED SENTENCE SHAPES (hard - the words are innocent, the shape is the tell)

- The reframe: "not just X, it's Y" / "not only X but also Y". Say the one
  thing that is true.
- The audience hedge: "whether you're a beginner or a veteran ...". Write for
  one reader.
- "In today's ...", "gone are the days", "at its core", "the beauty of".
- Booster adjectives standing in for a measurement: seamless, effortless,
  blazing-fast, cutting-edge, game-changer. If it is fast, give the number.
- Marketing verbs: supercharge, unlock, elevate, delve, empower.

These are checked mechanically, so a post using one is rejected and rewritten.
Note the check is on shape: "this is not just any grid" is fine, and so is
"ask whether you need pagination at all".

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
- Naming rivals depends on the category, and the two cases are opposite:

  * Category "Comparisons": you MUST name the real alternatives, at least
    two, and say specifically where each one wins. A comparison that names
    nobody is not a comparison - it is a pitch, and a reader looking for
    options leaves with none. Be accurate about their strengths even when
    that is inconvenient; the page is worthless the moment a reader who
    knows the field catches it shading.
  * Every other category: do NOT name rival data-grid products (AG Grid,
    TanStack Table, MUI X, Kendo, Syncfusion, Handsontable, DevExtreme,
    Tabulator, SVAR, Glide, Smart.Grid, jqxGrid, react-data-grid, PrimeVue
    DataTable, svelte-headless-table). Describe the technique on its own
    terms - a post about a modal has no reason to invoke a grid vendor,
    and anchoring to a rival advertises them.

  Frameworks and integration tools are never rivals: Svelte, SvelteKit,
  React, Vite, Tailwind and TanStack Query are fine to name anywhere.
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
{"title": "...", "slug": "...", "description": "...", "seoTitle": "...", "seoDescription": "...", "category": "...", "tags": ["...", "..."]}
---METADATA-END---
---BODY-START---
... full markdown body here, no JSON escaping, use real code fences with backticks ...
---BODY-END---

Emit NOTHING outside those markers. No prose, no explanation, no extra fences.`

/** The part of the prompt that turns a queued search query into a post that
 *  can rank for it: the query where it has to appear, the demos and docs the
 *  post has to link (real internal links are what the demo and doc pages were
 *  missing), and the identifiers the code has to use. */
function topicContract(topic) {
  const demos = topic.demos ?? []
  const docs = topic.docs ?? []
  const api = topic.api ?? []
  const lines = [
    'TOPIC CONTRACT (hard - this post exists to rank for one search query)',
    '',
    `Primary query: "${topic.query}"`,
    `Secondary phrasings: ${(topic.secondary ?? []).join(', ') || '(none)'}`,
    `Intent: ${topic.intent}`,
    `Working title (rewrite freely, keep the query's words in it): ${topic.workingTitle}`,
    `Category: ${topic.category} (use exactly this)`,
    `Tags: ${topic.tags.join(', ')} (use exactly these)`,
    `Brief: ${topic.brief}`,
    '',
    'Requirements:',
    '- The primary query, or a close natural variant of it, appears in the title, in the first 100 words, and in at least one H2. Write it the way a developer types it; never stuff it.',
  ]
  if (demos.length) lines.push(`- Link each of these demos at least once with a real markdown link and descriptive link text: ${demos.map((id) => `[...](/demos/${id}/)`).join(', ')}`)
  if (demos.length) {
    // Every demo has a captured thumbnail under website/public/thumbs, so the
    // image is a real screenshot of the thing the post is about rather than
    // decoration. Only these paths are allowed: anything invented would 404.
    lines.push(
      `- Include at least one screenshot, using EXACTLY one of these paths (they exist; do not invent an image path): ${demos.map((id) => `![alt](/thumbs/${id}.webp)`).join(', ')}`,
      '- Place the screenshot where it earns its place - after the first code block that produces something visible, not stacked at the top. Write real alt text describing what is on screen, not "screenshot of the component".',
    )
  }
  if (docs.length) lines.push(`- Link each of these docs the same way: ${docs.map((s) => `[...](/docs/${s}/)`).join(', ')}`)
  if (api.length) lines.push(`- Use these identifiers in the code, spelled exactly: ${api.join(', ')}`)
  lines.push(
    '- Fill "seoTitle" (at most 60 characters, leads with the query\'s head noun, no site name) and "seoDescription" (at most 155 characters, one concrete promise, contains the query) in the metadata.',
    '- The existing titles above are covered ground; take the angle in the brief rather than restating one of them.',
  )
  return lines.join('\n')
}

function newPostPrompt({ titles, grounding, topic = null }) {
  const task = topic
    ? `TASK: write ONE new blog post that fulfils the topic contract below and follows the guidance above. It must read like a working engineer wrote it - varied structure, real voice, real code.

${topicContract(topic)}`
    : `TASK: pick a fresh topic not covered above, and write ONE new blog post that follows the guidance above. It must read like a working engineer wrote it - varied structure, real voice, real code. Choose "category" from: ${CATEGORIES.join(', ')}. Choose 3-6 lowercase tags; make at least one tag one of these feature keywords so the auto hero image is relevant: ${FEATURE_TAGS.join(', ')}. Fill "seoTitle" (at most 60 characters, keyword first, no site name) and "seoDescription" (at most 155 characters) in the metadata.`
  return `You are a senior engineer writing for the SvGrid developer blog. SvGrid is a headless-first, Svelte 5-native data grid: a free MIT community package (@svgrid/grid) plus a paid enterprise package. Voice: precise, practical, written for working developers.

Existing post titles (DO NOT duplicate):
${titles.map((t) => '- ' + t).join('\n')}

${grounding}

${STRUCTURE_CONTRACT}

${task}

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
      // An identity-linked key must say which workspace the request acts in,
      // and is rejected with a 400 otherwise. A plain key ignores the header,
      // so sending it whenever it is configured is safe either way.
      ...(WORKSPACE_ID ? { 'anthropic-workspace-id': WORKSPACE_ID } : {}),
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
    throw new Error(`Metadata JSON failed to parse: ${e.message}\nRaw metadata:\n${metaJson}`, { cause: e })
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
/** Body with fenced code removed - the view every prose-level check wants. */
function stripCode(body) {
  return body.replace(/```[\s\S]*?```/g, ' ')
}

function wordCount(body) {
  return stripCode(body).split(/\s+/).filter(Boolean).length
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

/**
 * Structural AI tells that a plain substring list cannot catch, because the
 * words are innocent on their own. It is the SHAPE that reads as machine copy:
 * the pseudo-profound reframe, the audience-hedge, the booster adjective doing
 * the work a concrete number should do.
 *
 * Found by auditing the existing 175 posts: "not just" appeared in 23 and
 * "whether you" in 16, and they are the two loudest tells in the corpus.
 * Deliberately pattern-based - "not just any grid" is fine English; "not just
 * fast, it's simple" is the tell.
 */
/**
 * Every prop `<SvGrid>` actually accepts, read from the Props type at run time
 * so this can never drift from the component. Used to reject invented props in
 * generated code.
 */
const GRID_PROPS = (() => {
  const names = new Set(['data', 'columns'])
  try {
    const types = readFileSync(join(ROOT, 'packages', 'grid', 'src', 'SvGrid.types.ts'), 'utf-8')
    // The Props interface is the last big block; take every 2-space-indented
    // optional member across the file and let the extras be harmless - a prop
    // that exists on a nested config type is still a real name.
    for (const [, name] of types.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)) names.add(name)
  } catch {
    /* fall through: an empty-ish set only disables the check, never fails a post */
  }
  return names
})()

const STYLE_TELLS = [
  [/\bnot just\b[^.]{0,50}\b(it'?s|they'?re|but)\b/i, 'the "not just X, it\'s Y" reframe'],
  [/\bnot only\b[^.]{0,70}\bbut also\b/i, 'the "not only ... but also" reframe'],
  [/\bwhether you(?:'re| are)\b/i, 'the "whether you\'re X or Y" audience hedge'],
  [/\bin today'?s\b/i, '"in today\'s ..." opener'],
  [/\bgone are the days\b/i, '"gone are the days"'],
  [/\bat its core\b/i, '"at its core"'],
  [/\bthe beauty of\b/i, '"the beauty of"'],
  [/\b(seamless(ly)?|effortless(ly)?|blazing[- ]fast|cutting[- ]edge|game[- ]changer)\b/i, 'booster adjective (say the number instead)'],
  [/\b(supercharge|unlock|elevate|delve|empower)s?\b/i, 'marketing verb'],
]

/**
 * Rival data-grid products. Named only in "Comparisons" posts (the comparison
 * and migration guides); anywhere else the technique gets described on its own
 * terms. Deliberately NOT here: Svelte, SvelteKit, React, Vite, Tailwind,
 * shadcn-svelte, Bits UI and TanStack Query - frameworks and integration tools
 * are not competitors. Note `TanStack Table` is matched in full: TanStack Query
 * is an integration we are happy to name.
 */
/**
 * Svelte UI kits. Not rivals to the GRID, so they are never banned - but they
 * ARE the alternatives a "which Svelte UI component library" comparison has to
 * weigh, so they count toward that post's requirement to name competitors.
 * Every one of these is already named in docs/help/migrating-from-ui-kit-tables.md.
 */
const UI_KIT_ALTERNATIVES = [
  /\bskeleton(?:\s*(?:ui|labs))?\b/i,
  /\bflowbite(?:-svelte)?\b/i,
  /\bshadcn-svelte\b/i,
  /\bbits\s*ui\b/i,
  /\bmelt\s*ui\b/i,
  /\bcarbon\s+components?\s+svelte\b/i,
  // Not UI kits, but the alternatives the board and scheduler briefs name, and
  // the counter has to recognise what the brief asked for. Leaving these out
  // failed a kanban post that had correctly named svelte-dnd-action.
  /\bsvelte-dnd-action\b/i,
  /\bdndzone\b/i,
  /\bfullcalendar\b/i,
  /\bschedule-?x\b/i,
  /\bdhtmlx\b/i,
  /\bfrappe\s+gantt\b/i,
]

const RIVAL_VENDORS = [
  /\bag[- ]?grid\b/i,
  /\btanstack\s+table\b/i,
  /\bmui\s*x\b/i,
  /\bkendo\b/i,
  /\bsyncfusion\b/i,
  /\bhandsontable\b/i,
  /\bdevextreme\b/i,
  /\btabulator\b/i,
  /\bsvar\b/i,
  /\bglide\s+data\s+grid\b/i,
  /\bsmart\.?grid\b/i,
  /\bjqx[- ]?grid\b/i,
  /\breact-data-grid\b/i,
  /\bprimevue\b/i,
  /\bsvelte-headless-table\b/i,
]

/** Verify the body meets minimum quality bars WITHOUT forcing a fixed
 *  section skeleton. Returns null on pass, or a string describing what
 *  needs to change (used to retry). */
function validateBody(body, topic = null) {
  const errs = []
  const wc = wordCount(body)
  if (wc < 900) errs.push(`Body is ${wc} words of prose; expand to 900-1600. Do not pad - explain why each snippet is shaped the way it is, and what breaks without it.`)
  const blocks = countCodeBlocks(body)
  // Same reasoning as the code-line floor below: a comparison post argues in
  // prose and shows less code, so holding it to a how-to's block count just
  // forces filler. Relaxing the line count but not the block count was an
  // inconsistency on my part, and it failed two otherwise-good posts.
  const blockFloor = topic?.intent === 'comparison' ? 2 : 3
  if (blocks < blockFloor) errs.push(`Only ${blocks} code blocks; need >= ${blockFloor}.`)
  const codeLines = codeLineCount(body)
  // The existing corpus runs a median of 132 lines of code per post, and the
  // first generated batch came in at ~73 - thinner than what readers already
  // get. A comparison post legitimately carries less code than a how-to, so
  // the floor follows the intent rather than being one number for everything.
  const codeFloor = topic?.intent === 'comparison' ? 45 : 90
  if (codeLines < codeFloor) {
    errs.push(`Only ${codeLines} lines of code; need >= ${codeFloor}. Show the fuller example rather than an elided fragment.`)
  }
  if (/[—–]/.test(body)) errs.push('Body contains em/en-dashes; replace with plain hyphen.')
  // Strip fenced code first: a `# comment` at column 0 in a shell or Python
  // block is not a heading, and failing the post for one is a false positive.
  if (/^#\s/m.test(stripCode(body))) errs.push('Body contains an H1; only H2/H3 allowed.')
  const lower = body.toLowerCase()
  const hits = BANNED_PHRASES.filter((p) => lower.includes(p))
  if (hits.length) errs.push('Body contains banned AI-tell phrases (rewrite without them): ' + hits.join(', '))
  // Invented props. Grounding alone did not stop this: a generated kanban post
  // used `rows`, `laneField`, `view` and `cardSnippet` on <SvGrid>, none of
  // which exist, so none of its code would have compiled. Checking the element
  // mechanically is the backstop.
  const invented = new Set()
  for (const [, attrs] of body.matchAll(/<SvGrid\b([\s\S]*?)(?:\/>|>)/g)) {
    for (const [, name] of attrs.matchAll(/(?:^|\s)([a-zA-Z][a-zA-Z0-9]*)\s*=/g)) {
      if (!GRID_PROPS.has(name)) invented.add(name)
    }
    // `{shorthand}` form. Strip `name={...}` pairs first, or the VALUE gets
    // read as a prop name: `data={rows}` would report a prop called "rows" and
    // `responsive={true}` one called "true".
    const shorthandOnly = attrs.replace(/[a-zA-Z][a-zA-Z0-9]*\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*')/g, ' ')
    for (const [, name] of shorthandOnly.matchAll(/\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}/g)) {
      if (!GRID_PROPS.has(name)) invented.add(name)
    }
  }
  if (invented.size) {
    errs.push(
      'Code uses <SvGrid> props that do not exist: ' + [...invented].join(', ') +
        '. Use only props shown in the reference snippets.',
    )
  }
  // Structural tells. Checked against prose only: a string literal or an
  // identifier in a code block should never trip a style rule.
  const prose = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  const tells = STYLE_TELLS.filter(([re]) => re.test(prose)).map(([, label]) => label)
  if (tells.length) {
    errs.push('Body uses AI-tell sentence shapes (rewrite the sentence, do not just swap a word): ' + tells.join('; '))
  }
  // Structural anti-tell: three of the four "default AI skeleton" headers
  // showing up together is a strong signal the model reverted to the old
  // template. We flag it so the retry produces a different shape.
  const skeleton = ['## The setup', '## Full example', '## Gotchas', '## Frequently asked']
    .filter((h) => new RegExp('^' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'im').test(body))
  if (skeleton.length >= 3) {
    errs.push('Post uses the default AI skeleton (setup / full example / gotchas / FAQ). Restructure around the specific topic; use topic-specific headings.')
  }
  // Rival grid vendors belong in comparison and migration posts, which are the
  // "Comparisons" category, and nowhere else - a post about a modal that
  // name-drops a grid vendor is advertising them. Kept here as well as in the
  // prompt so a post that slips through is retried rather than published.
  if (!topic || topic.category !== 'Comparisons') {
    const named = RIVAL_VENDORS.filter((v) => v.test(body))
    if (named.length) {
      errs.push(
        'Body names rival grid vendors outside a Comparisons post (' +
          named.map((v) => v.source.replace(/\\[sb]\*?/g, ' ').trim()).join(', ') +
          '). Describe the technique on its own terms instead.',
      )
    }
  } else if (topic.intent === 'comparison') {
    // The inverse failure, and the one that actually happened: a "best Svelte
    // data grid" post that named nobody, built a decision framework, and
    // recommended only our own tiers. Useless to a reader weighing options,
    // and useless as something an assistant can quote back.
    const named = [...RIVAL_VENDORS, ...UI_KIT_ALTERNATIVES].filter((v) => v.test(body))
    if (named.length < 2) {
      errs.push(
        `A comparison post has to name the real alternatives; this one names ${named.length}. ` +
          'Name at least two competing libraries and say where each one wins.',
      )
    }
  }
  if (topic) {
    // A post about a UI component with no picture of it is worse than the docs
    // page it links to. Every referenced demo has a thumbnail, so the only
    // reason to be missing one is that the model skipped it.
    const demoIds = topic.demos ?? []
    if (demoIds.length) {
      const images = [...body.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)]
      if (!images.length) {
        errs.push(
          'Post has no screenshot. Embed one of: ' +
            demoIds.map((id) => `/thumbs/${id}.webp`).join(', '),
        )
      } else {
        const bad = images.filter(([, , src]) => !/^\/(thumbs|blog-media|docs-media)\//.test(src))
        if (bad.length) {
          errs.push(
            'Image path does not exist: ' + bad.map(([, , src]) => src).join(', ') +
              '. Use one of: ' + demoIds.map((id) => `/thumbs/${id}.webp`).join(', '),
          )
        }
        const lazyAlt = images.filter(([, alt]) => !alt.trim() || /^(screenshot|image)\b/i.test(alt.trim()))
        if (lazyAlt.length) errs.push('Image alt text must describe what is on screen, not "screenshot of ...".')
      }
    }
    // The contract is what makes the post rank: the query's words, the demo
    // and doc links, the identifiers. Each is checked mechanically.
    const words = topic.query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const thin = words.filter((w) => lower.split(w).length - 1 < 2)
    if (thin.length) errs.push(`The query words ${thin.join(', ')} appear fewer than twice; work "${topic.query}" into the body naturally.`)
    for (const id of topic.demos ?? []) {
      if (!new RegExp(`\\]\\(/demos/${id}/?\\)`).test(body)) errs.push(`Missing a markdown link to /demos/${id}/.`)
    }
    for (const s of topic.docs ?? []) {
      if (!new RegExp(`\\]\\(/docs/${s}/?\\)`).test(body)) errs.push(`Missing a markdown link to /docs/${s}/.`)
    }
    for (const name of topic.api ?? []) {
      if (!body.includes(name)) errs.push(`The identifier ${name} must appear in the code.`)
    }
  }
  return errs.length ? errs.join(' | ') : null
}

// -------- Render + write ------------------------------------------------

const oneLine = (s) => sanitize(s).replace(/\s+/g, ' ').trim()

/** A search title the model proposed, or nothing when it is unusable: the
 *  page falls back to "<title> - SvGrid Blog" rather than ship a truncated
 *  or empty <title>. */
function cleanSeoTitle(raw) {
  const t = raw ? oneLine(raw) : ''
  return t && t.length <= 65 ? t : ''
}

function renderFrontmatter({ title, description, seoTitle, seoDescription, date, updated, category, tags, author, pinned }) {
  const lines = [
    '---',
    `title: ${oneLine(title)}`,
    `description: ${oneLine(description)}`,
  ]
  if (seoTitle) lines.push(`seoTitle: ${oneLine(seoTitle)}`)
  if (seoDescription) lines.push(`seoDescription: ${oneLine(seoDescription)}`)
  lines.push(`date: ${date}`)
  if (updated) lines.push(`updated: ${updated}`)
  lines.push(`category: ${sanitize(category).trim()}`)
  lines.push(`tags: ${tags}`)
  lines.push(`author: ${author}`)
  if (pinned) lines.push('pinned: true')
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

async function generateNew({ topic = null } = {}) {
  const posts = listPosts()
  const titles = posts.map((p) => p.meta.title).filter(Boolean)
  const slugs = new Set(posts.map((p) => p.slug))
  const maxDate = posts.reduce((m, p) => (p.meta.date && p.meta.date > m ? p.meta.date : m), todayISO())
  // Two posts a week, not one a day. Publishing ~900 URLs into a domain with
  // little authority left most of them crawled and not indexed, so the drip is
  // deliberately slower. A uniform pick over 2..5 days averages 3.5, which is
  // exactly two a week, while keeping the interval from looking machine-timed.
  const date = addDays(maxDate, [2, 3, 4, 5][Math.floor(Math.random() * 4)])
  if (topic && slugs.has(topic.slug)) throw new Error(`Topic "${topic.slug}" already has a post; it is consumed.`)

  const grounding = buildGrounding(topic ? { tags: topic.tags, title: topic.workingTitle, demos: topic.demos ?? [] } : {})
  let attempt = 0
  let post
  let lastErr = null
  let passed = false
  while (attempt <= MAX_RETRIES) {
    let prompt = newPostPrompt({ titles, grounding, topic })
    if (lastErr) prompt += `\n\nRETRY: the previous output failed validation:\n${lastErr}\nRegenerate the post from scratch, addressing every point.`
    const raw = await callModel(prompt)
    post = extractStructured(raw)
    const err = validateBody(post.body, topic)
    if (!err) { passed = true; break }
    lastErr = err
    attempt += 1
  }
  if (!post) throw new Error('Model returned no post.')
  // A topic post that still misses its contract (required links, query) is
  // not worth publishing: fail the run and the queue retries it tomorrow.
  if (topic && !passed) throw new Error(`Post for "${topic.slug}" failed validation after ${MAX_RETRIES + 1} attempts: ${lastErr}`)

  // A queued topic owns its slug. A collision (either mode) is a duplicate
  // post, not a reason to publish "<slug>-2" next to the original.
  const slug = topic ? topic.slug : slugify(post.slug || post.title)
  if (slugs.has(slug)) throw new Error(`A post with slug "${slug}" already exists; not writing a duplicate.`)
  const fm = renderFrontmatter({
    title: post.title,
    description: post.description,
    seoTitle: cleanSeoTitle(post.seoTitle),
    seoDescription: post.seoDescription ? clampDescription(oneLine(post.seoDescription)) : '',
    date,
    category: topic ? topic.category : post.category,
    tags: assembleTagsField(topic ? topic.tags : post.tags),
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
    seoTitle: meta.seoTitle,         // hand-tuned search copy survives a rewrite
    seoDescription: meta.seoDescription,
    date: meta.date,                 // preserve original publish date
    updated,                         // deterministic spread over the last 60 days
    category: meta.category,
    tags: assembleTagsField(post.tags || meta.tags),
    author: meta.author || AUTHOR,
    pinned: meta.pinned === 'true',
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
  if (args.includes('--freeform')) {
    await generateNew({})
    return
  }
  const { topics, problems } = loadTopics(ROOT)
  if (args.includes('--list-topics')) {
    for (const t of topics) {
      process.stdout.write(`${isTopicConsumed(ROOT, t.slug) ? 'done' : 'next'}  ${t.slug}  "${t.query}"  [${t.category}]\n`)
    }
    const open = topics.filter((t) => !isTopicConsumed(ROOT, t.slug)).length
    process.stdout.write(`\n${topics.length} topics, ${open} open.\n`)
    if (problems.length) {
      console.error('\nProblems:\n' + problems.map((p) => '  - ' + p).join('\n'))
      process.exit(1)
    }
    return
  }
  if (problems.length) {
    console.error('tools/blog-topics.json has problems:\n' + problems.map((p) => '  - ' + p).join('\n'))
    process.exit(1)
  }
  const topicIdx = args.indexOf('--topic')
  if (topicIdx !== -1) {
    const slug = args[topicIdx + 1]
    const topic = slug ? findTopic(topics, slug) : null
    if (!topic) { console.error(`--topic needs a slug from tools/blog-topics.json (got "${slug ?? ''}")`); process.exit(1) }
    await generateNew({ topic })
    return
  }
  // --next, or no flag at all: the queue drives the daily post. An empty queue
  // is a quiet no-op so the scheduled run stays green and commits nothing.
  const topic = nextTopic(ROOT, topics)
  if (!topic) {
    process.stdout.write('Topic queue is empty; nothing generated. Add entries to tools/blog-topics.json or pass --freeform.\n')
    return
  }
  await generateNew({ topic })
}

main().catch((err) => { console.error(err); process.exit(1) })
