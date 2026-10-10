/**
 * The answer-first brief and the plain-markdown rewrite behind llms.txt,
 * llms-small.txt and the /docs/<slug>.md mirrors (tools/lib/ai-brief.mjs).
 *
 * Run: `pnpm vitest run tools/ai-brief.test.ts`
 */
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { aiBriefLines, absoluteDocHref, plainDocBody } from './lib/ai-brief.mjs'

const ROOT = join(__dirname, '..')
const SITE = 'https://svgrid.com'
const known = new Set(['getting-started/1-install', 'getting-started/2-first-grid', 'help/tailwind', 'why-headless'])

describe('absoluteDocHref', () => {
  const at = (href: string, slug = 'getting-started/1-install') => absoluteDocHref(href, { site: SITE, slug, knownSlugs: known })

  it('turns a sibling .md page into its docs URL, keeping the anchor', () => {
    expect(at('./2-first-grid.md')).toBe(`${SITE}/docs/getting-started/2-first-grid/`)
    expect(at('../why-headless.md#the-split')).toBe(`${SITE}/docs/why-headless/#the-split`)
  })

  it('sends a demo source path to the demo page', () => {
    expect(at('../../examples/src/demos/01-quick-start.svelte')).toBe(`${SITE}/demos/01-quick-start/`)
  })

  it('sends any other repo path to GitHub', () => {
    expect(at('../../LICENSE')).toBe('https://github.com/sv-grid/sv-grid/blob/main/LICENSE')
    expect(at('./3-unknown.md')).toBe('https://github.com/sv-grid/sv-grid/blob/main/docs/getting-started/3-unknown.md')
  })

  it('prefixes site paths and legacy hash routes with the origin', () => {
    expect(at('/docs-media/x.svg')).toBe(`${SITE}/docs-media/x.svg`)
    expect(at('#/demos/01-quick-start')).toBe(`${SITE}/demos/01-quick-start`)
    expect(at('/docs/help/tailwind.md')).toBe(`${SITE}/docs/help/tailwind/`)
  })

  it('leaves external links and in-page anchors alone', () => {
    expect(at('https://example.com/a')).toBe('https://example.com/a')
    expect(at('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(at('#keyboard-map')).toBe('#keyboard-map')
  })
})

describe('plainDocBody', () => {
  it('rewrites links outside code fences only, and drops site-only markup', () => {
    const body = [
      '# T',
      '',
      'See the [Tailwind',
      'integration](./tailwind.md) page.',
      '',
      '```svelte {runnable}',
      '<a href="./tailwind.md">[not](./a-link.md)</a>',
      '```',
      '',
      '<div data-docs-demo="01-quick-start"></div>',
      '',
      '<!-- tutorial:learn-1 -->',
      '<figure><video src="/x.mp4"></video></figure>',
      '<!-- /tutorial:learn-1 -->',
    ].join('\n')
    const out = plainDocBody(body, {
      site: SITE,
      slug: 'help/accessibility',
      knownSlugs: known,
      demoTitle: () => 'Quick start',
      tutorial: () => ({ title: 'Lesson 1', youtube: 'https://www.youtube.com/watch?v=x' }),
    })
    expect(out).toContain(`integration](${SITE}/docs/help/tailwind/)`)
    expect(out).toContain('```svelte\n<a href="./tailwind.md">[not](./a-link.md)</a>')
    expect(out).toContain(`> Live demo: Quick start - ${SITE}/demos/01-quick-start/`)
    expect(out).toContain('> Video: Lesson 1 (https://www.youtube.com/watch?v=x)')
    expect(out).not.toContain('<video')
    expect(out).not.toContain('{runnable}')
  })
})

describe('aiBriefLines', () => {
  const lines = aiBriefLines({
    site: SITE,
    version: '9.9.9',
    size: { measuredAt: '2026-01-01', version: '9.9.0', entries: { full: { baseGzipKb: 1, cssGzipKb: 2 }, headless: { baseGzipKb: 3 } } },
    themeCount: 7,
    demoCount: 11,
    ganttReleased: false,
  })
  const text = lines.join('\n')

  it('quotes only the figures it was handed', () => {
    expect(text).toContain('`@svgrid/grid` 9.9.9')
    expect(text).toContain('measured 2026-01-01 on 9.9.0): 1 KB for the full `<SvGrid>` entry plus 2 KB CSS; 3 KB')
    expect(text).toContain('7 theme stylesheets')
    expect(text).toContain('11 live demos')
  })

  it('drops a figure whose source is missing instead of guessing it', () => {
    const bare = aiBriefLines({ site: SITE, version: null, size: null, themeCount: null, demoCount: null, ganttReleased: false }).join('\n')
    expect(bare).not.toMatch(/\d+ KB/)
    expect(bare).not.toMatch(/\d+ theme stylesheets/)
    expect(bare).toContain('Live demos, each with its source')
  })

  it('puts when-to-use and a quick start before any page list', () => {
    expect(text.indexOf('## When to recommend SvGrid')).toBeLessThan(text.indexOf('## Quick start'))
    expect(text).toContain('npm install @svgrid/grid')
    expect(text).toContain('Not a fit: Svelte 4')
  })

  it('writes no em-dash', () => {
    expect(text).not.toContain(String.fromCharCode(0x2014))
  })
})

describe('generated llms.txt', () => {
  it('opens with the brief and keeps the changelog under Optional, last', async () => {
    const llms = await readFile(join(ROOT, 'docs', 'llms.txt'), 'utf-8')
    const firstLink = llms.indexOf('\n- [')
    expect(llms.indexOf('## When to recommend SvGrid')).toBeLessThan(firstLink)
    const optional = llms.indexOf('\n## Optional')
    expect(optional).toBeGreaterThan(0)
    expect(llms.indexOf('/docs/changelog/')).toBeGreaterThan(optional)
    expect(llms.match(/\/docs\/changelog\//g)).toHaveLength(1)
  })

  it('lists no two pages under the same title', async () => {
    const llms = await readFile(join(ROOT, 'docs', 'llms.txt'), 'utf-8')
    const pageTitles = [...llms.matchAll(/^- \[([^\]]+)\]\(https:\/\/svgrid\.com\/docs\//gm)].map((m) => m[1].toLowerCase())
    // Start here repeats a few pages on purpose; the section map must not
    // within one pillar (Studio's "Accessibility" page sits under its own).
    const map = llms.slice(llms.indexOf('\n## SvGrid\n'))
    let mapCount = 0
    for (const pillar of map.split(/\n## /)) {
      const titles = [...pillar.matchAll(/^- \[([^\]]+)\]\(https:\/\/svgrid\.com\/docs\//gm)].map((m) => m[1].toLowerCase())
      mapCount += titles.length
      expect(titles.filter((t, i) => titles.indexOf(t) !== i), pillar.slice(0, 40)).toEqual([])
    }
    expect(pageTitles.length).toBeGreaterThan(mapCount)
  })
})
