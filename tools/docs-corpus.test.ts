/**
 * The docs search fetches website/public/llms-full.txt on first use and
 * splits it back into page bodies with tools/lib/docs-corpus.mjs. Both the
 * writer (tools/build-docs-index.mjs) and the reader are ours, so this pins
 * the contract between them against the generated file: every routed page
 * in docs-index.json comes back with its body, nothing bleeds across the
 * separators, and the unrouted API reference tail is not mistaken for a page.
 *
 * Run: `pnpm vitest run tools/docs-corpus.test.ts`
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseDocsCorpus } from './lib/docs-corpus.mjs'

const ROOT = process.cwd()

describe('docs corpus (llms-full.txt) round-trips every routed page', () => {
  it('recovers each page of docs-index.json with a clean body', async () => {
    const text = await readFile(join(ROOT, 'website', 'public', 'llms-full.txt'), 'utf-8')
    const index = JSON.parse(await readFile(join(ROOT, 'website', 'src', 'lib', 'docs-index.json'), 'utf-8')) as Array<{ slug: string; title: string }>
    const corpus = parseDocsCorpus(text)
    expect(index.length).toBeGreaterThan(300)
    const missing = index.filter((p) => !corpus.has(p.slug)).map((p) => p.slug)
    expect(missing).toEqual([])
    const extra = [...corpus.keys()].filter((s) => !index.some((p) => p.slug === s))
    expect(extra).toEqual([])
    const problems: string[] = []
    for (const p of index) {
      const body = corpus.get(p.slug) ?? ''
      if (body.length < 40) problems.push(`${p.slug}: body ${body.length} chars`)
      if (body.includes('<!-- =')) problems.push(`${p.slug}: separator leaked into body`)
      if (!body.includes(p.title.split(' ')[0]!)) problems.push(`${p.slug}: title word "${p.title.split(' ')[0]}" not in body`)
    }
    expect(problems).toEqual([])
  })

  it('ignores blocks whose header is not a /docs/ URL', () => {
    const sample = [
      '# heading', '',
      '<!-- =================================================================',
      '     /docs/a/  (community)',
      '     ================================================================== -->', '',
      '# A', 'Body of a.', '',
      '<!-- =================================================================',
      '     API REFERENCE - source of truth.',
      '     Not routed on the site.',
      '     ================================================================== -->', '',
      '<!-- docs/api/x.md  (unrouted) -->', '', '# X', 'Unrouted.', '',
    ].join('\n')
    const corpus = parseDocsCorpus(sample)
    expect([...corpus.keys()]).toEqual(['a'])
    expect(corpus.get('a')).toBe('# A\nBody of a.')
  })
})
