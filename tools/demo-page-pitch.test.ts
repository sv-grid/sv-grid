/**
 * The demo page's "About this example" reads the demo's banner comment. The
 * chart demos write theirs as lists with backticked field names, and the page
 * flattened each list into one paragraph with the dashes and backticks left
 * in the text. Blocks and runs are what both renderers (the prerendered HTML
 * and the hydrated component) draw from, so the shape is pinned here and the
 * parity test in website/ checks they agree on it.
 */
import { describe, expect, it } from 'vitest'
import { pitchBlocks, pitchRuns, renderDemoAboutHtml, demoAboutModel } from './lib/demo-page.mjs'

describe('demo page pitch', () => {
  it('splits backticks into code runs', () => {
    expect(pitchRuns('`stacked` piles the channels; `stack` groups two')).toEqual([
      { code: true, text: 'stacked' },
      { code: false, text: ' piles the channels; ' },
      { code: true, text: 'stack' },
      { code: false, text: ' groups two' },
    ])
    expect(pitchRuns('no code here')).toEqual([{ code: false, text: 'no code here' }])
  })

  it('keeps a bulleted banner as a list, wrapped lines joined to their item', () => {
    const blocks = pitchBlocks('Traffic by channel, as areas:\n\n- `stacked` piles the channels;\n  `stacked100` normalises.\n- `gradient` fades each fill.\n\nFree, in @svgrid/grid.')
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'list', 'p'])
    const list = blocks[1] as { kind: 'list'; items: Array<Array<{ code: boolean; text: string }>> }
    expect(list.items).toHaveLength(2)
    expect(list.items[0]!.map((r) => r.text).join('')).toBe('stacked piles the channels; stacked100 normalises.')
  })

  it('renders the list as <ul> with <code> and nothing else changes', () => {
    const source = `<script lang="ts">\n  /**\n   * 1. Demo\n   * -------\n   * Intro.\n   *\n   * - \`a\` first\n   * - \`b\` second\n   */\n</script>`
    const model = demoAboutModel({ id: '01-x', source, meta: { description: 'Desc.', faq: [] } })
    const html = renderDemoAboutHtml(model, { href: (k, s) => `/${k}/${s}/` })
    expect(html).toContain('<p>Desc.</p><p>Intro.</p><ul><li><code>a</code> first</li><li><code>b</code> second</li></ul>')
  })
})
