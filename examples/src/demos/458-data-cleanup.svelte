<script lang="ts">
  /**
   * 458. Data cleanup: Text to Columns and Remove Duplicates
   * ---------------------------------------------------------
   * The first twenty minutes of every spreadsheet job: a CRM export landed
   * in column A, one contact per line, fields separated by semicolons, with
   * the same people in it twice. Two buttons on the Data tab fix it.
   *
   *   Text to Columns   Select column A, Data -> Text to Columns. The wizard
   *                     has already guessed the delimiter (guessDelimiter
   *                     scores tab, semicolon, comma, pipe and space by how
   *                     consistently each splits the column) and shows a
   *                     preview. Finish writes the fields into A..D.
   *   Remove Duplicates Data -> Remove Duplicates. Tick the columns that
   *                     decide identity (Excel compares case-insensitively,
   *                     so ANA.MARQUES@ and ana.marques@ are one person) and
   *                     get Excel's sentence back: "3 duplicate values found
   *                     and removed; 11 unique values remain."
   *
   * Both dialogs are this file's. The splitting, the delimiter guess and the
   * duplicate report come from the package, and both operations write
   * through the grid's command context inside `cmd.batch`, so each is ONE
   * Ctrl+Z: undo puts the whole column back, not one cell of it.
   */
  import { tick } from 'svelte'
  import { SvButton, SvModal } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import {
    SvSheet, createWorkbook,
    textToColumns, guessDelimiter, findDuplicates, colToLetters,
    type CellFormatEntry, type RibbonActionId,
  } from '@svgrid/enterprise'

  const RAW = [
    'Name; Email; City; Status',
    'Ana Marques; ana.marques@northwind.example; Lisbon; Customer',
    'Ben Okafor; ben.okafor@northwind.example; Lagos; Prospect',
    'Chloe Dubois; chloe.dubois@northwind.example; Lyon; Customer',
    'Ana Marques; ANA.MARQUES@northwind.example; Lisbon; Customer',
    'Dev Patel; dev.patel@northwind.example; Pune; Partner',
    'Emma Rossi; emma.rossi@northwind.example; Turin; Customer',
    'Ben Okafor; ben.okafor@northwind.example; Lagos; Prospect',
    'Felix Braun; felix.braun@northwind.example; Graz; Prospect',
    'Grace Liu; grace.liu@northwind.example; Taipei; Customer',
    'Emma Rossi;  emma.rossi@northwind.example ; Turin; Customer',
    'Hugo Silva; hugo.silva@northwind.example; Porto; Partner',
    'Iris Novak; iris.novak@northwind.example; Ljubljana; Customer',
    'Grace Liu; grace.liu@northwind.example; Taipei; Prospect',
    'Jonas Berg; jonas.berg@northwind.example; Oslo; Customer',
  ]
  const wb = createWorkbook([{ name: 'Import', cells: RAW.map((line) => [line]) }])

  const formats: Record<string, CellFormatEntry> = {
    A1: { bold: true, fill: '#e2e8f0', color: '#0f172a' },
  }

  // ---- shared: the block of data around the selection ---------------------
  type Block = { top: number; left: number; bottom: number; right: number }

  /** The used rows of the sheet from the selection's column rightwards, the
   *  way Excel's "current region" grows a selection to its data. */
  function blockAround(cmd: GridCommandContext): Block {
    const range = cmd.ranges[cmd.ranges.length - 1]
    const left = range ? range[1] : (cmd.activeCell?.colIndex ?? 0)
    const bottom = Math.max(wb.rowCount(wb.active) - 1, 0)
    const right = Math.max(wb.colCount(wb.active) - 1, left)
    return { top: 0, left, bottom, right }
  }

  const raw = (r: number, c: number) => wb.getRaw(wb.active, r, c)

  /** Focus goes back to the sheet once a dialog is gone - after the modal
   *  has returned it to the ribbon button, which it does as it unmounts. */
  async function refocus(cmd: GridCommandContext | null) {
    await tick()
    cmd?.focus()
  }

  // ---- Text to Columns ----------------------------------------------------
  const DELIMITERS = [
    { id: 'tab', label: 'Tab', sep: '\t' },
    { id: 'semicolon', label: 'Semicolon', sep: ';' },
    { id: 'comma', label: 'Comma', sep: ',' },
    { id: 'space', label: 'Space', sep: ' ' },
    { id: 'other', label: 'Other', sep: '' },
  ] as const
  type DelimiterId = (typeof DELIMITERS)[number]['id']

  let splitOpen = $state(false)
  let delimiter = $state<DelimiterId>('semicolon')
  let other = $state('|')
  let collapse = $state(false)
  let trim = $state(true)
  let splitCmd: GridCommandContext | null = null
  let column = $state<{ index: number; texts: string[] }>({ index: 0, texts: [] })

  const separator = $derived(
    delimiter === 'other' ? other : DELIMITERS.find((d) => d.id === delimiter)!.sep,
  )
  const preview = $derived.by(() =>
    textToColumns(column.texts.slice(0, 6), {
      delimiters: separator ? [separator] : [','],
      collapse,
      trim,
    }),
  )

  function openSplit(cmd: GridCommandContext) {
    const block = blockAround(cmd)
    const texts = Array.from({ length: block.bottom - block.top + 1 }, (_, i) => raw(block.top + i, block.left))
    column = { index: block.left, texts }
    // Guess first, so the common case is Finish without touching anything.
    const guess = guessDelimiter(texts.filter((t) => t !== ''))
    const known = DELIMITERS.find((d) => d.sep === guess && d.id !== 'other')
    if (known) delimiter = known.id
    else if (guess) { delimiter = 'other'; other = guess }
    splitCmd = cmd
    splitOpen = true
  }

  function finishSplit() {
    const cmd = splitCmd
    if (!cmd) return
    const { rows, width } = textToColumns(column.texts, {
      delimiters: separator ? [separator] : [','],
      collapse,
      trim,
    })
    cmd.batch(() => {
      rows.forEach((fields, r) => {
        for (let c = 0; c < width; c += 1) {
          cmd.setCellValue(r, column.index + c, fields[c] ?? '')
        }
      })
    })
    cmd.setSelection(0, column.index)
    cmd.extendSelection(rows.length - 1, column.index + width - 1)
    // Column A was as wide as the lines it held; the fields it now holds
    // are not, and the email column needs the room instead.
    const widths = [150, 250, 110, 100]
    for (let c = 0; c < width; c += 1) {
      cmd.api.setColumnWidth(colToLetters(column.index + c), widths[c] ?? 104)
    }
    splitOpen = false
    void refocus(cmd)
    message = `Split ${rows.length} rows into ${width} columns.`
  }

  // ---- Remove Duplicates --------------------------------------------------
  let dupOpen = $state(false)
  let hasHeaders = $state(true)
  let dupCmd: GridCommandContext | null = null
  let block = $state<Block>({ top: 0, left: 0, bottom: 0, right: 0 })
  let chosen = $state<boolean[]>([])
  let message = $state<string | null>(null)

  const headers = $derived.by(() =>
    Array.from({ length: block.right - block.left + 1 }, (_, i) =>
      hasHeaders ? raw(block.top, block.left + i) || `Column ${i + 1}` : `Column ${i + 1}`),
  )

  function openDuplicates(cmd: GridCommandContext) {
    block = blockAround(cmd)
    chosen = Array.from({ length: block.right - block.left + 1 }, () => true)
    dupCmd = cmd
    dupOpen = true
  }

  function removeDuplicates() {
    const cmd = dupCmd
    if (!cmd) return
    const first = hasHeaders ? block.top + 1 : block.top
    const width = block.right - block.left + 1
    const rows = Array.from({ length: block.bottom - first + 1 }, (_, i) =>
      Array.from({ length: width }, (_, c) => raw(first + i, block.left + c)),
    )
    const columns = chosen.flatMap((on, i) => (on ? [i] : []))
    const report = findDuplicates(rows, { columns })
    // Excel's dialog says this whether or not it found anything, and the
    // sentence is most of what the feature is.
    message = `${report.remove.length} duplicate values found and removed; ${report.keep.length} unique values remain.`
    dupOpen = false
    void refocus(cmd)
    if (report.remove.length === 0) return
    const kept = report.keep.map((i) => rows[i]!)
    cmd.batch(() => {
      // Survivors close up from the top; the rows they vacated go blank.
      for (let i = 0; i < rows.length; i += 1) {
        const source = kept[i]
        for (let c = 0; c < width; c += 1) {
          cmd.setCellValue(first + i, block.left + c, source ? source[c] ?? '' : '')
        }
      }
    })
    cmd.setSelection(block.top, block.left)
    cmd.extendSelection(first + kept.length - 1, block.right)
  }

  // Returning true takes the action over; the shell carries both dialogs
  // itself and would open its own as well otherwise.
  function onAction(action: RibbonActionId, cmd: GridCommandContext): boolean {
    if (action === 'text-to-columns') openSplit(cmd)
    else if (action === 'remove-duplicates') openDuplicates(cmd)
    else return false
    return true
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet
    workbook={wb}
    height="100%"
    rows={18}
    columns={8}
    columnWidths={{ A: 440 }}
    {formats}
    {onAction}
  />
  <p class="note shrink-0" aria-live="polite">
    {#if message}
      <strong>{message}</strong> Ctrl+Z puts it back in one step.
    {:else}
      Click anywhere in column A, then <strong>Data -> Text to Columns</strong>
      and Finish. Then <strong>Data -> Remove Duplicates</strong>: with every
      column ticked it finds three; untick Status and Grace Liu's second row,
      the same person with a different status, goes too.
    {/if}
  </p>
</section>

<SvModal bind:open={splitOpen} onClose={() => refocus(splitCmd)} title="Convert Text to Columns Wizard" size="md">
  <div class="wizard">
    <p class="lead">Choose the delimiter your data contains. The preview shows how it splits.</p>
    <fieldset class="group">
      <legend>Delimiters</legend>
      {#each DELIMITERS as d (d.id)}
        <label class="radio">
          <input type="radio" name="delimiter" value={d.id} bind:group={delimiter} />
          {d.label}
          {#if d.id === 'other'}
            <input class="other" type="text" maxlength="1" bind:value={other} aria-label="Other delimiter" />
          {/if}
        </label>
      {/each}
    </fieldset>
    <label class="check"><input type="checkbox" bind:checked={collapse} /> Treat consecutive delimiters as one</label>
    <label class="check"><input type="checkbox" bind:checked={trim} /> Trim spaces around each field</label>
    <div class="preview" aria-label="Data preview">
      <table>
        <tbody>
          {#each preview.rows as fields, i (i)}
            <tr>{#each fields as field, j (j)}<td>{field}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="quiet">
      {column.texts.length} rows in column {colToLetters(column.index)}
      -> {preview.width} columns, starting at column {colToLetters(column.index)}.
      Anything already in those columns is replaced.
    </p>
  </div>
  {#snippet footer()}
    <SvButton variant="ghost" onclick={() => { splitOpen = false; void refocus(splitCmd) }}>Cancel</SvButton>
    <SvButton onclick={finishSplit}>Finish</SvButton>
  {/snippet}
</SvModal>

<SvModal bind:open={dupOpen} onClose={() => refocus(dupCmd)} title="Remove Duplicates" size="sm">
  <div class="wizard">
    <p class="lead">To delete duplicate values, select one or more columns that contain duplicates.</p>
    <div class="row">
      <SvButton variant="outline" size="sm" onclick={() => (chosen = chosen.map(() => true))}>Select All</SvButton>
      <SvButton variant="outline" size="sm" onclick={() => (chosen = chosen.map(() => false))}>Unselect All</SvButton>
      <label class="check headers"><input type="checkbox" bind:checked={hasHeaders} /> My data has headers</label>
    </div>
    <fieldset class="group columns">
      <legend>Columns</legend>
      {#each headers as header, i (i)}
        <label class="check"><input type="checkbox" bind:checked={chosen[i]} /> {header}</label>
      {/each}
    </fieldset>
  </div>
  {#snippet footer()}
    <SvButton variant="ghost" onclick={() => { dupOpen = false; void refocus(dupCmd) }}>Cancel</SvButton>
    <SvButton onclick={removeDuplicates} disabled={!chosen.some(Boolean)}>OK</SvButton>
  {/snippet}
</SvModal>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }

  .wizard { display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .lead { margin: 0; }
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 0;
    padding: 8px 12px 10px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
  }
  .group legend { padding: 0 4px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .group.columns { flex-direction: column; gap: 6px; }
  .radio, .check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .other {
    width: 2.2em;
    font: inherit;
    text-align: center;
    padding: 2px 4px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 4px;
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
  }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .headers { margin-left: auto; }
  .preview {
    max-height: 170px;
    overflow: auto;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-header-bg, #f8fafc);
  }
  .preview table { border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
  .preview td {
    padding: 3px 8px;
    border-right: 1px solid var(--sg-border, #e2e8f0);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    white-space: nowrap;
  }
  .quiet { margin: 0; font-size: 12px; color: var(--sg-muted, #64748b); }
</style>
