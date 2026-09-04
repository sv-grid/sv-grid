/**
 * Guards the docs link resolver.
 *
 * Docs are authored from inside the repo, so they link to a demo by its SOURCE
 * path - `../../examples/src/demos/02-sort-filter-paginate.svelte`. That is
 * correct in a checkout and dead on the website, where the demo lives at its
 * gallery route. Before the resolver handled it, 70 links across the docs
 * rendered as plain text that went nowhere.
 *
 * The corpus assertion is the important half: it fails when someone adds a
 * link to a demo that does not exist, which the resolver cannot rescue.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { resolveDocsLink } from '../website/src/lib/docs-links'
// @ts-expect-error - plain .mjs helper, no types
import { loadDocs } from './demo-doc-coverage.mjs'

const DEMO_IDS = new Set(
  readdirSync(join('examples', 'src', 'demos'))
    .filter((f) => f.endsWith('.svelte'))
    .map((f) => f.replace(/\.svelte$/, '')),
)

describe('docs link resolver', () => {
  it('routes a demo source path to its gallery route', () => {
    expect(
      resolveDocsLink(
        '../../../examples/src/demos/02-sort-filter-paginate.svelte',
        'help/columns/column-definitions',
      ),
    ).toBe('#/demos/02-sort-filter-paginate')

    // Depth of the relative prefix must not matter.
    expect(
      resolveDocsLink('../../examples/src/demos/01-quick-start.svelte', 'getting-started/2-first-grid'),
    ).toBe('#/demos/01-quick-start')
  })

  it('keeps a fragment on the demo route', () => {
    expect(
      resolveDocsLink('../../examples/src/demos/06-large-dataset.svelte#setup', 'help/x'),
    ).toBe('#/demos/06-large-dataset#setup')
  })

  it('still resolves markdown and external links', () => {
    expect(resolveDocsLink('https://example.com/x', 'help/x')).toBe('https://example.com/x')
    expect(resolveDocsLink('#anchor', 'help/x')).toBe('#/docs/help/x#anchor')
  })

  it('links only to demos that exist', () => {
    const bad: string[] = []
    for (const [file, text] of loadDocs() as Array<[string, string]>) {
      for (const m of text.matchAll(
        /\]\((?:\.\.?\/)[^)]*examples\/src\/demos\/([A-Za-z0-9._-]+)\.svelte[^)]*\)/g,
      )) {
        if (!DEMO_IDS.has(m[1])) bad.push(`${file} -> ${m[1]}`)
      }
    }
    expect(bad, 'docs linking to a demo source file that does not exist').toEqual([])
  })
})
