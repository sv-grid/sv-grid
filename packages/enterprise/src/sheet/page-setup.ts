/**
 * Excel's Page Setup, per sheet: what the Page Layout tab sets and File >
 * Print reads. Orientation, paper, margins, the print area, the rows that
 * repeat at the top of every page, whether gridlines and headings print,
 * and the scale. Margins are in inches, the unit the file keeps them in.
 * Nothing here touches the DOM; `print.ts` turns a sheet and its setup
 * into the page.
 */
import type { Rect } from './rects'
import type { StructuralEdit } from './refs'
import { shiftRect, lineShift } from './rects'

export type PageOrientation = 'portrait' | 'landscape'

/** The papers Excel's list starts with, with their OOXML `paperSize` codes. */
export const PAPER_SIZES = {
  Letter: { code: 1, css: 'letter' },
  Tabloid: { code: 3, css: '11in 17in' },
  Legal: { code: 5, css: 'legal' },
  A3: { code: 8, css: 'A3' },
  A4: { code: 9, css: 'A4' },
  A5: { code: 11, css: 'A5' },
} as const

export type PaperSize = keyof typeof PAPER_SIZES

/** Inches, as the file keeps them: page edges, and the header and footer bands. */
export type PageMargins = { top: number; bottom: number; left: number; right: number; header: number; footer: number }

/** Excel's Margins dropdown. */
export const MARGIN_PRESETS: Record<'normal' | 'narrow' | 'wide', PageMargins> = {
  normal: { top: 0.75, bottom: 0.75, left: 0.7, right: 0.7, header: 0.3, footer: 0.3 },
  narrow: { top: 0.75, bottom: 0.75, left: 0.25, right: 0.25, header: 0.3, footer: 0.3 },
  wide: { top: 1, bottom: 1, left: 1, right: 1, header: 0.5, footer: 0.5 },
}

export type MarginPreset = keyof typeof MARGIN_PRESETS

export type PageSetup = {
  orientation: PageOrientation
  paper: PaperSize
  margins: PageMargins
  /** The cells that print, or null for everything the sheet holds. */
  printArea: Rect[] | null
  /** Rows repeated at the top of every page, `[first, last]` 0-based, or null. */
  printTitleRows: [number, number] | null
  gridlines: boolean
  headings: boolean
  /** Percent; 100 prints at size. */
  scale: number
}

export const defaultPageSetup = (): PageSetup => ({
  orientation: 'portrait',
  paper: 'A4',
  margins: { ...MARGIN_PRESETS.normal },
  printArea: null,
  printTitleRows: null,
  gridlines: false,
  headings: false,
  scale: 100,
})

/** A copy safe to hand out or save. */
export function copyPageSetup(setup: PageSetup): PageSetup {
  return {
    ...setup,
    margins: { ...setup.margins },
    printArea: setup.printArea ? setup.printArea.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const) : null,
    printTitleRows: setup.printTitleRows ? [setup.printTitleRows[0], setup.printTitleRows[1]] : null,
  }
}

/** Which preset the margins are, if any, for the dropdown's lit entry. */
export function marginPresetOf(margins: PageMargins): MarginPreset | null {
  for (const [name, preset] of Object.entries(MARGIN_PRESETS) as Array<[MarginPreset, PageMargins]>) {
    if ((Object.keys(preset) as Array<keyof PageMargins>).every((k) => Math.abs(preset[k] - margins[k]) < 1e-6)) return name
  }
  return null
}

/** The setup after an insert or delete: the print area and the title rows move with their lines. */
export function shiftPageSetup(setup: PageSetup, edit: StructuralEdit): PageSetup {
  const out = copyPageSetup(setup)
  if (out.printArea) {
    const moved = out.printArea.map((r) => shiftRect(r, edit)).filter((r): r is Rect => r !== null)
    out.printArea = moved.length ? moved : null
  }
  if (out.printTitleRows && (edit.kind === 'insertRows' || edit.kind === 'deleteRows')) {
    const shift = lineShift(edit)
    const [a, b] = out.printTitleRows
    if (edit.kind === 'insertRows') {
      out.printTitleRows = [shift(a)!, shift(b)!]
    } else {
      const rows: number[] = []
      for (let r = a; r <= b; r += 1) { const next = shift(r); if (next !== null) rows.push(next) }
      out.printTitleRows = rows.length ? [rows[0]!, rows[rows.length - 1]!] : null
    }
  }
  return out
}

/** `@page` margins from inches, the order CSS wants. */
export function marginsCss(margins: PageMargins): string {
  const inch = (n: number) => `${Math.round(n * 100) / 100}in`
  return `${inch(margins.top)} ${inch(margins.right)} ${inch(margins.bottom)} ${inch(margins.left)}`
}
