/**
 * Excel's `IMAGE` function: a picture IN a cell rather than floating over
 * it.
 *
 * The difference is the whole point. A picture object hangs from a cell and
 * covers whatever is under it; an `IMAGE` cell IS the picture, so it sorts
 * with its row, filters with it, copies as a formula and moves when the
 * cells move, with nothing to keep in step. A catalogue with a thumbnail
 * column wants this one.
 *
 * The function answers with the source, which is what makes `=IMAGE(A2)`
 * read like any other formula: the value is text, `ISTEXT` says so, and a
 * cell that reads it gets the address rather than a picture it cannot use.
 * Drawing it is the shell's part, and this is what the shell reads to know
 * a cell is one.
 */

/** The arguments of a top-level `=IMAGE(...)`, as written. */
export type ImageCall = {
  /** The source expression: a quoted URL, a reference, a formula. */
  source: string
  /** The alt text expression, when the call gives one. */
  alt?: string
}

/**
 * The call's arguments when a formula IS one `IMAGE(...)` call, or null.
 *
 * Read off the text rather than the parsed tree on purpose: this runs for
 * every cell that paints, and a scan is cheaper than a parse. A formula
 * that merely CONTAINS an IMAGE call (`=IF(A1, IMAGE(B1), "")`) is not one,
 * because its value is not a picture in every case.
 */
export function imageCall(text: string): ImageCall | null {
  const trimmed = text.trim()
  const head = /^=\s*IMAGE\s*\(/i.exec(trimmed)
  if (!head) return null
  const inside = trimmed.slice(head[0].length)
  const args: string[] = []
  let depth = 0
  let quoted = false
  let start = 0
  let closed = -1
  for (let i = 0; i < inside.length; i += 1) {
    const ch = inside[i]!
    if (quoted) {
      if (ch === '"') { if (inside[i + 1] === '"') i += 1; else quoted = false }
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === '(') { depth += 1; continue }
    if (ch === ')') {
      if (depth === 0) { args.push(inside.slice(start, i)); closed = i; break }
      depth -= 1
      continue
    }
    if (ch === ',' && depth === 0) { args.push(inside.slice(start, i)); start = i + 1 }
  }
  // Anything after the closing bracket means the call is part of a larger
  // formula, so the cell is not simply a picture.
  if (closed < 0 || inside.slice(closed + 1).trim() !== '') return null
  const source = (args[0] ?? '').trim()
  if (!source) return null
  const alt = (args[1] ?? '').trim()
  return { source, ...(alt ? { alt } : {}) }
}

/**
 * Whether a source is one a browser will load. A `data:` URL and an
 * ordinary web address are; anything else (a file path, a `javascript:`
 * scheme) is not, and a cell showing it as text says more than a broken
 * image would.
 */
export function isDrawableImageSource(source: string): boolean {
  const value = source.trim()
  if (/^data:image\//i.test(value)) return true
  return /^https?:\/\/\S+$/i.test(value)
}
