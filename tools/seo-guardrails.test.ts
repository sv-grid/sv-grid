/**
 * Guardrails for the long-tail SEO surfaces, so a queue entry, a demo meta
 * file or a title template cannot regress silently:
 *
 *   - tools/blog-topics.json validates (slugs unique, demos/docs/api exist).
 *   - examples/src/demos/meta/*.json parse, match a demo, and carry no dashes.
 *   - The default doc title template puts "Svelte" into every indexable doc
 *     title (enterprise / compliance / legal excepted) and keeps it short.
 *   - clampDescription never exceeds its budget.
 *   - When website/dist exists (after a site build): every meta description is
 *     at most 160 characters and no demo page links to itself.
 *
 * Run: `pnpm vitest run tools/seo-guardrails.test.ts`
 */
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, it, expect } from 'vitest'
import { loadTopics } from './lib/blog-topics.mjs'
import { docSeoTitle, isHiddenDoc, parseDocFrontmatter, sectionOf } from './lib/doc-meta.mjs'
import { clampDescription } from './lib/seo-text.mjs'
import { ROUTE_SEO, prerenderedRoutes } from './lib/route-seo.mjs'

const ROOT = process.cwd()
const DOCS_DIR = join(ROOT, 'docs')
const DEMOS_DIR = join(ROOT, 'examples', 'src', 'demos')
const META_DIR = join(DEMOS_DIR, 'meta')
const DIST = join(ROOT, 'website', 'dist')
const DASH = /[—–]/
// A vite-only dist already carries sitemap.xml (Vite copies it from public/),
// so gating on that file let these guardrails pass without the prerender ever
// having run. Gate on a page only the prerenderer writes.
const hasPrerenderedDist = existsSync(join(DIST, 'about', 'index.html'))
const TITLE_EXEMPT = new Set(['enterprise', 'compliance', 'legal'])

/** Attribute text as a reader sees it: `&lt;SvGrid&gt;` is 8 characters, not 12. */
function unescapeAttr(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

describe('blog topic queue', () => {
  it('validates against the demos, docs and API that exist', () => {
    const { topics, problems } = loadTopics(ROOT)
    expect(problems).toEqual([])
    expect(topics.length).toBeGreaterThan(0)
  })
})

describe('demo meta files', () => {
  it('parse, belong to a demo, and use plain hyphens', async () => {
    if (!existsSync(META_DIR)) return
    for (const f of (await readdir(META_DIR)).filter((n) => n.endsWith('.json'))) {
      const raw = await readFile(join(META_DIR, f), 'utf-8')
      expect(raw, `${f} contains an em/en dash`).not.toMatch(DASH)
      const id = f.replace(/\.json$/, '')
      expect(existsSync(join(DEMOS_DIR, `${id}.svelte`)), `${f} has no matching demo`).toBe(true)
      const meta = JSON.parse(raw)
      if (meta.description !== undefined) expect(typeof meta.description).toBe('string')
      for (const k of meta.keywords ?? []) expect(typeof k).toBe('string')
      for (const q of meta.faq ?? []) {
        expect(typeof q.question, `${f}: faq question`).toBe('string')
        expect(typeof q.answer, `${f}: faq answer`).toBe('string')
      }
    }
  })
})

describe('doc titles', () => {
  it('carry the head term and fit a search result', async () => {
    const offenders: string[] = []
    for await (const file of walk(DOCS_DIR)) {
      if (!file.endsWith('.md')) continue
      const slug = relative(DOCS_DIR, file).split(sep).join('/').replace(/\.md$/, '')
      if (isHiddenDoc(slug)) continue
      const { meta, body } = parseDocFrontmatter(await readFile(file, 'utf-8'))
      const h1 = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
      if (!h1) continue
      const section = sectionOf(slug)
      const title = meta.seoTitle ?? docSeoTitle({ slug, section, title: h1 })
      if (DASH.test(title)) offenders.push(`${slug}: dash in title`)
      if (title.length > 70) offenders.push(`${slug}: ${title.length} chars "${title}"`)
      // Long H1s fall back to shorter forms that may drop the head term; those
      // pages get a hand-written seoTitle instead (tracked by tools/seo-audit).
      if (!TITLE_EXEMPT.has(section) && h1.length <= 45 && !/svelte/i.test(title)) {
        offenders.push(`${slug}: no "Svelte" in "${title}"`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('solution pages', () => {
  it('reference demos, docs and posts that exist, and carry search copy', async () => {
    const path = join(ROOT, 'docs', '_data', 'solutions.json')
    if (!existsSync(path)) return
    const raw = await readFile(path, 'utf-8')
    expect(raw, 'solutions.json contains an em/en dash').not.toMatch(DASH)
    const list = JSON.parse(raw).solutions as Array<Record<string, never>> & Array<{
      slug: string; query: string; h1: string; seoTitle: string; seoDescription: string
      tier: string; demos: string[]; docs: string[]; posts: string[]
      faq: { question: string; answer: string }[]; related: string[]; heroDemo?: string
    }>
    const problems: string[] = []
    const slugs = new Set(list.map((s) => s.slug))
    const blogDir = join(ROOT, 'website', 'src', 'content', 'blog')
    const hasBlog = existsSync(blogDir)
    for (const s of list) {
      const at = `solutions/${s.slug}`
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s.slug)) problems.push(`${at}: bad slug`)
      if (!s.query) problems.push(`${at}: no query`)
      if (!s.h1) problems.push(`${at}: no h1`)
      if (!s.seoTitle || s.seoTitle.length > 65) problems.push(`${at}: seoTitle missing or over 65 chars`)
      if (!s.seoDescription || s.seoDescription.length > 160) problems.push(`${at}: seoDescription missing or over 160 chars`)
      if (!['community', 'enterprise'].includes(s.tier)) problems.push(`${at}: tier must be community or enterprise`)
      const extra = s as unknown as { kind: string; icon: string; cardText: string }
      if (!['view', 'feature', 'component'].includes(extra.kind)) {
        problems.push(`${at}: kind must be view, feature or component`)
      }
      // The docs-landing card needs a glyph and a line short enough to read as
      // a card; the seoDescription is search copy and far too long for one.
      if (!extra.icon || [...extra.icon].length !== 1) problems.push(`${at}: icon must be a single glyph`)
      if (!extra.cardText || extra.cardText.length > 60) problems.push(`${at}: cardText missing or over 60 chars`)
      if (!s.faq?.length) problems.push(`${at}: no FAQ`)
      for (const id of [...(s.demos ?? []), ...(s.heroDemo ? [s.heroDemo] : [])]) {
        if (!existsSync(join(ROOT, 'examples', 'src', 'demos', `${id}.svelte`))) problems.push(`${at}: demo "${id}" does not exist`)
      }
      for (const slug of s.docs ?? []) {
        if (!existsSync(join(ROOT, 'docs', `${slug}.md`))) problems.push(`${at}: doc "${slug}" does not exist`)
      }
      if (hasBlog) {
        for (const slug of s.posts ?? []) {
          if (!existsSync(join(blogDir, `${slug}.md`))) problems.push(`${at}: post "${slug}" does not exist`)
        }
      }
      for (const r of s.related ?? []) {
        if (!slugs.has(r)) problems.push(`${at}: related "${r}" is not a solution`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe('docs-landing component links', () => {
  it('point at UI component docs that exist', async () => {
    const src = await readFile(join(ROOT, 'website', 'src', 'lib', 'solutions.ts'), 'utf-8').catch(() => '')
    if (!src) return
    const slugs = [...src.matchAll(/slug:\s*'(help\/ui-components\/[a-z0-9-]+)'/g)].map((m) => m[1])
    expect(slugs.length).toBeGreaterThan(20)
    const missing = slugs.filter((s) => !existsSync(join(ROOT, 'docs', `${s}.md`)))
    expect(missing).toEqual([])
  })
})

describe('clampDescription', () => {
  it('keeps short text and clamps long text on a sentence or word boundary', () => {
    expect(clampDescription('Short and sweet.')).toBe('Short and sweet.')
    const long = 'A first sentence that is long enough to matter for the cut. ' +
      'A second sentence that pushes the whole thing well past the budget for a snippet on a result page.'
    const out = clampDescription(long)
    expect(out.length).toBeLessThanOrEqual(155)
    expect(out.endsWith('.') || out.endsWith('...')).toBe(true)
    expect(clampDescription('word '.repeat(60)).length).toBeLessThanOrEqual(155)
  })
})

describe('prerendered output', () => {
  it.skipIf(!hasPrerenderedDist)('keeps every meta description under 160 chars and no demo self-link', async () => {
    const offenders: string[] = []
    for await (const file of walk(DIST)) {
      if (!file.endsWith('index.html')) continue
      const html = await readFile(file, 'utf-8')
      const m = html.match(/<meta name="description" content="([^"]*)"/)
      const len = m ? unescapeAttr(m[1]).length : 0
      if (len > 160) offenders.push(`${relative(DIST, file)}: description ${len} chars`)
      const rel = relative(DIST, file).split(sep).join('/')
      const demo = rel.match(/^demos\/([^/]+)\/index\.html$/)
      if (demo && html.includes(`href="/demos/${demo[1]}/"`)) offenders.push(`${rel}: links to itself`)
    }
    expect(offenders).toEqual([])
  })
})

describe('static route SEO table', () => {
  it('gives every prerendered route its own entry and a matching path', () => {
    const problems: string[] = []
    for (const [section] of prerenderedRoutes()) {
      const entry = ROUTE_SEO[section]
      // A missing entry is the /studio/ bug: getRouteSeo falls back to the
      // homepage, so hydrating the page rewrites its canonical to "/" and asks
      // Google to drop it. A wrong path does the same thing more quietly.
      if (!entry) problems.push(`${section}: prerendered but absent from ROUTE_SEO`)
      else if (entry.path !== `/${section}`) problems.push(`${section}: path is ${entry.path}`)
    }
    expect(problems).toEqual([])
  })

  it('keeps titles free of dashes that the house style forbids', () => {
    const offenders = Object.entries(ROUTE_SEO)
      .filter(([, r]) => DASH.test(r.title) || DASH.test(r.description))
      .map(([section]) => section)
    expect(offenders).toEqual([])
  })
})

describe('prerendered head matches the shared table', () => {
  it.skipIf(!hasPrerenderedDist)('serves each static route its own title and self canonical', async () => {
    const problems: string[] = []
    for (const [section, title] of prerenderedRoutes()) {
      const file = join(DIST, section, 'index.html')
      if (!existsSync(file)) {
        problems.push(`${section}: no index.html written`)
        continue
      }
      const html = await readFile(file, 'utf-8')
      const gotTitle = unescapeAttr(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '')
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] ?? ''
      if (gotTitle !== title) problems.push(`${section}: title is "${gotTitle}"`)
      if (canonical !== `https://svgrid.com/${section}/`) problems.push(`${section}: canonical is "${canonical}"`)
    }
    expect(problems).toEqual([])
  })

  it.skipIf(!hasPrerenderedDist)('gives every blog collection a static BreadcrumbList', async () => {
    const missing: string[] = []
    for (const kind of ['tag', 'category']) {
      const dir = join(DIST, 'blog', kind)
      if (!existsSync(dir)) continue
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const html = await readFile(join(dir, entry.name, 'index.html'), 'utf-8')
        // Client-side only markup is invisible unless Google runs the render
        // pass, which is what dropped these out of the breadcrumbs report.
        if (!html.includes('"BreadcrumbList"')) missing.push(`blog/${kind}/${entry.name}`)
      }
    }
    expect(missing).toEqual([])
  })
})
