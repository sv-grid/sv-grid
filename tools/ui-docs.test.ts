/**
 * Guardrails for the SvGrid UI component docs so a new per-component tutorial
 * can't silently fall out of the sidebar or ship without the standard sections.
 *
 *   - Every docs/help/ui-components/sv-*.md must be routed into a UI family in
 *     the sidebar (a UI_FAMILIES `pages` array in website/src/lib/docs.ts), so
 *     it lands under the SvGrid UI pillar rather than the "Other" fallthrough.
 *   - Every per-component page must have a `## Props` and a `## See also`.
 *   - No page may contain an em-dash glyph (repo-wide house rule).
 *
 * Run: `pnpm vitest run tools/ui-docs.test.ts`
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()
const UI_DIR = join(ROOT, 'docs', 'help', 'ui-components')
const DOCS_TS = join(ROOT, 'website', 'src', 'lib', 'docs.ts')

async function componentPages(): Promise<string[]> {
  // Per-component tutorials are the `sv-*.md` files; the rollups (buttons.md,
  // inputs.md, ...) and index.md are overview pages with a looser structure.
  return (await readdir(UI_DIR)).filter((f) => f.startsWith('sv-') && f.endsWith('.md'))
}

describe('SvGrid UI component docs', () => {
  it('every component page is routed into a sidebar UI family', async () => {
    const slugs = (await componentPages()).map((f) => f.replace(/\.md$/, ''))
    const ts = await readFile(DOCS_TS, 'utf-8')
    // Collect every basename listed in a UI_FAMILIES `pages: [...]` array.
    const routed = new Set(
      [...ts.matchAll(/pages:\s*\[([^\]]*)\]/g)]
        .flatMap((m) => [...m[1]!.matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]!)),
    )
    const missing = slugs.filter((s) => !routed.has(s))
    expect(missing, `UI component pages not routed into a UI family in docs.ts: ${missing.join(', ')}`).toEqual([])
  })

  it('every component page has "## Props" and "## See also"', async () => {
    const files = await componentPages()
    const noProps: string[] = []
    const noSeeAlso: string[] = []
    for (const f of files) {
      const src = await readFile(join(UI_DIR, f), 'utf-8')
      if (!/^##\s+Props\s*$/m.test(src)) noProps.push(f)
      if (!/^##\s+See also\s*$/m.test(src)) noSeeAlso.push(f)
    }
    expect(noProps, `component pages without a "## Props" section: ${noProps.join(', ')}`).toEqual([])
    expect(noSeeAlso, `component pages without a "## See also" section: ${noSeeAlso.join(', ')}`).toEqual([])
  })

  it('no component page uses an em-dash glyph', async () => {
    const files = await componentPages()
    const offenders: string[] = []
    for (const f of files) {
      const src = await readFile(join(UI_DIR, f), 'utf-8')
      if (src.includes('—')) offenders.push(f)
    }
    expect(offenders, `component pages containing an em-dash: ${offenders.join(', ')}`).toEqual([])
  })
})
