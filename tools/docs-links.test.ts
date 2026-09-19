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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { movedAnchor, movedPage, resolveDocsLink } from '../website/src/lib/docs-links'
import { isReleased, RELEASES } from './lib/releases.mjs'
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

  // The generated reference tree is hidden from the docs routes, so a link
  // into it lands on the /api page (its section when the module has one)
  // rather than on GitHub's rendering of the markdown.
  it('routes the generated reference tree to the /api page', () => {
    expect(resolveDocsLink('../../reference/auto/svgrid-grid-chart.md', 'help/charts/api')).toBe('#/api/chart-api')
    expect(resolveDocsLink('../reference/auto/svgrid-grid-ai.md', 'help/ai-toolkit')).toBe('#/api/enterprise-ai')
    expect(resolveDocsLink('../../reference/auto/svgrid-grid-chart-axes.md', 'help/charts/api')).toBe('#/api')
  })

  // The charts guide was split into a hub plus pages (docs/help/charts/). Every
  // section that left the hub keeps its old anchor through doc-moves.json, so
  // a link written before the split still lands on the section.
  const MOVES = JSON.parse(readFileSync(join('docs', '_data', 'doc-moves.json'), 'utf-8')) as Record<
    string,
    Record<string, string>
  >
  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const headingSlugs = (slug: string) =>
    new Set(
      [...readFileSync(join('docs', `${slug}.md`), 'utf-8').matchAll(/^#{1,6} (.+)$/gm)].map((m) =>
        slugify(m[1]!.replace(/^(\d+)\.\s+/, '$1-')),
      ),
    )

  it('routes a moved anchor of the charts hub to the page that carries the section now', () => {
    expect(movedAnchor('help/charts', 'zoom-pan-and-presets')).toBe('#/docs/help/charts/interaction#zoom-pan-and-presets')
    expect(resolveDocsLink('../charts.md#zoom-pan-and-presets', 'help/ui-components/sv-grid-chart')).toBe(
      '#/docs/help/charts/interaction#zoom-pan-and-presets',
    )
    // An anchor that never moved, and a page with no moves, resolve as before.
    expect(resolveDocsLink('../charts.md#pages', 'help/ui-components/sv-grid-chart')).toBe('#/docs/help/charts#pages')
    expect(movedAnchor('help/columns/column-definitions', 'anything')).toBeNull()
  })

  it('every moved anchor points at a heading that exists on its target page', () => {
    const bad: string[] = []
    for (const [from, moves] of Object.entries(MOVES)) {
      // An empty anchor is the page itself moving. Its source must be gone
      // (two pages at both paths would be the worse bug) and its target must
      // be a page, not a section; the page's other anchors then map section
      // by section like any split.
      const pageMove = moves[''] !== undefined
      if (pageMove) {
        // A release's stub is the one page allowed at a moved path: it holds
        // the URL until the date, when the gate hides it and the move applies.
        const stub = Object.values(RELEASES).some((r) => (r.stubs ?? []).includes(from))
        if (!stub && existsSync(join('docs', `${from}.md`))) bad.push(`${from} is mapped as moved but still exists`)
        if (moves['']!.includes('#') || !existsSync(join('docs', `${moves['']}.md`)))
          bad.push(`${from} -> ${moves['']} is not a page`)
      }
      const own = pageMove ? new Set<string>() : headingSlugs(from)
      for (const [anchor, target] of Object.entries(moves)) {
        if (!anchor) continue
        if (own.has(anchor)) bad.push(`${from}#${anchor} still exists on the hub and is also mapped`)
        const [page, hash] = target.split('#')
        if (!hash || !headingSlugs(page!).has(hash)) bad.push(`${from}#${anchor} -> ${target} has no such heading`)
      }
    }
    expect(bad).toEqual([])
  })

  it('sends a page that moved to its new home, anchor and all', () => {
    // The Gantt guide moved out of Rows into its own section when it was
    // split into pages. A bookmark or an old link keeps working: the route,
    // a mapped section, and an anchor the map does not know.
    if (isReleased('gantt')) {
      expect(movedPage('help/rows/gantt')).toBe('#/docs/help/gantt')
      expect(movedPage('help/rows/gantt', 'baselines')).toBe('#/docs/help/gantt/critical-path#baselines')
      expect(movedPage('help/rows/gantt', 'pages')).toBe('#/docs/help/gantt#pages')
      expect(resolveDocsLink('./gantt.md#editing', 'help/rows/scheduler')).toBe('#/docs/help/gantt/editing#turning-it-on')
      expect(resolveDocsLink('../rows/gantt.md', 'help/charts/start')).toBe('#/docs/help/gantt')
    } else {
      // Until the Gantt's release date the old slug is a live stub page, so
      // the move waits and links keep landing on the stub.
      expect(movedPage('help/rows/gantt')).toBeNull()
      expect(movedPage('help/rows/gantt', 'baselines')).toBeNull()
      expect(resolveDocsLink('../rows/gantt.md', 'help/charts/start')).toBe('#/docs/help/rows/gantt')
    }
    expect(movedPage('help/rows/kanban-board')).toBeNull()
  })

  it('every anchor link into the charts hub resolves on the hub or through a move', () => {
    const own = headingSlugs('help/charts')
    const bad: string[] = []
    for (const [file, text] of loadDocs() as Array<[string, string]>) {
      for (const m of text.matchAll(/\]\([^)]*\/charts\.md#([a-z0-9-]+)\)/g)) {
        if (!own.has(m[1]!) && !MOVES['help/charts']?.[m[1]!]) bad.push(`${file} -> #${m[1]}`)
      }
    }
    expect(bad, 'links to charts.md anchors that neither exist nor moved').toEqual([])
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
