/**
 * The docs search fetches website/public/llms-full.txt on first use and
 * splits it back into page bodies with tools/lib/docs-corpus.mjs. Both the
 * writer (tools/build-docs-index.mjs) and the reader are ours, so this pins
 * the contract between them against the generated file: every routed page
 * in docs-index.json comes back with its body, every comparison page comes
 * back under its `compare/<slug>` key, nothing bleeds across the separators,
 * and the unrouted API reference tail is not mistaken for a page.
 *
 * Run: `pnpm vitest run tools/docs-corpus.test.ts`
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseDocsCorpus, corpusSlug } from './lib/docs-corpus.mjs'
import { loadComparisons } from './lib/compare-data.mjs'

const ROOT = process.cwd()

describe('docs corpus (llms-full.txt) round-trips every routed page', () => {
  it('recovers each page of docs-index.json and each comparison with a clean body', async () => {
    const text = await readFile(join(ROOT, 'website', 'public', 'llms-full.txt'), 'utf-8')
    const index = JSON.parse(await readFile(join(ROOT, 'website', 'src', 'lib', 'docs-index.json'), 'utf-8')) as Array<{ slug: string; title: string }>
    const comparisons = await loadComparisons()
    const corpus = parseDocsCorpus(text)
    expect(index.length).toBeGreaterThan(300)
    expect(comparisons.length).toBeGreaterThan(10)
    const expected = [
      ...index.map((p) => ({ slug: p.slug, title: p.title, min: 40 })),
      ...comparisons.map((c) => ({ slug: `compare/${c.slug}`, title: `SvGrid vs ${c.competitor}`, min: 200 })),
    ]
    const missing = expected.filter((p) => !corpus.has(p.slug)).map((p) => p.slug)
    expect(missing).toEqual([])
    const extra = [...corpus.keys()].filter((s) => !expected.some((p) => p.slug === s))
    expect(extra).toEqual([])
    const problems: string[] = []
    for (const p of expected) {
      const body = corpus.get(p.slug) ?? ''
      if (body.length < p.min) problems.push(`${p.slug}: body ${body.length} chars`)
      if (body.includes('<!-- =')) problems.push(`${p.slug}: separator leaked into body`)
      if (!body.includes(p.title.split(' ')[0]!)) problems.push(`${p.slug}: title word "${p.title.split(' ')[0]}" not in body`)
    }
    expect(problems).toEqual([])
  })

  it('keys /docs/ and /compare/ blocks and ignores the rest', () => {
    expect(corpusSlug('/docs/help/sorting/')).toBe('help/sorting')
    expect(corpusSlug('/compare/ag-grid/')).toBe('compare/ag-grid')
    expect(corpusSlug('/compare/ag-grid/extra/')).toBeNull()
    expect(corpusSlug('API')).toBeNull()
    const sample = [
      '# heading', '',
      '<!-- =================================================================',
      '     /docs/a/  (community)',
      '     ================================================================== -->', '',
      '# A', 'Body of a.', '',
      '<!-- =================================================================',
      '     /compare/x/  (community)',
      '     ================================================================== -->', '',
      '# SvGrid vs X', 'Body of x.', '',
      '<!-- =================================================================',
      '     API REFERENCE - source of truth.',
      '     Not routed on the site.',
      '     ================================================================== -->', '',
      '<!-- docs/api/x.md  (unrouted) -->', '', '# X', 'Unrouted.', '',
    ].join('\n')
    const corpus = parseDocsCorpus(sample)
    expect([...corpus.keys()]).toEqual(['a', 'compare/x'])
    expect(corpus.get('a')).toBe('# A\nBody of a.')
    expect(corpus.get('compare/x')).toBe('# SvGrid vs X\nBody of x.')
  })
})
