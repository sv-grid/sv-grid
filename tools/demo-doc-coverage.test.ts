/**
 * Guards the docs <-> gallery link.
 *
 * Before this existed, 158 of 365 demos (43%) were not referenced from any doc
 * page: built, thumbnailed, shipped, and reachable only by scrolling a flat
 * gallery. The failure is silent - nothing breaks, the demo simply never gets
 * found - so it needs a test rather than review discipline.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
// @ts-expect-error - plain .mjs helper, no types
import { loadRegistry, loadDocs, coverage } from './demo-doc-coverage.mjs'

type Demo = { id: string; title: string; description: string; category: string }

describe('demo <-> docs coverage', () => {
  const registry: Demo[] = loadRegistry()
  const docs: Array<[string, string]> = loadDocs()

  it('parses the demo registry', () => {
    // A registry that silently parses to nothing would make every other
    // assertion here vacuously true.
    expect(registry.length).toBeGreaterThan(300)
    expect(registry.every((d) => d.id && d.title && d.category)).toBe(true)
  })

  it('references every gallery demo from at least one doc page', () => {
    const { orphans } = coverage(registry, docs)
    const names = orphans.map((d: Demo) => `${d.id} (${d.category})`)
    expect(
      names,
      `${names.length} demos are not referenced from any doc page. Add each to ` +
        'tools/demo-doc-placements.json and run `node tools/demo-doc-embed.mjs`.',
    ).toEqual([])
  })

  it('resolves every embedded demo id', () => {
    // A typo here renders a "Unknown demo id" card to the reader - visible, but
    // only if someone happens to open that page.
    const ids = new Set(registry.map((d) => d.id))
    const bad: string[] = []
    for (const [path, text] of docs) {
      for (const m of text.matchAll(/data-docs-demo="([^"]+)"/g)) {
        if (!ids.has(m[1])) bad.push(`${m[1]} in ${path}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('extracts a component for every {runnable} block, and no orphans', () => {
    // The manifest and the generated directory are written together; if they
    // disagree, a doc page is asking for a chunk that does not exist (blank
    // example) or Vite is compiling a file nothing references (dead weight).
    const manifestPath = join('examples', 'src', 'doc-snippets', 'manifest.json')
    if (!existsSync(manifestPath)) return // not built in this checkout

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      snippets: Array<{ id: string; doc: string; hash: string }>
    }
    const onDisk = new Set(
      readdirSync(join('examples', 'src', 'doc-snippets'))
        .filter((f) => f.endsWith('.svelte'))
        .map((f) => f.replace(/\.svelte$/, '')),
    )
    const missing = manifest.snippets.filter((s) => !onDisk.has(s.id)).map((s) => s.id)
    const extra = [...onDisk].filter((id) => !manifest.snippets.some((s) => s.id === id))
    expect(missing, 'manifest entries with no generated component').toEqual([])
    expect(extra, 'generated components not in the manifest').toEqual([])

    // The docs page finds a block by (doc slug, key), so keys must be unique
    // within a page or one example would shadow the other.
    const perDoc = new Map<string, Set<string>>()
    const collisions: string[] = []
    for (const s of manifest.snippets) {
      const keys = perDoc.get(s.doc) ?? new Set()
      if (keys.has(s.hash)) collisions.push(`${s.doc} (${s.id})`)
      keys.add(s.hash)
      perDoc.set(s.doc, keys)
    }
    expect(collisions, 'identical runnable blocks on one page').toEqual([])
  })

  it('keeps every {runnable} block in the markdown extracted', () => {
    const manifestPath = join('examples', 'src', 'doc-snippets', 'manifest.json')
    if (!existsSync(manifestPath)) return

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      snippets: Array<{ id: string }>
    }
    // Count the flags in the source of truth and compare. A drift here means
    // the generated set is stale - `node tools/build-doc-snippets.mjs`.
    const flagged = docs.reduce(
      (n, [, text]) => n + (text.match(/```svelte \{[^}]*\brunnable\b[^}]*\}/g) ?? []).length,
      0,
    )
    expect(manifest.snippets.length).toBe(flagged)
  })

  it('keeps a live example on the pages that carry them', () => {
    // Not every page should have one (generated reference, legal, brand), so
    // this asserts the floor reached rather than universal coverage.
    const embeds = docs.reduce(
      (n, [, t]) => n + (t.match(/data-docs-demo/g) ?? []).length,
      0,
    )
    const withEmbed = docs.filter(([, t]) => t.includes('data-docs-demo')).length
    expect(embeds).toBeGreaterThanOrEqual(450)
    expect(withEmbed).toBeGreaterThanOrEqual(225)
  })

  it('holds the median at three examples per doc page', () => {
    // The number this whole effort exists for. A page's examples are its demo
    // embeds plus its extracted {runnable} snippets - a flagged block that
    // stops compiling is dropped from the manifest, so this also fails when an
    // example silently rots, not only when one is deleted.
    const manifestPath = join('examples', 'src', 'doc-snippets', 'manifest.json')
    if (!existsSync(manifestPath)) return // not built in this checkout

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      snippets: Array<{ doc: string }>
    }
    const perDoc = new Map<string, number>()
    for (const s of manifest.snippets) perDoc.set(s.doc, (perDoc.get(s.doc) ?? 0) + 1)

    const counts = docs
      .map(([path, text]) => {
        const doc = path.replace(/^docs\//, '').replace(/\.md$/, '')
        // Three kinds of example count, because all three are one: an embedded
        // gallery demo, an extracted {runnable} snippet, and a
        // `data-docs-sandbox` placeholder - which opens a complete, editable
        // project in a framework of the reader's choice. Counting only the
        // first two scored the framework pages at 1 while they carry nine
        // runnable apps each, which is the opposite of what this metric is for.
        const demos = (text.match(/data-docs-demo="/g) ?? []).length
        const sandboxes = (text.match(/data-docs-sandbox="/g) ?? []).length
        return demos + sandboxes + (perDoc.get(doc) ?? 0)
      })
      .sort((a, b) => a - b)

    const median = counts[Math.floor(counts.length / 2)]
    expect(median, 'median examples per doc page').toBeGreaterThanOrEqual(3)

    const total = counts.reduce((a, b) => a + b, 0)
    expect(total / counts.length, 'mean examples per doc page').toBeGreaterThanOrEqual(2.4)
  })

  it('keeps "See also" as the last section on every page', () => {
    // It is a footer: a reader who reaches a list of links treats the page as
    // finished. Authoring passes that appended sections to the end of the file
    // buried them underneath it on 181 pages, and nothing caught it because the
    // markdown was still valid and every example still rendered - the sections
    // were simply below the fold of the reader's attention.
    const stranded: string[] = []
    for (const [path, raw] of docs) {
      const text = raw.replace(/\r\n/g, '\n')
      const m = /\n## See also\b/.exec(text)
      if (!m) continue
      const rest = text.slice(m.index + 1)
      if (/\n## (?!See also)/.test(rest)) stranded.push(path)
    }
    expect(stranded, 'pages with content below "See also"').toEqual([])
  })
})
