/**
 * The chart gallery's code cards are the demos they sit beside.
 *
 * `tools/gallery-doc-code.mjs` writes each `data-code` host's fenced block
 * from the demo file, so the Code tab of a card can only drift from its
 * Preview when the script was not rerun after a demo edit. That is the one
 * failure, and this catches it. The second check is the contract the site's
 * `fuseDemoCode()` needs: a code host's block must be the very next thing on
 * the page, or the card renders with no Code tab and no error.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GALLERY, ROOT, galleryCodeFor, withGalleryCode } from './gallery-doc-code.mjs'

const page = readFileSync(join(ROOT, GALLERY), 'utf8')
const hosts = [...page.matchAll(/^<div data-docs-demo="([^"]+)"[^>]*\bdata-code\b[^>]*><\/div>\r?\n/gm)]

describe('chart gallery code cards', () => {
  it('every card carries the code of the demo it previews', () => {
    expect(hosts.length).toBeGreaterThanOrEqual(14)
    expect(withGalleryCode(page)).toBe(page)
  })

  it('a code host is followed by its fenced block, with nothing between', () => {
    for (const m of hosts) {
      const after = page.slice(m.index! + m[0].length)
      expect(after.replace(/^\r?\n/, ''), m[1]).toMatch(/^```svelte\r?\n<script lang="ts">/)
    }
  })

  it('the derived code is the demo without its banner, blurb and styles', () => {
    const code = galleryCodeFor('438-chart-bar')
    expect(code).toContain("import { SvChart, type ChartSpec } from '@svgrid/grid'")
    expect(code).toContain('<SvChart spec={revenue} legend="bottom" selectable autosize />')
    expect(code).not.toContain('438. Bar charts')
    expect(code).not.toContain('class="note"')
    expect(code).not.toContain('<style>')
  })
})
