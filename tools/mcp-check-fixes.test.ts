/**
 * svgrid_check_code on the two mistakes models make most: a Svelte 4 prop and
 * an import from a look-alike package. Found by the post-publish suite against
 * @svgrid/mcp 3.0.23: the tool promises a corrected copy "whenever the
 * correction is exact", but returned none for `svelte-grid`, and it put the
 * `export let` diagnostic on the wrong line.
 *
 * Runs against the built server (`pnpm --filter @svgrid/mcp build`), like
 * tools/mcp-tools.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const load = async () => {
  const validate = await import(join(ROOT, 'packages/mcp/dist/validate.js') as string)
  const { apiSurface } = await import(join(ROOT, 'packages/mcp/dist/data.js') as string)
  return { ...validate, apiSurface }
}
const ruleOf = (ds: Array<{ rule: string }>, rule: string) => ds.find((d) => d.rule === rule) as
  | { rule: string; line: number; fix?: string; rename?: { from: string; to: string } }
  | undefined

describe('svgrid_check_code fixes what it can fix exactly', () => {
  const svelte4 = [
    '<script lang="ts">',
    "  import { SvGrid } from 'svelte-grid'",
    '',
    '  export let rows',
    '</script>',
    '',
    '<SvGrid data={rows} columns={[]} />',
  ].join('\n')

  it('puts `export let` on its own line and names the prop in the fix', async () => {
    const { checkStatic, apiSurface } = await load()
    const d = ruleOf(checkStatic(svelte4, apiSurface, 'Grid.svelte'), 'svelte/legacy-export-let')
    expect(d?.line).toBe(4)
    expect(d?.fix).toBe('let { rows } = $props()')
  }, 30_000)

  it('rewrites a look-alike package to @svgrid/grid when every name is SvGrid', async () => {
    const { checkStatic, applyFixes, apiSurface } = await load()
    const diagnostics = checkStatic(svelte4, apiSurface, 'Grid.svelte')
    expect(ruleOf(diagnostics, 'svgrid/lookalike-package')?.rename).toEqual({ from: 'svelte-grid', to: '@svgrid/grid' })
    const { fixed, applied } = applyFixes(svelte4, diagnostics)
    expect(fixed).toContain("import { SvGrid } from '@svgrid/grid'")
    expect(applied).toContain('svelte-grid -> @svgrid/grid (line 2)')
  }, 30_000)

  it('finds the specifier of a multi-line import', async () => {
    const { checkStatic, applyFixes, apiSurface } = await load()
    const src = ['<script>', '  import {', '    SvGrid,', "  } from '@sv-grid/core'", '</script>', '<SvGrid data={[]} columns={[]} />'].join('\n')
    const diagnostics = checkStatic(src, apiSurface, 'Grid.svelte')
    expect(ruleOf(diagnostics, 'svgrid/lookalike-package')?.line).toBe(4)
    expect(applyFixes(src, diagnostics).fixed).toContain("} from '@svgrid/grid'")
  }, 30_000)

  it('leaves a mixed import alone: the other names belong to that package', async () => {
    const { checkStatic, applyFixes, apiSurface } = await load()
    const src = ['<script>', "  import { SvGrid, somethingElse } from 'svelte-grid'", '</script>', '<SvGrid data={[]} columns={[]} />'].join('\n')
    const diagnostics = checkStatic(src, apiSurface, 'Grid.svelte')
    const d = ruleOf(diagnostics, 'svgrid/lookalike-package')
    expect(d?.fix).toContain("from '@svgrid/grid'")
    expect(d?.rename).toBeUndefined()
    expect(applyFixes(src, diagnostics).fixed).toContain("from 'svelte-grid'")
  }, 30_000)
})
