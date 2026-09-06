import { describe, expect, it } from 'vitest'
import { sanitizeHtml, renderMarkdown, htmlToText } from './sanitize-html'

/**
 * The sanitizer is the one part of the rich-text cell that has to be right:
 * everything else costs a rendering glitch, this costs script execution in the
 * host page. The XSS cases below are the standard vectors a cell renderer gets
 * hit with, so a regression here fails loudly.
 */
describe('sanitizeHtml - script execution vectors', () => {
  it('drops script tags and their contents', () => {
    const out = sanitizeHtml('<p>hi</p><script>alert(1)</script>')
    expect(out).toContain('hi')
    expect(out).not.toContain('script')
    expect(out).not.toContain('alert')
  })

  it('strips every inline event handler', () => {
    for (const attr of ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus']) {
      const out = sanitizeHtml(`<p ${attr}="alert(1)">x</p>`)
      expect(out, attr).not.toContain(attr)
      expect(out, attr).not.toContain('alert')
    }
  })

  it('strips a javascript: href, including obfuscated forms', () => {
    const vectors = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'vbscript:msgbox(1)',
    ]
    for (const href of vectors) {
      const out = sanitizeHtml(`<a href="${href}">x</a>`)
      expect(out.toLowerCase(), href).not.toContain('javascript:')
      expect(out.toLowerCase(), href).not.toContain('vbscript:')
      expect(out, href).not.toContain('href')
    }
  })

  it('drops an img with an onerror payload but keeps a safe one', () => {
    expect(sanitizeHtml('<img src=x onerror="alert(1)">')).not.toContain('onerror')
    const safe = sanitizeHtml('<img src="/logo.png" alt="Logo">')
    expect(safe).toContain('src="/logo.png"')
    expect(safe).toContain('alt="Logo"')
  })

  it('allows a base64 image data URL but not data:text/html', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizeHtml(`<img src="${png}">`)).toContain('src=')
    expect(sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">')).not.toContain('src=')
  })

  it('removes style attributes and style/iframe subtrees', () => {
    expect(sanitizeHtml('<p style="position:fixed;top:0">x</p>')).not.toContain('style')
    expect(sanitizeHtml('<style>body{display:none}</style><p>x</p>')).not.toContain('display')
    expect(sanitizeHtml('<iframe src="https://evil.test"></iframe>')).not.toContain('iframe')
  })

  it('unwraps unknown tags but keeps their text', () => {
    const out = sanitizeHtml('<marquee>keep me</marquee>')
    expect(out).toContain('keep me')
    expect(out).not.toContain('marquee')
  })

  it('adds rel=noopener to links that open a new tab', () => {
    const out = sanitizeHtml('<a href="https://x.test" target="_blank">x</a>')
    expect(out).toContain('rel="noopener noreferrer"')
  })
})

describe('sanitizeHtml - preserving legitimate content', () => {
  it('keeps the formatting tags SvRichText produces', () => {
    const html = '<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code></p><ul><li>one</li></ul>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('is idempotent', () => {
    const once = sanitizeHtml('<p onclick="x()">hi <b>there</b></p>')
    expect(sanitizeHtml(once)).toBe(once)
  })

  it('passes plain text through untouched and handles empty input', () => {
    expect(sanitizeHtml('just text')).toBe('just text')
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })
})

describe('renderMarkdown', () => {
  it('renders headings, emphasis, code and lists', () => {
    expect(renderMarkdown('# Title')).toBe('<h1>Title</h1>')
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>')
    expect(renderMarkdown('*it*')).toContain('<em>it</em>')
    expect(renderMarkdown('~~gone~~')).toContain('<del>gone</del>')
    expect(renderMarkdown('`code`')).toContain('<code>code</code>')
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
  })

  it('does not let emphasis leak into inline code', () => {
    expect(renderMarkdown('`**not bold**`')).toContain('<code>**not bold**</code>')
  })

  it('escapes raw HTML in the source instead of passing it through', () => {
    const out = renderMarkdown('<script>alert(1)</script>')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('will not smuggle javascript: through a Markdown link', () => {
    const out = renderMarkdown('[click](javascript:alert(1))')
    expect(out).toContain('click')
    expect(out).not.toContain('href')
  })

  it('handles empty input', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(null)).toBe('')
  })
})

describe('htmlToText', () => {
  it('flattens markup to a single readable line', () => {
    expect(htmlToText('<p>one</p><p>two</p>')).toBe('one two')
    expect(htmlToText('<ul><li>a</li><li>b</li></ul>')).toBe('a b')
    expect(htmlToText('a<br>b')).toBe('a b')
  })

  it('decodes entities and drops script content', () => {
    expect(htmlToText('<p>a &amp; b</p>')).toBe('a & b')
    expect(htmlToText('<script>alert(1)</script><p>safe</p>')).toBe('safe')
  })

  it('handles empty input', () => {
    expect(htmlToText('')).toBe('')
    expect(htmlToText(null)).toBe('')
  })
})

describe('sanitizeHtml - SSR path (no DOMParser)', () => {
  // During SSR there is no DOM, so a second, regex-based implementation runs.
  // It is stricter than the DOM path, and it must not be the weak link: the
  // server-rendered HTML reaches the browser before hydration re-sanitizes.
  const withoutDom = (html: string): string => {
    const real = globalThis.DOMParser
    // @ts-expect-error - deleting a global for the duration of the assertion
    delete globalThis.DOMParser
    try {
      return sanitizeHtml(html)
    } finally {
      globalThis.DOMParser = real
    }
  }

  it('drops scripts, styles and iframes with their contents', () => {
    expect(withoutDom('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>')
    expect(withoutDom('<style>body{x:y}</style><p>hi</p>')).toBe('<p>hi</p>')
    expect(withoutDom('<iframe src="https://evil.test"></iframe>ok')).toBe('ok')
  })

  it('strips every attribute, so no handler or URL survives', () => {
    expect(withoutDom('<p onclick="alert(1)">x</p>')).toBe('<p>x</p>')
    expect(withoutDom('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>')
    // The tag itself may stay, but with no src and no handler it is inert.
    const img = withoutDom('<img src=x onerror="alert(1)">')
    expect(img).toBe('<img>')
    expect(img).not.toContain('onerror')
    expect(img).not.toContain('src')
  })

  it('keeps plain allowlisted formatting', () => {
    expect(withoutDom('<p><strong>b</strong> <em>i</em></p>')).toBe('<p><strong>b</strong> <em>i</em></p>')
  })

  it('removes unknown tags entirely', () => {
    expect(withoutDom('<marquee>text</marquee>')).toBe('text')
  })
})
