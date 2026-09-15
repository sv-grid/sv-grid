<script lang="ts">
  /**
   * 464. Support ticket log: AutoFilter
   * -----------------------------------
   * The log a support lead keeps open, with Excel's Filter on it. Forty
   * tickets; the arrows on the header row drop Excel's menu, and the
   * document opens already filtered to what is still open:
   *
   *   Values        untick Closed under Status and the closed tickets fold
   *                 away; the arrow turns into a funnel, the row numbers of
   *                 the region turn blue and the status bar counts "N of 40
   *                 records found". A folded row is the filter's, not a
   *                 hidden one: Unhide leaves it where it is.
   *   Conditions    Number Filters on Hours open (greater than 48), Text
   *                 Filters on Customer (begins with), two of them joined
   *                 with And / Or.
   *   Search        type in the box and the list narrows; OK applies what
   *                 it shows.
   *   Sort          A to Z and Z to A from the menu keep the header row put.
   *   Live          the rows are worked out again after every edit: type
   *                 Closed into an open ticket and it folds away at once,
   *                 the way Excel's Reapply would.
   *
   * Ctrl+Shift+L toggles the whole thing; the filter is part of the
   * document and comes back from getState() with the rows it hides.
   *
   * Try: open the arrow on Owner and keep only Priya, then Number Filters
   * on Hours open, greater than 48: the tickets that need chasing. Clear
   * Filter From "Owner" widens it again; Ctrl+Shift+L twice resets.
   */
  import { SvSheet, createWorkbook, createSheetDocument, type CellFormatEntry } from '@svgrid/enterprise'

  const CUSTOMERS = ['Acme Foods', 'Borealis', 'Cobalt Labs', 'Delta Freight', 'Evergreen', 'Fjord Media', 'Granite Bank', 'Helix Health']
  const OWNERS = ['Priya', 'Marco', 'Lena', 'Tom']
  const PRIORITIES = ['P1', 'P2', 'P3']
  const STATUSES = ['Open', 'Pending', 'Closed']
  const SUBJECTS = [
    'Login loop after password reset', 'Export stops at 10,000 rows', 'Invoice PDF shows the wrong currency',
    'Webhook retries every minute', 'Dashboard blank on Safari', 'SSO group mapping ignored',
    'Duplicate notifications', 'Date column off by one day', 'Cannot delete an archived project',
    'API rate limit lower than documented',
  ]

  // A fixed sequence, so the demo reads the same every time it opens.
  let seed = 7
  function pick<T>(list: readonly T[]): T { seed = (seed * 9301 + 49297) % 233280; return list[Math.floor((seed / 233280) * list.length)]! }
  const between = (lo: number, hi: number) => { seed = (seed * 9301 + 49297) % 233280; return lo + Math.floor((seed / 233280) * (hi - lo + 1)) }

  const N = 40
  const tickets = Array.from({ length: N }, (_, i) => {
    const day = 1 + Math.floor(i / 2)
    const status = i < 26 ? pick(STATUSES) : pick(['Open', 'Pending'])   // the newest are still open
    const hours = status === 'Closed' ? between(2, 60) : between(1, 140)
    const csat = status === 'Closed' ? String(between(2, 5)) : ''
    return [`T-${1041 + i}`, `2026-09-${String(day).padStart(2, '0')}`, pick(CUSTOMERS), pick(SUBJECTS), pick(PRIORITIES), status, pick(OWNERS), String(hours), csat]
  })

  const cells = [
    ['Ticket', 'Opened', 'Customer', 'Subject', 'Priority', 'Status', 'Owner', 'Hours open', 'CSAT'],
    ...tickets,
    [],
    ['Open', `=COUNTIF(F2:F${N + 1},"Open")`, 'Pending', `=COUNTIF(F2:F${N + 1},"Pending")`, 'Closed', `=COUNTIF(F2:F${N + 1},"Closed")`, 'Avg CSAT', `=AVERAGE(I2:I${N + 1})`],
  ]

  const wb = createWorkbook([{ name: 'Tickets', cells }])
  const doc = createSheetDocument({ workbook: wb })
  const sheet = doc.get('Tickets')
  // The AutoFilter, already applied: Status without Closed. The range is
  // the header row plus the forty tickets; filters are keyed by column.
  sheet.autoFilter = { range: [0, 0, N, 8], filters: { 5: { kind: 'values', excluded: ['Closed'] } } }
  sheet.validation = [
    { id: 'status', rects: [[1, 5, N, 5]], allow: 'list', value1: STATUSES.join(','), ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' } },
    { id: 'priority', rects: [[1, 4, N, 4]], allow: 'list', value1: PRIORITIES.join(','), ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' } },
  ]
  sheet.conditionalFormats = [
    { id: 'p1', rects: [[1, 4, N, 4]], kind: 'text', match: 'contains', value: 'P1', style: { fill: '#FFC7CE', color: '#9C0006' } },
    { id: 'old', rects: [[1, 7, N, 7]], kind: 'cellIs', operator: 'greater', value1: '48', style: { color: '#9C0006', bold: true } },
  ]
  sheet.freeze = { rows: 1, cols: 0 }

  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  type Entry = Record<string, CellFormatEntry>
  const across = (cols: string, row: number, entry: CellFormatEntry): Entry =>
    Object.fromEntries([...cols].map((c) => [`${c}${row}`, entry]))
  const formats: Entry = {
    ...across('ABCDEFGHI', 1, BAND),
    ...across('ACEG', N + 3, { bold: true }),
    [`H${N + 3}`]: { numFmt: '0.0' },
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet document={doc} height="100%" rows={N + 4} columns={10} columnWidths={{ A: 80, B: 100, C: 120, D: 230, E: 80, F: 90, G: 80, H: 100, I: 70 }} {formats} />
  <p class="note shrink-0">
    The log opens filtered to the tickets still open: the funnel on
    <strong>Status</strong>, the blue row numbers and the status bar's
    "records found" say so. Open the arrow on <strong>Owner</strong> and keep
    one name, add <strong>Number Filters &gt; Greater Than 48</strong> on
    Hours open, or type Closed into an open ticket and watch it fold away.
    Ctrl+Shift+L turns the filter off and on.
  </p>
</section>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
</style>
