/**
 * The embed tool's two judgement calls, each of which went wrong once.
 *
 * A page that linked to a demo's gallery URL counted as already carrying it,
 * so the placement was skipped and the page stayed without the example. And
 * a page with no "More examples" section got one appended after "See also",
 * which the coverage test requires to be the last section.
 */
import { describe, expect, it } from 'vitest'
import { embedInto, isEmbedded } from './demo-doc-embed.mjs'

const block = '### A demo\n\nWhat it shows.\n\n<div data-docs-demo="01-a" data-height="460"></div>\n'

describe('demo-doc-embed', () => {
  it('a link to the demo is not an embed', () => {
    expect(isEmbedded('See [the demo](https://svgrid.com/demos/01-a/).', '01-a')).toBe(false)
    expect(isEmbedded('Bare mention: 01-a', '01-a')).toBe(false)
    expect(isEmbedded('<div data-docs-demo="01-a" data-height="460"></div>', '01-a')).toBe(true)
    // A longer id that contains this one is a different demo.
    expect(isEmbedded('<div data-docs-demo="01-ab" data-height="460"></div>', '01-a')).toBe(false)
  })

  it('opens the section above "See also" so that stays last', () => {
    const page = '# Page\n\nBody.\n\n## See also\n\n- [x](./x.md)\n'
    const out = embedInto(page, block)
    expect(out.indexOf('## More examples')).toBeLessThan(out.indexOf('## See also'))
    expect(out.trimEnd().endsWith('- [x](./x.md)')).toBe(true)
    expect(out).toContain('data-docs-demo="01-a"')
  })

  it('extends an existing section and appends when there is no "See also"', () => {
    const existing = '# Page\n\n## More examples\n\n### Old\n\n<div data-docs-demo="00-z" data-height="460"></div>\n\n## See also\n\n- [x](./x.md)\n'
    const grown = embedInto(existing, block)
    expect(grown.match(/## More examples/g)).toHaveLength(1)
    expect(grown.indexOf('01-a')).toBeLessThan(grown.indexOf('00-z'))
    const bare = embedInto('# Page\n\nBody.\n', block)
    expect(bare.trimEnd().endsWith('data-height="460"></div>')).toBe(true)
  })
})
