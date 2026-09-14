/**
 * draft - propose a tutorial script for a gallery demo.
 *
 *   node --env-file=.env tools/tutorials/draft.mjs <demo-id> [--out <tutorial-id>] [--force] [--dry-run]
 *
 * Reads the demo's registry entry, its meta/<id>.json, its Svelte source and
 * the docs pages that embed it, and asks the Anthropic API for a title, a
 * short description, the docs page to host the tutorial, tags and 4-6
 * narration beats with a plain-English action each. The result is written to
 * tools/tutorials/scripts/<tutorial-id>.mjs with every `do` left as a
 * `throw new Error('TODO: ...')`, so an unedited draft fails loudly at record
 * time instead of producing a silent video of nothing. You edit the narration
 * and write the actions with the `h` helpers, then `pnpm tutorials <id>`.
 *
 * Env: ANTHROPIC_API_KEY (+ ANTHROPIC_WORKSPACE_ID for identity-linked keys),
 * TUTORIAL_MODEL (default claude-sonnet-4-6). Same bare-fetch call as
 * tools/generate-blog-post.mjs.
 */
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseDemoRegistry, readDemoSource, readDemoMeta } from '../lib/demo-registry.mjs'
import { loadDocs } from '../demo-doc-coverage.mjs'
import { normalizeNarration } from '../lib/tutorial-media.mjs'
import { ROOT, SCRIPTS_DIR } from './lib/manifest.mjs'

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}
const demoId = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--out'))
const MODEL = process.env.TUTORIAL_MODEL || 'claude-sonnet-4-6'
const API_KEY = process.env.ANTHROPIC_API_KEY
const WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

// Mirrors the style validators in tools/generate-blog-post.mjs (not exported
// there, and importing that module would run its CLI).
const STYLE_TELLS = [
  [/\bnot just\b[^.]{0,50}\b(it'?s|they'?re|but)\b/i, 'the "not just X, it\'s Y" reframe'],
  [/\bnot only\b[^.]{0,70}\bbut also\b/i, 'the "not only ... but also" reframe'],
  [/\bwhether you(?:'re| are)\b/i, 'the "whether you\'re X or Y" audience hedge'],
  [/\b(seamless(ly)?|effortless(ly)?|blazing[- ]fast|cutting[- ]edge|game[- ]changer|powerful|robust)\b/i, 'booster adjective'],
  [/\b(supercharge|unlock|elevate|delve|empower|dive)s?\b/i, 'marketing verb'],
  [/\bin this (video|tutorial)\b/i, '"in this tutorial" opener'],
  [/\b(welcome|hey|hi there|today we)\b/i, 'chatty opener'],
]
const RIVAL_VENDORS = [
  /\bag[- ]?grid\b/i, /\btanstack\b/i, /\bmui\s*x\b/i, /\bkendo\b/i, /\bsyncfusion\b/i, /\bhandsontable\b/i,
  /\bdevextreme\b/i, /\btabulator\b/i, /\bsvar\b/i, /\bglide\b/i, /\bsmart\.?grid\b/i, /\bjqx/i, /\bprimevue\b/i,
]

const HELPERS = `
h.gridReady(minRows)                 wait until the grid painted rows
h.settleRowCount()                   wait for the 1M-row demo's dataset to finish generating
h.focusGrid()                        hide the demo's headline and long paragraphs
h.hideIntro('text')                  hide the blurb containing that text
h.kpi(/label/i)                      read a number from a stat card
h.moveTo(x, y)                       sweep the visible cursor to a point
h.hover(target) / h.click(target)    target = css selector, Playwright locator or {x,y}
h.dblclickCell(rowIdx, /header/i)    double-click a body cell (opens the editor)
h.clickCell(rowIdx, /header/i, { modifiers: ['Shift'] })
h.type('text', { delay }) / h.press('Enter')
h.easedScroll(fraction, ms)          smooth-scroll the grid to a fraction of its height
h.clickHeaderFilter(/column/i)       open the Excel-style filter menu of a column
h.dragFillHandle({ cells: 6 })       drag the fill handle of the current selection
h.dragHtml5({ selector, text }, { selector, text })   native HTML5 drag and drop
h.pause(ms)
`.trim()

/** Trim a demo's source to the parts that matter for narration. */
function sourceExcerpt(source, max = 3500) {
  const lines = source.split('\n')
  const script = lines.slice(0, 80).join('\n')
  const gridAt = source.indexOf('<SvGrid')
  const grid = gridAt >= 0 ? source.slice(gridAt, source.indexOf('/>', gridAt) + 2) : ''
  return `${script}\n...\n${grid}`.slice(0, max)
}

async function callModel(prompt) {
  if (!API_KEY) fail('ANTHROPIC_API_KEY is not set (node --env-file=.env ...)')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      ...(WORKSPACE_ID ? { 'anthropic-workspace-id': WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) fail(`Anthropic API error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
}

function buildPrompt({ demo, meta, source, docs, tutorialId }) {
  return `You write the narration for a 30-second screen-recorded tutorial of one feature of SvGrid, a Svelte 5 data grid. The tutorial is recorded on the demo below while a script drives the real UI. Propose the narration and the on-screen action for each beat.

Demo id: ${demo.id}
Demo title: ${demo.title}
Demo blurb: ${demo.blurb}
Category: ${demo.category}
${meta.description ? `Demo description: ${meta.description}\n` : ''}${meta.keywords.length ? `Keywords: ${meta.keywords.join(', ')}\n` : ''}
Docs pages that embed this demo (pick ONE as docsPage, prefer the overview of the feature):
${docs.map((d) => `- ${d.path}  "${d.title}"`).join('\n') || '- (none; pick the most relevant page under docs/help/)'}

Demo source (trimmed):
\`\`\`svelte
${source}
\`\`\`

Rules:
- 4 to 6 beats; 70 to 85 words in total (about 30 seconds at a calm pace).
- Second person, present tense, concrete verbs: "double-click", "drag", "untick". State what the viewer sees.
- Name SvGrid props and API only if they appear in the source above, and name at most two.
- No hype, no booster adjectives, no "in this tutorial", no greeting. No em or en dashes; use a plain hyphen or a comma. Straight quotes only.
- Never name other data grid products.
- The first beat says what the feature is and how it is turned on. The last beat says what the viewer can do next or what got saved.
- "action" is one plain-English instruction for the person who will script the beat with these helpers:
${HELPERS}
- description: one sentence, at most 150 characters, written for a search result.
- tags: 4 to 6 short lowercase search phrases.
- title: at most 60 characters, e.g. "Excel-style filter menu in SvGrid".

Answer with JSON only, no prose, no code fence:
{"id":"${tutorialId}","title":"...","description":"...","docsPage":"docs/help/...md","tags":["..."],"beats":[{"say":"...","action":"..."}]}`
}

function validate(out, docs) {
  const problems = []
  if (!out || typeof out !== 'object') return ['not an object']
  if (!out.title || out.title.length > 70) problems.push('title missing or over 70 chars')
  if (!out.description || out.description.length > 160) problems.push('description missing or over 160 chars')
  if (!Array.isArray(out.tags) || out.tags.length < 3) problems.push('fewer than 3 tags')
  if (!Array.isArray(out.beats) || out.beats.length < 4 || out.beats.length > 6) problems.push('need 4-6 beats')
  const says = (out.beats ?? []).map((b) => normalizeNarration(b.say ?? ''))
  const words = says.join(' ').split(' ').filter(Boolean).length
  if (words < 60 || words > 95) problems.push(`${words} words of narration (want 70-85)`)
  const text = [out.title, out.description, ...says].join(' ')
  if (/[\u2013\u2014]/.test(text)) problems.push('em/en dash')
  for (const [re, label] of STYLE_TELLS) if (re.test(text)) problems.push(label)
  for (const re of RIVAL_VENDORS) if (re.test(text)) problems.push(`names a rival product (${re.source})`)
  if (!out.docsPage || !existsSync(join(ROOT, out.docsPage))) problems.push(`docsPage ${out.docsPage} does not exist`)
  else if (docs.length && !docs.some((d) => d.path === out.docsPage)) problems.push(`docsPage ${out.docsPage} is not one of the pages that embed the demo`)
  return problems
}

function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no JSON object in the reply')
  return JSON.parse(m[0])
}

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function renderScript(out, demoId) {
  const beats = out.beats.map((b) => {
    const say = normalizeNarration(b.say)
    const action = normalizeNarration(b.action ?? '')
    return [
      '    {',
      `      say: ${q(say)},`,
      `      // ${action}`,
      '      async do(page, h) {',
      `        throw new Error(${q(`TODO: ${action}`)})`,
      '      },',
      '    },',
    ].join('\n')
  })
  return [
    '/**',
    ` * Tutorial: ${out.title}. Recorded on demo ${demoId}.`,
    ' * Drafted by tools/tutorials/draft.mjs; every beat\'s `do` is a TODO until',
    ' * you script it with the `h` helpers (tools/tutorials/lib/drive.mjs).',
    ' */',
    'export default {',
    `  id: ${q(out.id)},`,
    `  title: ${q(normalizeNarration(out.title))},`,
    `  description: ${q(normalizeNarration(out.description))},`,
    `  demo: ${q(demoId)},`,
    `  docsPage: ${q(out.docsPage)},`,
    `  tags: [${out.tags.map((t) => q(normalizeNarration(t).toLowerCase())).join(', ')}],`,
    '',
    '  async setup(page, h) {',
    '    await h.gridReady(5)',
    '    await h.focusGrid()',
    '    await h.pause(600)',
    '  },',
    '',
    '  beats: [',
    ...beats,
    '  ],',
    '}',
    '',
  ].join('\n')
}

async function main() {
  if (!demoId) fail('usage: node --env-file=.env tools/tutorials/draft.mjs <demo-id> [--out <tutorial-id>] [--force] [--dry-run]')
  const registry = await parseDemoRegistry(ROOT)
  const demo = registry.find((d) => d.id === demoId)
  if (!demo) fail(`no demo "${demoId}" in website/src/lib/demos.ts`)
  const tutorialId = opt('--out', demoId.replace(/^\d+-/, ''))
  const outFile = join(SCRIPTS_DIR, `${tutorialId}.mjs`)
  if (existsSync(outFile) && !flag('--force') && !flag('--dry-run')) fail(`${outFile} exists; pass --force to overwrite`)

  const meta = await readDemoMeta(ROOT, demoId)
  const { source } = await readDemoSource(ROOT, demoId)
  const docs = loadDocs(join(ROOT, 'docs'))
    .filter(([, text]) => text.includes(`data-docs-demo="${demoId}"`))
    .map(([p, text]) => ({ path: p.replace(/\\/g, '/').replace(/^.*?(docs\/(?!.*docs\/))/, '$1'), title: (text.match(/^#\s+(.+)$/m) ?? [])[1] ?? '' }))
    .filter((d) => !d.path.includes('/recipes/'))

  const prompt = buildPrompt({ demo, meta, source: sourceExcerpt(source), docs, tutorialId })
  console.log(`drafting ${tutorialId} from ${demoId} with ${MODEL} (${docs.length} candidate docs page(s)) ...`)

  let out = null
  let problems = []
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reply = await callModel(attempt === 0 ? prompt : `${prompt}\n\nYour previous answer had these problems, fix them:\n- ${problems.join('\n- ')}`)
    try {
      out = parseJson(reply)
    } catch (err) {
      problems = [String(err.message)]
      continue
    }
    out.id = tutorialId
    problems = validate(out, docs)
    if (!problems.length) break
    console.log(`  attempt ${attempt + 1}: ${problems.join('; ')}`)
  }
  if (!out) fail('the model returned no usable JSON')
  if (problems.length) console.log(`WARNING: the draft still has issues, fix them by hand:\n  - ${problems.join('\n  - ')}`)

  const script = renderScript(out, demoId)
  if (flag('--dry-run')) {
    console.log(script)
    return
  }
  mkdirSync(SCRIPTS_DIR, { recursive: true })
  writeFileSync(outFile, script, 'utf-8')
  console.log(`wrote ${outFile}\nnext: script each beat's do(), then: pnpm tutorials ${tutorialId} --dry`)
}

main().catch((err) => fail(String(err.stack ?? err)))
