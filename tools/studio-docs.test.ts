/**
 * Guardrails for the Studio docs so a new page can't silently fall out of the
 * sidebar or ship without cross-links.
 *
 *   - Every docs/enterprise/studio/*.md must appear in the sidebar order
 *     (PAGE_ORDER['enterprise/studio'] in website/src/lib/docs.ts).
 *   - Every page must end with a `## See also`.
 *
 * Run: `pnpm vitest run tools/studio-docs.test.ts`
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()
const STUDIO_DIR = join(ROOT, 'docs', 'enterprise', 'studio')
const DOCS_TS = join(ROOT, 'website', 'src', 'lib', 'docs.ts')

describe('studio docs', () => {
  it('every page is in the sidebar PAGE_ORDER', async () => {
    const slugs = (await readdir(STUDIO_DIR))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))

    const ts = await readFile(DOCS_TS, 'utf-8')
    const block = /'enterprise\/studio':\s*\[([\s\S]*?)\]/.exec(ts)
    expect(block, 'PAGE_ORDER[enterprise/studio] not found in docs.ts').toBeTruthy()
    const ordered = new Set([...block![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!))

    const missing = slugs.filter((s) => !ordered.has(s))
    expect(missing, `studio pages missing from the sidebar PAGE_ORDER: ${missing.join(', ')}`).toEqual([])
  })

  it('every page has a "## See also"', async () => {
    const files = (await readdir(STUDIO_DIR)).filter((f) => f.endsWith('.md'))
    const missing: string[] = []
    for (const f of files) {
      const src = await readFile(join(STUDIO_DIR, f), 'utf-8')
      if (!/^##\s+See also\s*$/m.test(src)) missing.push(f)
    }
    expect(missing, `studio pages without a "## See also" section: ${missing.join(', ')}`).toEqual([])
  })
})
