/**
 * sanitize-html - a dependency-free HTML sanitizer and a small Markdown
 * renderer, sized for what a grid cell needs to display.
 *
 * A rich-text cell has to paint markup that came from a user, which is the one
 * place a data grid can hand an attacker script execution. Everything rendered
 * through `SvRichCell` goes through `sanitizeHtml` first, and the allowlist is
 * deliberately narrower than a general-purpose sanitizer: it covers the tags
 * `SvRichText` can produce, plus links and images.
 *
 * The parse uses the platform parser where there is one (`DOMParser`, which
 * neither executes scripts nor runs loaders on a detached document) and a
 * conservative regex stripper during SSR, where there is no DOM. The SSR path
 * is stricter by design: when in doubt it drops markup rather than passing it
 * through, and the hydrated client re-sanitizes with the real parser anyway.
 *
 * This is not a general-purpose sanitizer for arbitrary third-party HTML. It is
 * a narrow allowlist for cell content. To render something outside the
 * allowlist, extend it explicitly rather than widening the defaults.
 */

/** Tags that survive sanitization. Everything else is unwrapped or dropped. */
const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'i', 'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small',
  'span', 'strong', 'sub', 'sup', 'u', 'ul',
])

/** Tags whose whole subtree is removed rather than unwrapped. What sits inside
 *  a <script> or <style> is code, so keeping its text would be worse than
 *  losing it. */
const DROP_SUBTREE = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template',
  'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'link',
  'meta', 'base', 'title', 'head',
])

/** Attributes allowed per tag. `*` applies to every allowed tag. A `style`
 *  attribute is never allowed: it is the classic sanitizer hole (url(...)
 *  payloads, position tricks that let a cell cover the page chrome), and cell
 *  styling belongs to the column rather than to the data. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['class', 'dir', 'lang', 'title']),
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  ol: new Set(['start']),
}

/** URL schemes a href/src may use. Anything else, `javascript:` and
 *  `vbscript:` included, is dropped. `data:` is allowed only on an image src
 *  and only for image media types, because `data:text/html` is a script
 *  vector. */
const SAFE_URL = /^(?:https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i
const SAFE_IMG_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]*$/i

function isSafeUrl(value: string, tag: string, attr: string): boolean {
  // Strip control characters and whitespace first: "java\tscript:" and
  // "java\nscript:" are both read as javascript: by browsers.
  // Matching control characters is the whole point here, hence the disable.
  // eslint-disable-next-line no-control-regex
  const url = value.replace(/[\u0000-\u0020\u007f]/g, '')
  if (tag === 'img' && attr === 'src' && SAFE_IMG_DATA_URL.test(url)) return true
  return SAFE_URL.test(url)
}

function attrAllowed(tag: string, attr: string): boolean {
  if (attr.startsWith('on')) return false // every event handler, in one rule
  if (ALLOWED_ATTRS['*']!.has(attr)) return true
  return ALLOWED_ATTRS[tag]?.has(attr) ?? false
}

/** DOM path: walk the parsed tree and strip anything off the allowlist. */
function sanitizeWithDom(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walk = (node: Element): void => {
    // Snapshot the child list: the loop mutates it as it unwraps and removes.
    for (const child of [...node.children]) {
      const tag = child.tagName.toLowerCase()
      if (DROP_SUBTREE.has(tag)) {
        child.remove()
        continue
      }
      if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap rather than drop, so an unknown wrapper does not cost the user
        // the text inside it.
        walk(child)
        child.replaceWith(...child.childNodes)
        continue
      }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase()
        if (!attrAllowed(tag, name)) {
          child.removeAttribute(attr.name)
          continue
        }
        if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value, tag, name)) {
          child.removeAttribute(attr.name)
        }
      }
      // A link that opens a new tab gets rel="noopener", so the opened page
      // cannot reach back through window.opener.
      if (tag === 'a' && child.getAttribute('target')) {
        child.setAttribute('rel', 'noopener noreferrer')
      }
      walk(child)
    }
  }
  walk(doc.body)
  return doc.body.innerHTML
}

/**
 * SSR path: no DOM, so drop dangerous subtrees outright and keep only
 * allowlisted tags in their attribute-free form. Stricter than the DOM path on
 * purpose - the client re-sanitizes on hydration, so the cost is a moment of
 * plainer markup rather than a hole.
 */
function sanitizeWithoutDom(html: string): string {
  let out = html
  for (const tag of DROP_SUBTREE) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, 'gi'), '')
    out = out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), '')
  }
  return out.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (match, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (match.startsWith('</')) return `</${tag}>`
    return attrs.trim() ? `<${tag}>` : match
  })
}

/**
 * Return `html` with everything outside the allowlist removed. Idempotent, so
 * it is safe to call on already-sanitized markup.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  const input = String(html ?? '')
  if (!input) return ''
  if (!input.includes('<')) return input // no angle bracket, no markup to strip
  return typeof DOMParser === 'undefined' ? sanitizeWithoutDom(input) : sanitizeWithDom(input)
}

/** Escape text so it embeds in HTML as literal characters. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A sentinel that cannot occur in escaped input, used to park inline-code
 *  spans while the emphasis and link passes run over the rest. */
const MARK = '\u0000'

/** Inline Markdown. Code is extracted first so backticks protect their
 *  contents from the emphasis and link passes. */
function renderInline(text: string): string {
  const code: string[] = []
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_m, c: string) => {
    code.push(c)
    return `${MARK}${code.length - 1}${MARK}`
  })
  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return out.replace(new RegExp(`${MARK}(\\d+)${MARK}`, 'g'), (_m, i: string) => `<code>${code[Number(i)]}</code>`)
}

/**
 * Render a common Markdown subset to HTML: headings, bold, italic,
 * strikethrough, inline code, links, images, and bullet / ordered lists.
 *
 * Deliberately not a full CommonMark implementation - a grid cell shows a line
 * or two, and a complete parser is a dependency this package does not take. The
 * output is sanitized, so a Markdown link cannot smuggle `javascript:`.
 */
export function renderMarkdown(markdown: string | null | undefined): string {
  const src = String(markdown ?? '')
  if (!src) return ''
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const line of src.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1]!.length
      out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`)
    } else if (bullet || ordered) {
      const want = bullet ? 'ul' : 'ol'
      if (list !== want) {
        closeList()
        out.push(`<${want}>`)
        list = want
      }
      out.push(`<li>${renderInline((bullet ?? ordered)![1]!)}</li>`)
    } else if (!line.trim()) {
      closeList()
    } else {
      closeList()
      out.push(`<p>${renderInline(line)}</p>`)
    }
  }
  closeList()
  return sanitizeHtml(out.join(''))
}

/** Strip markup down to readable text, for exports, aria labels and tooltips
 *  where a cell's HTML has to collapse to one plain string. */
export function htmlToText(html: string | null | undefined): string {
  const clean = sanitizeHtml(html)
  if (!clean) return ''
  const spaced = clean
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
  return spaced
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
