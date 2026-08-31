/**
 * The API reference is LLM-only: in llms-full.txt, out of everything routed.
 *
 * `docs/reference/` documents the full typed surface but has no route - the
 * /api page is the human-facing one, and routing both would be duplicate
 * content. Before this split it was excluded from llms-full.txt too, so a model
 * asked "what does `tableFeatures` take" had nothing authoritative to read.
 *
 * The split only holds if it holds in BOTH directions, so this asserts both:
 * present in the LLM bundle, absent from docs.json and llms.txt (which feed the
 * router and the sitemap). A leak there would publish URLs that 404.
 *
 * Regenerate with: `node tools/build-docs-index.mjs`
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (p: string) => readFile(join(ROOT, p), 'utf8')

/** Symbols that only exist in the generated reference, not in the guides. */
const REFERENCE_ONLY = ['AISmartFillExample', 'PivotValueConfig', 'ImportRowError']

describe('LLM-only API reference', () => {
  it('ships in llms-full.txt', async () => {
    const full = await read('docs/llms-full.txt')
    expect(full).toContain('API REFERENCE - source of truth')
    for (const symbol of REFERENCE_ONLY) {
      expect(full, `${symbol} missing from llms-full.txt`).toContain(symbol)
    }
  })

  it('tells models not to cite a /docs URL for it', async () => {
    // The pages have no route, so a citation would 404. The banner says so.
    const full = await read('docs/llms-full.txt')
    expect(full).toMatch(/Not routed on the site: cite \S+\/api\/ instead/)
  })

  it('stays out of docs.json, which drives the router and the sitemap', async () => {
    const manifest = JSON.parse(await read('docs/docs.json'))
    const leaked = manifest.pages.filter((p: { path: string }) =>
      p.path.startsWith('reference/'),
    )
    expect(leaked, `Reference pages leaked into docs.json: ${JSON.stringify(leaked)}`).toEqual([])
  })

  it('stays out of llms.txt, the crawler-facing topic map', async () => {
    const topics = await read('docs/llms.txt')
    expect(topics).not.toContain('/docs/reference/')
  })

  it('keeps the served copy in sync with the source', async () => {
    // website/public is what svgrid.com actually serves; a stale copy there
    // means the fix never reaches a model.
    const [source, served] = await Promise.all([
      read('docs/llms-full.txt'),
      read('website/public/llms-full.txt'),
    ])
    expect(served).toBe(source)
  })
})
