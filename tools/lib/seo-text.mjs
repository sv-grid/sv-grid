/**
 * Text helpers shared by the docs index, the prerenderer and the website so a
 * meta description is stripped and clamped the same way everywhere it is
 * emitted. Dependency-free so Vite can bundle it into the site.
 */

/** Drop inline markdown (code marks, bold, link syntax) and collapse whitespace. */
export function stripInlineMd(text) {
  return String(text ?? '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The first sentence of a paragraph, or the whole text when it has no sentence end. */
export function firstSentence(text) {
  const s = stripInlineMd(text)
  const m = s.match(/^.*?[.!?](?=\s|$)/)
  return m ? m[0] : s
}

/**
 * Clamp a meta description to `max` characters. Search engines truncate around
 * 155-160, so anything longer is cut on the result page anyway, usually mid
 * word. Cuts at the last sentence end past 90 characters when there is one,
 * else at the last word boundary with an ASCII ellipsis (the blog generator's
 * sanitizer rewrites the Unicode one, so the two would otherwise disagree).
 */
export function clampDescription(text, max = 155) {
  const s = stripInlineMd(text)
  if (s.length <= max) return s
  const head = s.slice(0, max - 3)
  const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  if (sentenceEnd >= 90) return head.slice(0, sentenceEnd + 1)
  const cut = head.replace(/\s+\S*$/, '')
  return (cut || head).trimEnd() + '...'
}
