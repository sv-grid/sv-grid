/**
 * Hyperlinks: Excel's Insert > Link, and the `HYPERLINK` function.
 *
 * A link belongs to a CELL rather than to its text, the way Excel keeps
 * one: the cell still holds whatever was typed, and the link is kept beside
 * it so that editing the text does not lose the target and clearing the
 * cell does. That also means a link survives a format change, a sort of the
 * text around it and a save, and moves with an insert or a delete.
 *
 * Two kinds of target, told apart by how they read rather than by a flag
 * the user has to set:
 *
 *   external   `https://…`, `mailto:…`, anything with a scheme, opened in
 *              a new tab;
 *   internal   `Sheet1!B4`, `B4`, or a defined name, which moves the
 *              selection instead of leaving the page.
 *
 * The map is keyed the way the comments map is (`r4` -> `B` -> the link),
 * so the same `remapNotes` moves both when a row or column is inserted.
 */
import { remapNotes } from './rects'
import { colToLetters, lettersToCol, parseA1 } from './address'
import type { StructuralEdit } from './refs'
import { lineShift } from './rects'

export type SheetLink = {
  /** Where it goes: a URL, or an address on this workbook. */
  target: string
  /** Excel's ScreenTip: what hovering says, when it is not the target. */
  tip?: string
}

/** `r4` -> `B` -> the link on B5. */
export type LinksMap = Record<string, Record<string, SheetLink>>

/** The link on a cell, or undefined. */
export function linkAt(links: LinksMap, row: number, col: number): SheetLink | undefined {
  return links[`r${row}`]?.[colToLetters(col)]
}

/** A copy with the link set on one cell. */
export function setLink(links: LinksMap, row: number, col: number, link: SheetLink): LinksMap {
  const rowId = `r${row}`
  return { ...links, [rowId]: { ...(links[rowId] ?? {}), [colToLetters(col)]: { ...link } } }
}

/** A copy with the link removed from one cell, and the row dropped if empty. */
export function removeLink(links: LinksMap, row: number, col: number): LinksMap {
  const rowId = `r${row}`
  const line = links[rowId]
  if (!line || !(colToLetters(col) in line)) return links
  const next = { ...line }
  delete next[colToLetters(col)]
  const out = { ...links }
  if (Object.keys(next).length) out[rowId] = next
  else delete out[rowId]
  return out
}

/** Every link, as rows and columns, for a writer or a test. */
export function listLinks(links: LinksMap): Array<{ row: number; col: number; link: SheetLink }> {
  const out: Array<{ row: number; col: number; link: SheetLink }> = []
  for (const [rowId, line] of Object.entries(links)) {
    const row = Number(rowId.slice(1))
    if (!Number.isInteger(row)) continue
    for (const [columnId, link] of Object.entries(line)) {
      const col = lettersToCol(columnId)
      if (col >= 0) out.push({ row, col, link: { ...link } })
    }
  }
  return out.sort((a, b) => a.row - b.row || a.col - b.col)
}

/** The links after an insert or delete: they move with their cells. */
export function shiftLinks(links: LinksMap, edit: StructuralEdit): LinksMap {
  const rows = edit.kind === 'insertRows' || edit.kind === 'deleteRows'
  return remapNotes<SheetLink>(links, rows ? 'rows' : 'cols', lineShift(edit))
}

/** A deep enough copy to hand out or save. */
export function copyLinks(links: LinksMap): LinksMap {
  const out: LinksMap = {}
  for (const [rowId, line] of Object.entries(links)) {
    out[rowId] = Object.fromEntries(Object.entries(line).map(([c, link]) => [c, { ...link }]))
  }
  return out
}

/** Anything with a scheme, or a bare `www.`, is a link out of the page. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|www\.)/i

export type LinkTarget =
  | { kind: 'external'; href: string }
  | { kind: 'internal'; sheet: string | null; row: number; col: number }
  | { kind: 'name'; name: string }

/**
 * What a target means. An address wins over a name, so `B4` is a cell and
 * `Sales` is a defined name; `Sheet1!B4` is the cell on that sheet.
 */
export function parseLinkTarget(target: string): LinkTarget | null {
  const text = target.trim()
  if (text === '') return null
  if (EXTERNAL.test(text)) return { kind: 'external', href: text.toLowerCase().startsWith('www.') ? `https://${text}` : text }
  // `Sheet1!B4` and `'Two words'!B4`: the sheet is whatever is before the
  // last `!`, which `parseA1` takes as an argument rather than parsing.
  const bang = text.lastIndexOf('!')
  const sheet = bang < 0 ? null : text.slice(0, bang).replace(/^'(.*)'$/, '$1').replace(/''/g, "'")
  const cell = bang < 0 ? text : text.slice(bang + 1)
  const ref = parseA1(cell, sheet)
  if (ref && ref.row !== null) return { kind: 'internal', sheet: ref.sheet, row: ref.row, col: ref.col }
  return { kind: 'name', name: text }
}

/** What a linked cell's title says: the tip, or where it goes. */
export function linkTitle(link: SheetLink): string {
  return link.tip?.trim() ? link.tip : link.target
}

/**
 * The first argument of a top-level `=HYPERLINK(...)`, as it was written,
 * so the caller can evaluate it and learn where the cell goes.
 *
 * Excel makes a cell holding that formula clickable, and the target is
 * whatever the first argument works out to, which may be an expression
 * (`"…/issues/" & A2`). Null for anything that is not that call, including
 * one nested inside another formula, since only the outermost one decides
 * where the cell goes.
 */
export function hyperlinkArgument(text: string): string | null {
  const m = /^=\s*HYPERLINK\s*\(/i.exec(text.trim())
  if (!m) return null
  const inside = text.trim().slice(m[0].length)
  let depth = 0
  let quoted = false
  for (let i = 0; i < inside.length; i += 1) {
    const ch = inside[i]!
    if (quoted) {
      // `""` inside a string is an escaped quote, not the end of one.
      if (ch === '"') { if (inside[i + 1] === '"') i += 1; else quoted = false }
      continue
    }
    if (ch === '"') { quoted = true; continue }
    if (ch === '(') { depth += 1; continue }
    if (ch === ')') {
      if (depth === 0) return inside.slice(0, i).trim() || null
      depth -= 1
      continue
    }
    if (ch === ',' && depth === 0) return inside.slice(0, i).trim() || null
  }
  return null
}
