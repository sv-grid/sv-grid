/**
 * tools/minify-dist.mjs minifies the published @svgrid/enterprise dist. A
 * .svelte script cannot see its template, so the TS loader took every
 * component the template uses for an unused import and dropped it:
 * enterprise 3.1.35 shipped SvBase.svelte importing none of its children,
 * and every base threw "BaseTabs is not defined". Nothing ran the minified
 * dist (the gallery and the tests read the source), so this checks the
 * minifier itself.
 */
import { describe, expect, it } from 'vitest'
import { componentImports, minifySvelte } from './minify-dist.mjs'

const COMPONENT = `<script lang="ts">
  import { untrack } from 'svelte'
  import type { Snippet } from 'svelte'
  import Child from './Child.svelte'
  import Other from './Other.svelte'
  // Child is read as a type in the script, Other not at all.
  let ref = $state<Child | null>(null)
  let { label, extra }: { label: string; extra?: Snippet } = $props()
  const upper = $derived(untrack(() => label.toUpperCase()))
</script>

<!-- a comment that goes -->
<Child bind:this={ref} text={upper} />
<Other />
{@render extra?.()}

<style>
  .x { color: red; }
</style>
`

describe('minify-dist on a .svelte component', () => {
  it('keeps the components the template uses', async () => {
    const out = await minifySvelte(COMPONENT)
    expect(componentImports(out).sort()).toEqual(['Child', 'Other'])
    expect(out).toContain('<Child bind:this={ref} text={upper} />')
  })

  it('still drops type-only imports, types and comments', async () => {
    const out = await minifySvelte(COMPONENT)
    expect(out).not.toMatch(/import type|Snippet/)
    expect(out).not.toContain('a comment that goes')
    expect(out).not.toContain('Child | null')
    expect(out).toMatch(/import\s*\{\s*untrack\s*\}\s*from\s*"svelte"/)
  })

  it('counts value imports of components, not type-only ones', () => {
    // The guard in minifySvelte compares these before and after.
    expect(componentImports(`import A from './A.svelte'\nimport type B from './B.svelte'\nimport C from"./C.svelte"`)).toEqual(['A', 'C'])
  })
})
