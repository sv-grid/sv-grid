<script lang="ts">
  /**
   * 494. IMAGE: a picture inside the cell
   * -------------------------------------
   * Excel's `IMAGE` puts a picture IN a cell rather than floating one over
   * it, and the difference is the whole point.
   *
   *   =IMAGE(source, [alt])   the cell IS the picture. It sorts with its
   *                           row, filters with it, copies as a formula,
   *                           and moves when the cells move.
   *   Insert > Picture        the other kind: an object anchored to a cell,
   *                           floating over whatever is under it.
   *
   * A product list is the case this exists for. The thumbnail column holds
   * a formula reading the swatch beside it, so a row sorted to the top
   * takes its picture along and nothing has to be kept in step.
   *
   * The source is a web address or a data URL; anything else stays text
   * rather than becoming a broken image. The second argument is the alt
   * text, worked out like any other argument.
   *
   * Try: sort by Price with Data > Sort and watch the pictures follow their
   * rows. Type =IMAGE(C2) into an empty cell for a copy of the first one.
   * Save As: the formula goes into the .xlsx as Excel stores it.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  /** Four flat SVG swatches as data URLs, so the demo needs no network. */
  const swatch = (fill: string, mark: string): string =>
    'data:image/svg+xml;base64,' + btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32"><rect width="48" height="32" rx="4" fill="${fill}"/>`
      + `<text x="24" y="21" font-family="sans-serif" font-size="13" fill="#fff" text-anchor="middle">${mark}</text></svg>`,
    )

  const products = [
    ['Licence', '1200', swatch('#2563eb', 'L'), 'A blue licence swatch'],
    ['Support', '480', swatch('#16a34a', 'S'), 'A green support swatch'],
    ['Training', '950', swatch('#ea580c', 'T'), 'An orange training swatch'],
    ['Hosting', '260', swatch('#a855f7', 'H'), 'A purple hosting swatch'],
  ]

  const rows: string[][] = [
    // "Source (data URL)": the column is text on purpose, the address the
    // thumbnail reads, and the header says so before the truncated
    // `data:image/...` reads as a picture that failed to draw.
    ['Product', 'Price', 'Source (data URL)', 'Alt text', 'Thumbnail'],
    ...products.map((p, i) => [...p, `=IMAGE(C${i + 2}, D${i + 2})`]),
    ['', '', '', '', ''],
    ['Not an image source', '', 'ftp://example.com/a.png', 'Left as text', '=IMAGE(C7, D7)'],
  ]

  const wb = createWorkbook([{ name: 'Catalogue', cells: rows }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Catalogue')
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }
  sheet.formats.set([[0, 0, 0, 4]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.formats.set([[1, 1, 4, 1]], { numFmt: '$#,##0' }, at)
  sheet.formats.set([[1, 2, 7, 3]], { color: '#64748b' }, at)
  sheet.widths.A = 130
  sheet.widths.C = 150
  sheet.widths.D = 190
  sheet.widths.E = 110
  // Room for a picture: Excel's IMAGE fits the cell, so the cell decides.
  for (let r = 1; r <= 4; r += 1) sheet.heights.set(r, 40)
  sheet.freeze = { rows: 1, cols: 1 }
  sheet.autoFilter = { range: [0, 0, 4, 4], filters: {} }
</script>

<SvSheet document={doc} height="100%" rows={14} columns={7} />
