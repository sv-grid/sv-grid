/**
 * Small string/comment-aware scanning helpers.
 *
 * The codemod deliberately does NOT pull in a JS parser: the tool runs via
 * `npx` against somebody else's project, so a parser dependency means a
 * version-coupling problem plus a multi-megabyte download for what is a
 * handful of very regular call shapes. These helpers give correct bracket
 * matching across strings, template literals, comments and nesting, which is
 * all the extraction actually needs.
 */

const BACKSLASH = 92

const OPEN = { '(': ')', '[': ']', '{': '}' }
const CLOSE = { ')': '(', ']': '[', '}': '{' }

/**
 * Index just past the token starting at `i` when it opens a string, template
 * literal or comment. Returns -1 when `i` is ordinary code.
 *
 * Template literals are walked recursively so a `${ ... }` interpolation that
 * itself contains braces or nested templates cannot desynchronise the caller's
 * depth counter.
 */
export function skipAtomic(src, i) {
  const c = src[i]
  if (c === '/' && src[i + 1] === '/') {
    const nl = src.indexOf('\n', i)
    return nl === -1 ? src.length : nl
  }
  if (c === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2)
    return end === -1 ? src.length : end + 2
  }
  if (c === '"' || c === "'") {
    for (let k = i + 1; k < src.length; k++) {
      if (src.charCodeAt(k) === BACKSLASH) { k++; continue }
      if (src[k] === c) return k + 1
    }
    return src.length
  }
  if (c === '`') {
    for (let k = i + 1; k < src.length; k++) {
      if (src.charCodeAt(k) === BACKSLASH) { k++; continue }
      if (src[k] === '`') return k + 1
      if (src[k] === '$' && src[k + 1] === '{') {
        const close = matchBracket(src, k + 1)
        if (close === -1) return src.length
        k = close
      }
    }
    return src.length
  }
  return -1
}

/** Index of the bracket closing the one at `openIndex`, or -1. */
export function matchBracket(src, openIndex) {
  if (!OPEN[src[openIndex]]) return -1
  let depth = 0
  for (let i = openIndex; i < src.length; i++) {
    const skipped = skipAtomic(src, i)
    if (skipped !== -1) { i = skipped - 1; continue }
    const c = src[i]
    if (OPEN[c]) depth++
    else if (CLOSE[c]) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Split `src` on `sep` at bracket depth 0, ignoring separators inside strings. */
export function splitTopLevel(src, sep = ',') {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < src.length; i++) {
    const skipped = skipAtomic(src, i)
    if (skipped !== -1) { i = skipped - 1; continue }
    const c = src[i]
    if (OPEN[c]) depth++
    else if (CLOSE[c]) depth--
    else if (c === sep && depth === 0) {
      out.push(src.slice(start, i))
      start = i + 1
    }
  }
  out.push(src.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/**
 * Read a `{ ... }` object-literal body into an ordered [key, rawValue] list.
 * Values come back as source text and are never evaluated.
 */
export function readObjectProps(body) {
  const out = []
  for (const part of splitTopLevel(body, ',')) {
    let depth = 0
    let colon = -1
    for (let i = 0; i < part.length; i++) {
      const skipped = skipAtomic(part, i)
      if (skipped !== -1) { i = skipped - 1; continue }
      const c = part[i]
      if (OPEN[c]) depth++
      else if (CLOSE[c]) depth--
      else if (c === ':' && depth === 0) { colon = i; break }
    }
    if (colon === -1) {
      const key = part.trim()
      if (key) out.push([key, key]) // shorthand `{ foo }`
      continue
    }
    const key = part.slice(0, colon).trim().replace(/^['"]|['"]$/g, '')
    out.push([key, part.slice(colon + 1).trim()])
  }
  return out
}

/**
 * Find a call to `name` outside strings/comments and return its argument text.
 * `name` may contain a dot (e.g. `table.column`).
 */
export function findCall(src, name, from = 0) {
  const escaped = name.replace(/\./g, '\\.')
  const re = new RegExp('(^|[^\\w.$])(' + escaped + ')\\s*\\(', 'g')
  re.lastIndex = from
  let m
  while ((m = re.exec(src))) {
    const nameStart = m.index + m[1].length
    // Reject a hit that landed inside a string or comment.
    let inAtomic = false
    for (let i = 0; i < nameStart; i++) {
      const skipped = skipAtomic(src, i)
      if (skipped !== -1) {
        if (skipped > nameStart) { inAtomic = true; break }
        i = skipped - 1
      }
    }
    if (inAtomic) continue
    const paren = src.indexOf('(', nameStart)
    const end = matchBracket(src, paren)
    if (end === -1) continue
    return {
      start: nameStart,
      end: end + 1,
      argsStart: paren + 1,
      argsEnd: end,
      args: src.slice(paren + 1, end),
    }
  }
  return null
}

/** Every call to `name`, left to right. */
export function findAllCalls(src, name) {
  const out = []
  let from = 0
  for (;;) {
    const hit = findCall(src, name, from)
    if (!hit) return out
    out.push(hit)
    from = hit.end
  }
}
