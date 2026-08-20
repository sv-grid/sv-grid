/**
 * Guardrails for the Studio docs so a new page can't silently fall out of the
 * sidebar or ship without cross-links.
 *
 *   - Every docs/enterprise/studio/*.md must be routed into a sidebar reading
 *     family (a STUDIO_FAMILIES `pages` array in website/src/lib/docs.ts), or
 *     sit directly under the parent (PAGE_ORDER['enterprise/studio']). A page
 *     in neither falls through to the bottom of the sidebar, unordered.
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
  it('every page is routed into a sidebar reading family', async () => {
    const slugs = (await readdir(STUDIO_DIR))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))

    const ts = await readFile(DOCS_TS, 'utf-8')

    // Scope to the STUDIO_FAMILIES literal. Collecting every `pages: [...]` in
    // the file would also pick up UI_FAMILIES, where basenames overlap
    // ('navigation' is both a studio page and a UI rollup), so an unrouted
    // studio page would read as routed.
    const families = /const STUDIO_FAMILIES[\s\S]*?\n\]/.exec(ts)
    expect(families, 'STUDIO_FAMILIES not found in docs.ts').toBeTruthy()
    const routed = new Set(
      [...families![0].matchAll(/pages:\s*\[([^\]]*)\]/g)]
        .flatMap((m) => [...m[1]!.matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]!)),
    )

    // Pages listed straight under the parent category count as routed too.
    const parent = /'enterprise\/studio':\s*\[([\s\S]*?)\]/.exec(ts)
    for (const m of parent?.[1]?.matchAll(/'([^']+)'/g) ?? []) routed.add(m[1]!)

    const missing = slugs.filter((s) => !routed.has(s))
    expect(missing, `studio pages not routed into a sidebar family: ${missing.join(', ')}`).toEqual([])
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
