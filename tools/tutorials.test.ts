/**
 * 30-second tutorials: the pure renderers in tools/lib/tutorial-media.mjs and
 * the repo-level contract between tools/tutorials/manifest.json, the docs
 * pages that embed each tutorial, the media under website/public/tutorials/
 * and the generated indexes.
 *
 * Run: `pnpm vitest run tools/tutorials.test.ts`
 */
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  captionTime, cuesFromBeats, toSrt, toVtt, iso8601Duration, tutorialBlock, upsertBlock,
  videoObjectLd, tutorialIdsIn, normalizeNarration,
  type TutorialEntry,
} from './lib/tutorial-media.mjs'
import { readManifest } from './tutorials/lib/manifest.mjs'
import { apply as applyEmbeds } from './tutorials/embed.mjs'
import { loadDocs } from './demo-doc-coverage.mjs'

const ROOT = process.cwd()
const MP4_BUDGET = 2.5 * 1024 * 1024
const POSTER_BUDGET = 150 * 1024

const sample: TutorialEntry = {
  id: 'inline-editing',
  title: 'Inline editing in SvGrid',
  description: 'Double-click a cell, type, press Enter.',
  demo: '05-inline-editing',
  docsPage: 'docs/help/editing/overview.md',
  tags: ['inline editing'],
  duration: 31.6,
  width: 960,
  height: 540,
  recordedAt: '2026-09-12',
  youtubeId: null,
  publishedAt: null,
  files: { mp4: '/tutorials/inline-editing.mp4', poster: '/tutorials/inline-editing.poster.webp', vtt: '/tutorials/inline-editing.vtt' },
  bytes: { mp4: 1_000_000, poster: 40_000 },
  transcript: [
    { start: 1.2, end: 5.9, text: 'Double-click any cell to start editing.' },
    { start: 6.0, end: 9.4, text: 'Type a value and press Enter to commit.' },
  ],
}

describe('captions', () => {
  it('formats SRT and VTT timestamps', () => {
    expect(captionTime(1.2)).toBe('00:00:01,200')
    expect(captionTime(1.2, '.')).toBe('00:00:01.200')
    expect(captionTime(3661.005)).toBe('01:01:01,005')
  })

  it('builds non-overlapping cues from beat timings', () => {
    const cues = cuesFromBeats([
      { start: 1.0, audioDuration: 4.0, text: 'a' },
      { start: 5.1, audioDuration: 2.0, text: 'b' },
      { start: 8.0, text: '' },
      { start: 9.0, audioDuration: 1.0, text: 'c' },
    ])
    expect(cues.map((c) => c.text)).toEqual(['a', 'b', 'c'])
    expect(cues[0]!.end).toBeCloseTo(5.05, 3)
    expect(cues[1]!.end).toBeCloseTo(7.4, 3)
    expect(cues[2]!.end).toBeCloseTo(10.3, 3)
    for (let i = 1; i < cues.length; i += 1) expect(cues[i]!.start).toBeGreaterThanOrEqual(cues[i - 1]!.end)
  })

  it('writes SRT with indexes and VTT with the header', () => {
    const srt = toSrt(sample.transcript)
    expect(srt.startsWith('1\n00:00:01,200 --> 00:00:05,900\nDouble-click')).toBe(true)
    expect(srt).toContain('\n2\n00:00:06,000 --> 00:00:09,400\n')
    const vtt = toVtt(sample.transcript)
    expect(vtt.startsWith('WEBVTT\n\n1\n00:00:01.200 --> 00:00:05.900\n')).toBe(true)
  })

  it('normalizes narration to house style', () => {
    expect(normalizeNarration('one \u2014 two  \u201cthree\u201d\n')).toBe('one - two "three"')
  })
})

describe('iso8601Duration', () => {
  it('rounds seconds and splits into H/M/S', () => {
    expect(iso8601Duration(31.6)).toBe('PT32S')
    expect(iso8601Duration(90)).toBe('PT1M30S')
    expect(iso8601Duration(3661)).toBe('PT1H1M1S')
    expect(iso8601Duration(0)).toBe('PT0S')
  })
})

describe('tutorialBlock', () => {
  const block = tutorialBlock(sample)

  it('carries the video, captions, transcript and markers', () => {
    expect(block.startsWith('<!-- tutorial:inline-editing -->\n')).toBe(true)
    expect(block.endsWith('\n<!-- /tutorial:inline-editing -->')).toBe(true)
    expect(block).toContain('data-docs-tutorial="inline-editing"')
    expect(block).toContain('<track kind="captions"')
    expect(block).toContain('preload="none"')
    expect(block).not.toContain('autoplay')
    expect(block).not.toContain(' controls')
    expect(block.match(/<p>/g)?.length).toBe(2)
  })

  it('has no blank line inside, so marked keeps it one HTML block', () => {
    expect(block).not.toMatch(/\n\s*\n/)
  })

  it('escapes narration and skips the YouTube link without an id', () => {
    const t = { ...sample, title: 'A <b> & "q"', transcript: [{ start: 0, end: 1, text: '1 < 2 \u2014 ok' }] }
    const b = tutorialBlock(t)
    expect(b).toContain('A &lt;b&gt; &amp; &quot;q&quot;')
    expect(b).toContain('<p>1 &lt; 2 - ok</p>')
    expect(b).not.toContain('youtube.com')
    expect(b).not.toMatch(/[\u2013\u2014]/)
  })

  it('links the narrated YouTube copy once it has an id', () => {
    expect(tutorialBlock({ ...sample, youtubeId: 'abc123' })).toContain('https://www.youtube.com/watch?v=abc123')
  })
})

describe('upsertBlock', () => {
  const block = tutorialBlock(sample)
  const page = ['# Editing', '', 'Intro.', '', '## How it works', '', 'Body.', '', '## Frequently asked questions', '', '### Q?', '', 'A.', '', '## See also', '', '- [x](x.md)', ''].join('\n')

  it('inserts above "## See also" by default', () => {
    const { text, changed, inserted } = upsertBlock(page, sample.id, block)
    expect(changed && inserted).toBe(true)
    const i = text.indexOf('<!-- tutorial:')
    const j = text.indexOf('## See also')
    expect(i).toBeGreaterThan(text.indexOf('A.'))
    expect(i).toBeLessThan(j)
    // "See also" stays the last section, with one blank line on each side.
    expect(text).toContain('A.\n\n<!-- tutorial:inline-editing -->')
    expect(text).toContain('<!-- /tutorial:inline-editing -->\n\n## See also')
  })

  it('falls back to the FAQ heading, then to the end', () => {
    const noSeeAlso = page.replace(/\n## See also[\s\S]*$/, '\n')
    const a = upsertBlock(noSeeAlso, sample.id, block).text
    expect(a.indexOf('<!-- tutorial:')).toBeLessThan(a.indexOf('## Frequently asked questions'))
    const bare = '# Editing\n\nIntro.\n'
    const b = upsertBlock(bare, sample.id, block).text
    expect(b).toBe(`# Editing\n\nIntro.\n\n${block}\n`)
  })

  it('honours anchor and anchorAfter', () => {
    const a = upsertBlock(page, sample.id, block, { anchor: '## How it works' }).text
    expect(a.indexOf('<!-- tutorial:')).toBeLessThan(a.indexOf('## How it works'))
    const b = upsertBlock(page, sample.id, block, { anchorAfter: 'Body.' }).text
    // A blank line on each side keeps the block a separate HTML block for marked.
    expect(b).toContain('Body.\n\n<!-- tutorial:inline-editing -->')
    expect(b).toContain('<!-- /tutorial:inline-editing -->\n\n## Frequently asked questions')
  })

  it('replaces an existing block in place and is idempotent', () => {
    const once = upsertBlock(page, sample.id, block).text
    const again = upsertBlock(once, sample.id, block)
    expect(again.changed).toBe(false)
    expect(again.text).toBe(once)
    const stale = once.replace('(32 s, silent)', '(30 s, silent)')
    const fixed = upsertBlock(stale, sample.id, block)
    expect(fixed.changed).toBe(true)
    expect(fixed.inserted).toBe(false)
    expect(fixed.text).toBe(once)
    expect(fixed.text.match(/<!-- tutorial:/g)?.length).toBe(1)
  })
})

describe('videoObjectLd', () => {
  it('describes the on-page MP4 and adds embedUrl only with a YouTube id', () => {
    const ld = videoObjectLd(sample, { origin: 'https://svgrid.com', pageUrl: 'https://svgrid.com/docs/help/editing/overview/' })
    expect(ld['@type']).toBe('VideoObject')
    expect(ld.contentUrl).toBe('https://svgrid.com/tutorials/inline-editing.mp4')
    expect(ld.thumbnailUrl).toEqual(['https://svgrid.com/tutorials/inline-editing.poster.webp'])
    expect(ld.duration).toBe('PT32S')
    expect(ld.uploadDate).toBe('2026-09-12T00:00:00Z')
    expect(ld.url).toBe('https://svgrid.com/docs/help/editing/overview/#tutorial-inline-editing')
    expect(ld.transcript).toContain('Double-click any cell')
    expect(ld).not.toHaveProperty('embedUrl')
    const yt = videoObjectLd({ ...sample, youtubeId: 'abc', publishedAt: '2026-09-20' }, { origin: 'https://svgrid.com/', pageUrl: 'https://svgrid.com/docs/x/' })
    expect(yt.embedUrl).toBe('https://www.youtube.com/embed/abc')
    expect(yt.uploadDate).toBe('2026-09-20T00:00:00Z')
  })

  it('lists the tutorial ids on a page in order', () => {
    expect(tutorialIdsIn('x <figure data-docs-tutorial="b"> y <figure data-docs-tutorial="a"> <figure data-docs-tutorial="b">')).toEqual(['b', 'a'])
  })
})

describe('recorded tutorials (manifest <-> docs <-> media)', () => {
  const manifest = readManifest()
  const docs = loadDocs(join(ROOT, 'docs')).map(([p, text]) => [relative(ROOT, p).replace(/\\/g, '/'), text] as const)
  const onPages = new Map<string, string[]>()
  for (const [path, text] of docs) for (const id of tutorialIdsIn(text)) onPages.set(id, [...(onPages.get(id) ?? []), path])

  it('every embedded tutorial is in the manifest and sits on the page the manifest names', () => {
    const ids = new Set(manifest.tutorials.map((t) => t.id))
    const unknown = [...onPages.keys()].filter((id) => !ids.has(id))
    expect(unknown, 'data-docs-tutorial ids with no manifest entry').toEqual([])
    const misplaced = manifest.tutorials
      .filter((t) => t.kind !== 'marketing')
      .filter((t) => !(onPages.get(t.id) ?? []).includes(t.docsPage))
      .map((t) => `${t.id} -> ${t.docsPage} (found on: ${(onPages.get(t.id) ?? []).join(', ') || 'nowhere'})`)
    expect(misplaced, 'run node tools/tutorials/embed.mjs').toEqual([])
    const duplicated = [...onPages].filter(([, pages]) => pages.length > 1).map(([id, pages]) => `${id}: ${pages.join(', ')}`)
    expect(duplicated).toEqual([])
  })

  it('the embedded blocks match what the manifest renders', () => {
    const { stale, missing } = applyEmbeds({ check: true, manifest })
    expect(missing).toEqual([])
    expect(stale, 'run node tools/tutorials/embed.mjs').toEqual([])
  })

  it('entries are well formed and free of dashes', () => {
    const problems: string[] = []
    for (const t of manifest.tutorials) {
      if (!/^[a-z0-9-]+$/.test(t.id)) problems.push(`${t.id}: id`)
      // Feature tutorials aim at 30 s; an install walkthrough (terminal, editor,
      // result) runs longer, and a marketing cut longer still.
      const maxSeconds = t.kind === 'marketing' ? 150 : 90
      if (!(t.duration >= 15 && t.duration <= maxSeconds)) problems.push(`${t.id}: duration ${t.duration}`)
      if (!t.description || t.description.length > 160) problems.push(`${t.id}: description length`)
      if (!t.transcript.length) problems.push(`${t.id}: empty transcript`)
      const text = [t.title, t.description, ...t.transcript.map((c) => c.text)].join(' ')
      if (/[\u2013\u2014]/.test(text)) problems.push(`${t.id}: em/en dash`)
      // A stage or website recording has no gallery demo.
      if (t.demo && !existsSync(join(ROOT, 'examples', 'src', 'demos', `${t.demo}.svelte`))) problems.push(`${t.id}: demo ${t.demo} missing`)
    }
    expect(problems).toEqual([])
  })

  const hasSite = existsSync(join(ROOT, 'website', 'public'))
  it.skipIf(!hasSite)('committed media exists and stays within budget', async () => {
    const problems: string[] = []
    for (const t of manifest.tutorials) {
      if (t.kind === 'marketing') continue // YouTube only, nothing under website/public
      for (const key of ['mp4', 'poster', 'vtt'] as const) {
        const abs = join(ROOT, 'website', 'public', t.files[key].replace(/^\//, ''))
        if (!existsSync(abs)) {
          problems.push(`${t.id}: ${t.files[key]} missing`)
          continue
        }
        const size = (await stat(abs)).size
        if (key === 'mp4' && size > MP4_BUDGET) problems.push(`${t.id}: mp4 ${Math.round(size / 1024)} KB over budget`)
        if (key === 'poster' && size > POSTER_BUDGET) problems.push(`${t.id}: poster ${Math.round(size / 1024)} KB over budget`)
      }
    }
    expect(problems).toEqual([])
  })

  it.skipIf(!hasSite)('the docs index and the LLM corpus carry the tutorials', async () => {
    if (!manifest.tutorials.length) return
    const index = JSON.parse(await readFile(join(ROOT, 'website', 'src', 'lib', 'docs-index.json'), 'utf-8')) as Array<{ slug: string; tutorials?: Array<{ id: string }> }>
    const corpus = await readFile(join(ROOT, 'website', 'public', 'llms-full.txt'), 'utf-8')
    const problems: string[] = []
    for (const t of manifest.tutorials) {
      if (t.kind === 'marketing') continue
      const slug = t.docsPage.replace(/^docs\//, '').replace(/\.md$/, '')
      const page = index.find((p) => p.slug === slug)
      if (!page?.tutorials?.some((x) => x.id === t.id)) problems.push(`${t.id}: not in docs-index.json for ${slug} (run node tools/build-docs-page-index.mjs)`)
      const first = normalizeNarration(t.transcript[0]!.text)
      if (!corpus.includes(first)) problems.push(`${t.id}: transcript not in llms-full.txt (run node tools/build-docs-index.mjs)`)
    }
    expect(problems).toEqual([])
  })
})
