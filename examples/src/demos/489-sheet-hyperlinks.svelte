<script lang="ts">
  /**
   * 479. Hyperlinks: Insert > Link and the HYPERLINK function
   * ---------------------------------------------------------
   * Excel's two ways of putting a link in a cell, both here.
   *
   *   Insert > Link (Ctrl+K)  a link ON the cell: the cell keeps whatever
   *                           it says, and the link is kept beside it. Edit
   *                           the text and the link stays; clear the cell
   *                           and it goes. This is what column C uses.
   *   =HYPERLINK(url, name)   a link IN a formula, which shows the friendly
   *                           name. Column E uses it, built from the ticket
   *                           id beside it.
   *
   * A target that reads like an address moves the selection instead of
   * leaving the page: the Owner column links to the People sheet, so
   * clicking one goes there. Anything with a scheme, or a bare www., opens
   * in a new tab. A single click follows the link, a drag from the same
   * cell selects, which is Excel's rule.
   *
   * Links ride in `getState()` under `links`, move with an insert or a
   * delete, and go into the .xlsx as real hyperlinks, an external one as a
   * relationship and an internal one as a location, both read back.
   *
   * Try: click a ticket in C, then an owner in D. Press Ctrl+K on a cell to
   * add or edit a link, and Insert > Remove to take one off. Insert a row
   * above 2 and watch the links move with their rows. File > Save As, and
   * open the file in Excel.
   */
  import { SvSheet, createWorkbook, createSheetDocument } from '@svgrid/enterprise'

  const tickets = [
    { id: 'SG-1041', title: 'Frozen panes drift on zoom', owner: 'Ada', status: 'Open' },
    { id: 'SG-1042', title: 'Paste from Excel loses italics', owner: 'Grace', status: 'Open' },
    { id: 'SG-1043', title: 'CSV export quotes twice', owner: 'Linus', status: 'Closed' },
    { id: 'SG-1044', title: 'Sparkline colours ignore the theme', owner: 'Ada', status: 'Open' },
    { id: 'SG-1045', title: 'Name Box refuses a sheet-qualified ref', owner: 'Grace', status: 'Open' },
  ]

  const rows: string[][] = [
    ['Id', 'Owner', 'Title', 'Status', 'On the tracker'],
    ...tickets.map((t, i) => [
      t.id,
      t.owner,
      t.title,
      t.status,
      `=HYPERLINK("https://example.com/issues/" & A${i + 2}, "Open " & A${i + 2})`,
    ]),
  ]

  const people: string[][] = [
    ['Person', 'Team', 'Open tickets'],
    ['Ada', 'Grid', '=COUNTIFS(Tickets!B2:B6, A2, Tickets!D2:D6, "Open")'],
    ['Grace', 'Sheet', '=COUNTIFS(Tickets!B2:B6, A3, Tickets!D2:D6, "Open")'],
    ['Linus', 'Platform', '=COUNTIFS(Tickets!B2:B6, A4, Tickets!D2:D6, "Open")'],
  ]

  const wb = createWorkbook([
    { name: 'Tickets', cells: rows },
    { name: 'People', cells: people },
  ])
  const doc = createSheetDocument({ workbook: wb })
  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  const sheet = doc.get('Tickets')
  sheet.formats.set([[0, 0, 0, 4]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  sheet.widths.A = 90
  sheet.widths.B = 90
  sheet.widths.C = 260
  sheet.widths.E = 150
  sheet.freeze = { rows: 1, cols: 0 }

  // Column C: a link on each title, out to the tracker. Column B: a link to
  // the person on the other sheet, which moves the selection rather than
  // leaving the page.
  sheet.links = Object.fromEntries(tickets.map((t, i) => [
    `r${i + 1}`,
    {
      C: { target: `https://example.com/issues/${t.id}`, tip: `${t.id} on the tracker` },
      B: { target: `People!A${['Ada', 'Grace', 'Linus'].indexOf(t.owner) + 2}`, tip: `${t.owner} on the People sheet` },
    },
  ]))

  const peopleSheet = doc.get('People')
  peopleSheet.formats.set([[0, 0, 0, 2]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
  peopleSheet.widths.A = 110
  peopleSheet.widths.B = 110
  peopleSheet.widths.C = 110
  // And back the other way: each person links to the ticket list.
  peopleSheet.links = {
    r1: { A: { target: 'Tickets!A1', tip: 'Back to the tickets' } },
    r2: { A: { target: 'Tickets!A1', tip: 'Back to the tickets' } },
    r3: { A: { target: 'Tickets!A1', tip: 'Back to the tickets' } },
  }
</script>

<SvSheet document={doc} height="100%" rows={16} columns={8} />
