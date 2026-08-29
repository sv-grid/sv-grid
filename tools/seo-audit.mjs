#!/usr/bin/env node
/**
 * The long-tail SEO worklist: what is still thin, untitled or unlinked.
 *
 * Every check here corresponds to a page that already exists and already gets
 * impressions, so the output is a priority list rather than a wish list. Run it
 * before and after an authoring pass to see what moved.
 *
 *   node tools/seo-audit.mjs                 # summary + the top of each list
 *   node tools/seo-audit.mjs --full          # every offender, not just a sample
 *   node tools/seo-audit.mjs --json          # machine-readable
 *   node tools/seo-audit.mjs --only demos    # one section (demos|docs|blog|solutions)
 */
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDemoRegistry, readDemoSource, readDemoMeta, EDITOR_CATEGORIES } from './lib/demo-registry.mjs'
import { isHiddenDoc, parseDocFrontmatter, docSeoTitle, sectionOf } from './lib/doc-meta.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR = join(ROOT, 'docs')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')

const args = process.argv.slice(2)
const FULL = args.includes('--full')
const JSON_OUT = args.includes('--json')
const onlyIdx = args.indexOf('--only')
const ONLY = onlyIdx !== -1 ? args[onlyIdx + 1] : null
const SAMPLE = FULL ? Infinity : 12

const DESC_MAX = 155
const PITCH_MIN_WORDS = 60
const RECIPE_MIN_WORDS = 150
const DOC_FAQ_MIN_WORDS = 400

const words = (s) => String(s).split(/\s+/).filter(Boolean).length

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

async function auditDemos() {
  const demos = await parseDemoRegistry(ROOT)
  const noSeoTitle = []
  const longBlurb = []
  const thinPitch = []
  const noMeta = []
  const byCategory = new Map()
  for (const d of demos) {
    const { pitch } = await readDemoSource(ROOT, d.id)
    const meta = await readDemoMeta(ROOT, d.id)
    const pitchWords = words(pitch)
    if (!d.seoTitle) {
      noSeoTitle.push({ id: d.id, category: d.category, title: d.title })
      byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1)
    }
    if (!d.seoDescription && !meta.description && d.blurb.length > DESC_MAX) {
      longBlurb.push({ id: d.id, chars: d.blurb.length })
    }
    if (!meta.description && pitchWords < PITCH_MIN_WORDS) {
      thinPitch.push({ id: d.id, pitchWords, category: d.category })
    }
    if (!meta.exists) noMeta.push({ id: d.id, category: d.category })
  }
  thinPitch.sort((a, b) => a.pitchWords - b.pitchWords)
  longBlurb.sort((a, b) => b.chars - a.chars)
  return {
    total: demos.length,
    uiKit: demos.filter((d) => EDITOR_CATEGORIES.has(d.category)).length,
    withSeoTitle: demos.length - noSeoTitle.length,
    noSeoTitle,
    noSeoTitleByCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    longBlurb,
    thinPitch,
    noMeta,
  }
}

async function auditDocs() {
  const noSvelteTitle = []
  const longTitle = []
  const noFaq = []
  const thinRecipes = []
  let total = 0
  let withFrontmatter = 0
  for await (const file of walk(DOCS_DIR)) {
    if (!file.endsWith('.md')) continue
    const slug = relative(DOCS_DIR, file).split(sep).join('/').replace(/\.md$/, '')
    if (isHiddenDoc(slug)) continue
    const { meta, body } = parseDocFrontmatter(await readFile(file, 'utf-8'))
    const h1 = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
    if (!h1) continue
    total += 1
    if (meta.seoTitle || meta.seoDescription || meta.keywords?.length) withFrontmatter += 1
    const section = sectionOf(slug)
    const title = meta.seoTitle ?? docSeoTitle({ slug, section, title: h1 })
    if (!/svelte/i.test(title) && !['enterprise', 'compliance', 'legal'].includes(section)) {
      noSvelteTitle.push({ slug, title })
    }
    if (title.length > 65) longTitle.push({ slug, chars: title.length })
    const bodyWords = words(body)
    if (bodyWords > DOC_FAQ_MIN_WORDS && !/^##\s+Frequently asked questions/im.test(body)) {
      noFaq.push({ slug, words: bodyWords })
    }
    if (section === 'recipes' && bodyWords < RECIPE_MIN_WORDS && !meta.noindex) {
      thinRecipes.push({ slug, words: bodyWords })
    }
  }
  noFaq.sort((a, b) => b.words - a.words)
  thinRecipes.sort((a, b) => a.words - b.words)
  return { total, withFrontmatter, noSvelteTitle, longTitle, noFaq, thinRecipes }
}

async function auditBlog() {
  if (!existsSync(BLOG_DIR)) return { total: 0, missing: true }
  const files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith('.md'))
  const noSeoTitle = []
  const noAnchors = []
  const today = new Date().toISOString().slice(0, 10)
  let published = 0
  let canonicalized = 0
  for (const f of files) {
    const raw = await readFile(join(BLOG_DIR, f), 'utf-8')
    const { meta, body } = parseDocFrontmatter(raw)
    const slug = f.replace(/\.md$/, '')
    if ((meta.date ?? '9999') <= today) published += 1
    if (meta.canonical) { canonicalized += 1; continue }
    if (!meta.seoTitle) noSeoTitle.push({ slug })
    const hasDemo = /\]\(\/demos\//.test(body)
    const hasDoc = /\]\(\/docs\//.test(body)
    if (!hasDemo || !hasDoc) noAnchors.push({ slug, demo: hasDemo, doc: hasDoc })
  }
  return { total: files.length, published, canonicalized, noSeoTitle, noAnchors }
}

async function auditSolutions() {
  const path = join(DOCS_DIR, '_data', 'solutions.json')
  if (!existsSync(path)) return { exists: false, total: 0, problems: ['docs/_data/solutions.json does not exist yet'] }
  const data = JSON.parse(await readFile(path, 'utf-8'))
  const list = Array.isArray(data.solutions) ? data.solutions : []
  const problems = []
  for (const s of list) {
    for (const id of s.demos ?? []) {
      if (!existsSync(join(ROOT, 'examples', 'src', 'demos', `${id}.svelte`))) problems.push(`${s.slug}: demo "${id}" missing`)
    }
    for (const slug of s.docs ?? []) {
      if (!existsSync(join(DOCS_DIR, `${slug}.md`))) problems.push(`${s.slug}: doc "${slug}" missing`)
    }
    for (const slug of s.posts ?? []) {
      if (existsSync(BLOG_DIR) && !existsSync(join(BLOG_DIR, `${slug}.md`))) problems.push(`${s.slug}: post "${slug}" missing`)
    }
    if (!s.faq?.length) problems.push(`${s.slug}: no FAQ (no FAQPage rich result)`)
    if ((s.seoDescription ?? '').length > DESC_MAX) problems.push(`${s.slug}: seoDescription ${s.seoDescription.length} chars`)
  }
  return { exists: true, total: list.length, problems }
}

function section(title, lines) {
  process.stdout.write(`\n${title}\n${'-'.repeat(title.length)}\n`)
  for (const l of lines) process.stdout.write(`${l}\n`)
}

function sample(list, fmt) {
  const shown = list.slice(0, SAMPLE).map(fmt)
  if (list.length > shown.length) shown.push(`  ... and ${list.length - shown.length} more (--full)`)
  return shown
}

const want = (name) => !ONLY || ONLY === name
const report = {}
if (want('demos')) report.demos = await auditDemos()
if (want('docs')) report.docs = await auditDocs()
if (want('blog')) report.blog = await auditBlog()
if (want('solutions')) report.solutions = await auditSolutions()

if (JSON_OUT) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} else {
  if (report.demos) {
    const d = report.demos
    section(`Demos (${d.total} registered, ${d.withSeoTitle} with a search title)`, [
      `Missing seoTitle: ${d.noSeoTitle.length}`,
      ...d.noSeoTitleByCategory.map(([c, n]) => `    ${String(n).padStart(3)}  ${c}`),
      '',
      `Blurb longer than ${DESC_MAX} chars and no override: ${d.longBlurb.length}`,
      ...sample(d.longBlurb, (x) => `    ${x.chars}  ${x.id}`),
      '',
      `Pitch under ${PITCH_MIN_WORDS} words and no meta description: ${d.thinPitch.length}`,
      ...sample(d.thinPitch, (x) => `    ${String(x.pitchWords).padStart(3)}w  ${x.id}  (${x.category})`),
      '',
      `No examples/src/demos/meta/<id>.json: ${d.noMeta.length}`,
    ])
  }
  if (report.docs) {
    const d = report.docs
    section(`Docs (${d.total} indexable, ${d.withFrontmatter} with SEO frontmatter)`, [
      `Computed title without "Svelte": ${d.noSvelteTitle.length}`,
      ...sample(d.noSvelteTitle, (x) => `    ${x.slug}  "${x.title}"`),
      '',
      `Title over 65 chars: ${d.longTitle.length}`,
      ...sample(d.longTitle, (x) => `    ${x.chars}  ${x.slug}`),
      '',
      `Over ${DOC_FAQ_MIN_WORDS} words with no FAQ section: ${d.noFaq.length}`,
      ...sample(d.noFaq, (x) => `    ${String(x.words).padStart(5)}w  ${x.slug}`),
      '',
      `Recipe stubs under ${RECIPE_MIN_WORDS} words (expand or noindex): ${d.thinRecipes.length}`,
      ...sample(d.thinRecipes, (x) => `    ${String(x.words).padStart(3)}w  ${x.slug}`),
    ])
  }
  if (report.blog) {
    const b = report.blog
    if (b.missing) section('Blog', ['  website submodule not checked out; skipped'])
    else section(`Blog (${b.total} posts, ${b.published} published, ${b.canonicalized} canonicalized elsewhere)`, [
      `Without seoTitle: ${b.noSeoTitle.length}`,
      '',
      `Without a demo AND doc anchor: ${b.noAnchors.length}`,
      ...sample(b.noAnchors, (x) => `    ${x.slug}  (demo: ${x.demo ? 'yes' : 'NO'}, doc: ${x.doc ? 'yes' : 'NO'})`),
    ])
  }
  if (report.solutions) {
    const s = report.solutions
    section(`Solution pages (${s.total})`, s.problems.length ? sample(s.problems, (p) => `    ${p}`) : ['    no problems'])
  }
  process.stdout.write('\n')
}
