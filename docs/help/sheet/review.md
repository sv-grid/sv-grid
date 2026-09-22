---
seoTitle: Svelte spreadsheet review - comments, protection, two people
seoDescription: Reviewing an SvSheet spreadsheet: notes and threaded comments, a protected sheet with unlocked cells, and two people on one document over a delta stream.
keywords: spreadsheet comments svelte, protect sheet svelte, collaborative spreadsheet svelte, delta stream, presence cursors
---

# Review and share: comments, protection, two people

A sheet that leaves one person's hands: a note on a cell and a thread of
replies under it, cells that refuse a change while the sheet is
protected, and a second person editing the same document at the same
time with their cursor in view. [Getting started](./start.md) shows the
document these live in; [Files](./files.md) how one person's document
is saved.

The examples share an expense claim sheet.

```svelte {preamble}
<script lang="ts">
  import { SvSheet, createWorkbook, createSheetDocument, createDeltaStream, newEditRangeId, type SheetPresence } from '@svgrid/enterprise'

  const claims: string[][] = [
    ['Claim', 'Who', 'Category', 'Amount', 'Receipt', 'Status', 'Reviewer notes'],
    ['EXP-2041', 'Ben', 'Travel', '412.50', 'Yes', 'Submitted', ''],
    ['EXP-2042', 'Dev', 'Meals', '210.00', 'No', 'On hold', ''],
    ['EXP-2043', 'Ana', 'Software', '89.00', 'Yes', 'Approved', ''],
    ['EXP-2044', 'Ben', 'Travel', '412.50', 'Yes', 'Submitted', ''],
    ['', '', '', '', '', '', ''],
    ['Approved so far', '', '', '=SUMIF(F2:F5,"Approved",D2:D5)', '', '', ''],
  ]

  const at = { rowIdAt: (i: number) => `r${i}`, columnIdAt: (i: number) => String.fromCharCode(65 + i) }

  function claimsDoc() {
    const d = createSheetDocument({ workbook: createWorkbook([{ name: 'Claims', cells: claims }]) })
    const s = d.get('Claims')
    s.formats.set([[0, 0, 0, 6]], { bold: true, fill: '#e2e8f0', color: '#0f172a' }, at)
    s.formats.set([[1, 3, 6, 3]], { numFmt: '$#,##0.00' }, at)
    s.formats.set([[6, 0, 6, 3]], { bold: true }, at)
    s.widths.A = 100
    s.widths.G = 180
    s.freeze = { rows: 1, cols: 0 }
    return d
  }
</script>
```

## Notes and threads

A comment is text on a cell, marked by a red corner and read by hovering
the cell. Review > New Comment, `Shift+F2` or the cell menu opens the
box beside the active cell; `Ctrl+Enter` or Save closes it, as does a
click elsewhere, keeping what was typed. On a cell that has one, the box
is the thread: the first entry with Edit and Delete, the replies with
theirs, a reply box, and Resolve, which greys the thread and hides the
reply box until Reopen. Previous and Next walk the sheet's comments, and
Show All Comments opens a strip under the formula bar listing every one
with its author, each a jump to its cell.

A document carries comments in `notes`, keyed by row and column: a
string is a plain note; an object with `text`, `author`, `at`, `replies`
and `resolved` is a thread.

```svelte {runnable}
<script lang="ts">
  const doc = claimsDoc()
  doc.get('Claims').notes = {
    r2: { D: {
      text: 'Three days of meals at 70 a day: over the 60 limit. Needs a sign-off before it goes through.',
      author: 'Finance review', at: '2026-03-02T09:10:00.000Z',
      replies: [{ text: 'Signed off by M. Chen this morning, see the ticket.', author: 'Ben Okafor', at: '2026-03-03T08:05:00.000Z' }],
    } },
    r4: { A: 'Same fare and dates as EXP-2041 on row 2. Check it is not the same ticket claimed twice.' },
  }
</script>

<SvSheet document={doc} rows={9} columns={8} commentAuthor="Finance review" />
```

`commentAuthor` is who signs: with it set, a new comment and every reply
carry that name and the time, the way Excel signs a threaded comment
with the signed-in user; without it a new comment is a plain note.
Comments move with an insert or a delete, ride in `getState()` as
`comments`, report `{ kind: 'comments' }` on `onChange`, and go into the
`.xlsx` as Excel's legacy note or its threaded comment with the persons
part, so Excel shows the thread with its authors.

## A protected sheet

Excel's model, without the password. Every cell is locked to begin with;
Format Cells > Protection (or Home > Format > Lock Cell) unlocks the ones
that may change; Review > Protect Sheet turns the flags on. From then on
a locked cell refuses a change wherever it comes from: typing, Delete,
the formula bar, paste, a fill, Find and Replace, a sort of the region,
and the formats. The refusal is a sentence in the status bar, Excel's
own. Unlocked cells take every edit as before.

From code, `locked: false` in a cell's format entry unlocks it, and
`protected = true` on the sheet protects it:

```svelte {runnable}
<script lang="ts">
  const doc = claimsDoc()
  const sheet = doc.get('Claims')
  // The reviewer may set a Status and a Receipt; nothing else changes.
  sheet.formats.set([[1, 4, 4, 5]], { locked: false, fill: '#fffbeb' }, at)
  sheet.validation = [
    { id: 'status', rects: [[1, 5, 4, 5]], allow: 'list', value1: 'Submitted,Approved,Rejected,On hold', ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' } },
    { id: 'receipt', rects: [[1, 4, 4, 4]], allow: 'list', value1: 'Yes,No', ignoreBlank: true, inCellDropdown: true, alert: { style: 'stop' } },
  ]
  sheet.protected = true
</script>

<SvSheet document={doc} rows={9} columns={8} />
```

Try to type over an Amount: refused, with the reason in the status bar.
Pick a Status from the arrow: fine. Review > Unprotect Sheet is one
click, and one `Ctrl+Z` protects again; there is no password, on the
sheet or on a range, because the protection is against mistakes, not
against the person at the keyboard.

Protect Sheet opens Excel's dialog with its "allow all users of this
worksheet to" list, and Review > Allow Edit Ranges is Excel's Allow
Users to Edit Ranges: titled blocks that take an edit on a protected
sheet whether their cells are locked or not. Both are `protection` on
the sheet, `allow` with the permissions ticked (`formatCells`,
`formatColumns`, `formatRows`, `insertColumns`, `insertRows`,
`deleteColumns`, `deleteRows`, `sort`, `autoFilter`) and `ranges` with
the blocks:

```svelte {runnable}
<script lang="ts">
  const doc = claimsDoc()
  const sheet = doc.get('Claims')
  sheet.protection = {
    allow: { formatRows: true, sort: true, autoFilter: true },
    ranges: [{ id: newEditRangeId(), title: 'Reviewer notes', rects: [[1, 6, 4, 6]] }],
  }
  sheet.protected = true
</script>

<SvSheet document={doc} rows={9} columns={8} />
```

The notes column takes typing though every cell in it is locked; Row
Height and Hide work on rows; a sort of a block with no locked cell
goes through. The flag rides in `getState()` as `protected`, the list
and the ranges as `protection`, the unlocked cells as `locked: false` in
their entries; `onChange` reports `{ kind: 'protection' }`; Save As
writes them as the file's `sheetProtection` and `protectedRanges`, and
Open reads Excel's. A command of your own asks `cmd.canEdit(row, col)`
before it writes and gets the same answer the editor does.

<div data-docs-demo="460-review-comments-protection" data-height="600"></div>

## Two people on one sheet

`createDeltaStream` turns a document's changes into small messages and
applies the ones that arrive from somewhere else. Put a socket between
two of them and the sheet is collaborative:

```svelte
<script lang="ts">
  import { createSheetDocument, createDeltaStream } from '@svgrid/enterprise'

  const doc = createSheetDocument({ sheets })
  const socket = new WebSocket(url)
  const stream = createDeltaStream(doc, {
    onDelta: (delta) => socket.send(JSON.stringify(delta)),
  })
  socket.onmessage = (event) => stream.apply(JSON.parse(event.data))
  // A new participant asks for everything once.
  socket.onopen = () => stream.resync()
</script>

<SvSheet document={doc} height="100%" />
```

Five kinds of delta go out, each as small as it can be. `cells` carries
the raw text of the cells written, not their values: a formula travels
as `=SUM(B2:B4)` and the other side works out its own answer, so the two
cannot disagree about a number. `structure` carries an insert or a
delete itself, so both sides rewrite their formulas identically. `state`
carries the one part of one sheet that changed, the way `getState`
serialises it: the formats, a rule, the objects. `document` carries the
whole state, for what cannot be described piecemeal: a sheet added or
removed, a restore, the workbook's names, tables and calculation
settings; `resync()` sends the same kind. The shell follows its
document, so a delta applied from outside repaints the sheet.

There is no merge and no version number. When two people type into
the same cell at the same moment, the message that arrives second is
the one both of them end up seeing; when they type into different
cells, which is nearly always, nothing collides. A `cells` or `state`
delta can safely arrive twice; a `structure` delta cannot, since a
second insert inserts again, so a transport that may redeliver has to
drop duplicates on the way in.

Here the wire is two callbacks handing each delta straight to the other
stream, which is what a socket does with a network in between:

```svelte {runnable}
<script lang="ts">
  const left = claimsDoc()
  const right = createSheetDocument({ state: left.getState() })

  let inLeft = $state<SheetPresence[]>([])
  let inRight = $state<SheetPresence[]>([])
  let wire = $state<string[]>([])
  const describe = (d: { kind: string }) => d.kind

  const a = createDeltaStream(left, {
    onDelta: (delta) => { wire = [`A -> B: ${describe(delta)}`, ...wire].slice(0, 6); b.apply(delta) },
    onPresence: (who) => { inLeft = [who] },
  })
  const b = createDeltaStream(right, {
    onDelta: (delta) => { wire = [`B -> A: ${describe(delta)}`, ...wire].slice(0, 6); a.apply(delta) },
    onPresence: (who) => { inRight = [who] },
  })
  $effect(() => () => { a.stop(); b.stop() })
</script>

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
  <SvSheet document={left} height={300} rows={9} columns={7} showRibbon={false} presence={inLeft}
    onPresence={(me) => a.sendPresence({ id: 'ada', name: 'Ada', colour: '#2563eb', ...me })} />
  <SvSheet document={right} height={300} rows={9} columns={7} showRibbon={false} presence={inRight}
    onPresence={(me) => b.sendPresence({ id: 'grace', name: 'Grace', colour: '#15803d', ...me })} />
</div>
<p style="font-size: 12px; font-family: monospace">{wire.join(' · ') || 'Type in either sheet.'}</p>
```

Type in the left sheet and the right follows; the line under them is
what crossed the wire. Click a cell in one and the other shows a
coloured box with a name on it: that is presence.

## Presence: where everyone is

A delta says what someone typed; it says nothing about where they are,
and seeing where a colleague is is what keeps two people out of one
cell. That is the `presence` prop: the list of everyone else on the
workbook, each drawn on the active sheet as a coloured outline around
their selection with their name at the cursor. Your own position goes
out through `onPresence`, which fires on every move of the selection
with the sheet, the rectangle and the active cell; `sendPresence` puts
it on the same wire as the deltas, and on the far side it lands in the
stream's `onPresence`, never in the document.

That separation is deliberate. A cursor is a fact about a session, so
it is not in `getState()` and not in the file. A peer with no `colour`
is given a steady one from their id; one that has said nothing for
fifteen seconds is dropped, because a closed tab sends no goodbye. Every
arrow key is a new position, so throttle `onPresence` where the
transport bills per message.

<div data-docs-demo="488-sheet-collaboration" data-height="600"></div>

## See also

- [Files](./files.md) - `getState`, autosave, and why one person's autosave is the wrong thing for two.
- [Data validation](./validation.md) - the dropdowns the reviewer picks from on a protected sheet.
- [Real-time collaboration on the grid](../collaboration.md) - the same idea over a grid's rows.
- [The spreadsheet shell](../cells/spreadsheet-shell.md) - the Protect Sheet dialog line by line, and the delta kinds in full.
