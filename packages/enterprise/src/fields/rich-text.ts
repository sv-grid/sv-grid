/**
 * Rich text for long-text fields: **bold**, *italic*, `code`, [links](https://...)
 * and "- " list lines. Parsed into plain parts that the cell renders as
 * elements; nothing reaches the page as HTML, so the text cannot inject markup.
 * Links keep http(s) and mailto only.
 */

export type RichPart =
  | { kind: 'text'; text: string }
  | { kind: 'b' | 'i' | 'code'; text: string }
  | { kind: 'a'; text: string; href: string }

export type RichLine = { bullet: boolean; parts: RichPart[] }

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g

function safeHref(href: string): string | null {
  try {
    const u = new URL(href)
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:' ? u.href : null
  } catch {
    return null
  }
}

export function parseInline(text: string): RichPart[] {
  const out: RichPart[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push({ kind: 'text', text: text.slice(last, m.index) })
    if (m[1] != null) out.push({ kind: 'b', text: m[1] })
    else if (m[2] != null) out.push({ kind: 'i', text: m[2] })
    else if (m[3] != null) out.push({ kind: 'code', text: m[3] })
    else {
      const href = safeHref(m[5]!)
      out.push(href ? { kind: 'a', text: m[4]!, href } : { kind: 'text', text: m[4]! })
    }
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

export function parseRichText(value: unknown): RichLine[] {
  const text = value == null ? '' : String(value)
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const bullet = /^\s*[-*]\s+/.test(line)
      return { bullet, parts: parseInline(bullet ? line.replace(/^\s*[-*]\s+/, '') : line) }
    })
}
