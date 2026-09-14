<script lang="ts">
  /**
   * 436. Paste Special, Find and Replace, insert and delete
   * --------------------------------------------------------
   * The three Excel operations that write more than one cell, each of which
   * is ONE Ctrl+Z.
   *
   *   Paste Special   Copy a block, then paste it back as values, formulas,
   *                   formats, transposed, or arithmetic against what is
   *                   already there. Copying also writes a text/html flavour,
   *                   so a paste into Excel keeps the formatting and a paste
   *                   back in keeps the formula.
   *   Find / Replace  Ctrl+H. Searching looks at what you SEE; replacing
   *                   writes what you TYPED, so replacing a number that a
   *                   formula produced does not destroy the formula.
   *   Insert / Delete Ctrl+Shift+Plus and Ctrl+Minus over a full-width
   *                   selection. Every formula on the sheet is rewritten:
   *                   inserting above =SUM(B1:B4) widens it to B1:B5 instead
   *                   of silently dropping the new row from the total.
   */
  import { SvGrid, tableFeatures, renderSnippet, type GridColumns } from '@svgrid/grid'
  import {
    enableSheet,
    setStructureTarget, setFindTarget, setFormatTarget,
    findAll, replaceAll, insertRows, deleteRows,
    buildClipboardPayload, parseClipboard, planPaste, resolvePasteCell,
    createFormatStore, entryToStyle,
    parseFormula, evaluateFormula, formatCellValue, withCustomFunctions,
    type ClipboardGrid, type PasteSpecialOptions, type SheetCellValue,
  } from '@svgrid/enterprise'

  enableSheet()

  const FIELDS = ['a', 'b', 'c', 'd'] as const
  type Field = (typeof FIELDS)[number]
  type Row = { id: string } & Record<Field, string>

  const start = (): Row[] => [
    { id: 'r1', a: 'Jan', b: '120', c: '4',  d: '=B1*C1' },
    { id: 'r2', a: 'Feb', b: '90',  c: '6',  d: '=B2*C2' },
    { id: 'r3', a: 'Mar', b: '150', c: '3',  d: '=B3*C3' },
    { id: 'r4', a: 'Apr', b: '110', c: '5',  d: '=B4*C4' },
    { id: 'r5', a: 'Q1',  b: '=SUM(B1:B4)', c: '', d: '=SUM(D1:D4)' },
  ]

  let rows = $state<Row[]>(start())
  let active = $state({ rowIndex: 0, colIndex: 3 })
  let selection = $state<readonly [number, number, number, number]>([0, 0, 3, 3])
  let version = $state(0)
  let log = $state<string[]>([])
  let clipboard = $state<{ grid: ClipboardGrid; origin: { row: number; col: number } } | null>(null)
  let what = $state<PasteSpecialOptions['what']>('all')
  let operation = $state<PasteSpecialOptions['operation']>('none')
  let transpose = $state(false)
  let findText = $state('120')
  let replaceText = $state('999')
  let lookIn = $state<'values' | 'formulas'>('values')

  const store = createFormatStore()
  const functions = withCustomFunctions(undefined)

  const lookup = {
    rowIdAt: (i: number) => rows[i]?.id ?? null,
    columnIdAt: (i: number) => FIELDS[i] ?? null,
  }
  store.set([[4, 0, 4, 3]], { bold: true, fill: '#eef2ff' }, lookup)

  function raw(r: number, c: number): string {
    const field = FIELDS[c]
    return field ? (rows[r]?.[field] ?? '') : ''
  }
  function setRaw(r: number, c: number, text: string) {
    const field = FIELDS[c]
    if (!field || !rows[r]) return
    rows = rows.map((row, i) => (i === r ? { ...row, [field]: text } : row))
  }

  const ctx = {
    resolve: (_s: string | null, r: number, c: number): SheetCellValue => {
      if (r < 0 || r >= rows.length || c < 0 || c >= FIELDS.length) return { error: '#REF!' }
      return compute(r, c)
    },
    lastRow: () => rows.length - 1,
    functions,
  }
  function compute(r: number, c: number): SheetCellValue {
    const text = raw(r, c).trim()
    if (text === '') return ''
    if (!text.startsWith('=')) {
      const n = Number(text)
      return Number.isFinite(n) ? n : text
    }
    try { return evaluateFormula(parseFormula(text), ctx) } catch { return { error: '#PARSE!' } }
  }
  const shown = (r: number, c: number) => { void version; return formatCellValue(compute(r, c)) }

  // The command context the enterprise helpers take. In a real app this comes
  // from the grid through registerGridShortcuts; the demo builds one directly
  // so the buttons drive the same code paths the keys do.
  function cmd() {
    return {
      api: {},
      editing: false,
      activeCell: { ...active, columnId: FIELDS[active.colIndex] ?? null },
      rowCount: rows.length,
      colCount: FIELDS.length,
      ranges: [selection],
      columnIdAt: (c: number) => FIELDS[c] ?? null,
      getCellValue: (r: number, c: number) => compute(r, c),
      setCellValue: (r: number, c: number, v: unknown) => setRaw(r, c, String(v)),
      setActiveCell: (r: number, c: number) => (active = { rowIndex: r, colIndex: c }),
      setSelection: () => {},
      extendSelection: () => {},
      scrollIntoView: () => {},
      startEditing: () => true,
      // One batch = one undo in a real grid; here it just runs the writes.
      batch: <T,>(fn: () => T) => fn(),
    } as never
  }

  setFindTarget({
    getRaw: raw,
    getDisplay: (r, c) => shown(r, c),
    setRaw,
    onChange: () => (version += 1),
  })
  setFormatTarget({ store, lookup, onChange: () => (version += 1) })
  setStructureTarget({
    getRaw: raw,
    setRaw,
    format: { store, lookup },
    apply: (edit) => {
      const blank = (): Row => ({ id: `n${Date.now()}${Math.random()}`, a: '', b: '', c: '', d: '' })
      if (edit.kind === 'insertRows') {
        const next = rows.slice()
        next.splice(edit.at, 0, ...Array.from({ length: edit.count }, blank))
        rows = next
      } else if (edit.kind === 'deleteRows') {
        const next = rows.slice()
        next.splice(edit.at, edit.count)
        rows = next
      }
      // Column edits would reshape FIELDS; out of scope for this demo.
      version += 1
    },
    onChange: () => (version += 1),
  })

  function copySelection() {
    const [minRow, minCol, maxRow, maxCol] = selection
    const grid: ClipboardGrid = []
    for (let r = minRow; r <= maxRow; r += 1) {
      const line = []
      for (let c = minCol; c <= maxCol; c += 1) {
        const text = raw(r, c)
        const rowId = rows[r]?.id
        const columnId = FIELDS[c]
        line.push({
          text: shown(r, c),
          ...(text.startsWith('=') ? { formula: text } : {}),
          ...(rowId && columnId ? { format: store.get(rowId, columnId) } : {}),
        })
      }
      grid.push(line)
    }
    clipboard = { grid, origin: { row: minRow, col: minCol } }
    const payload = buildClipboardPayload(grid, clipboard.origin)
    log = [`copied ${grid.length}x${grid[0]?.length ?? 0}  (${payload.html.length} bytes of HTML)`, ...log].slice(0, 6)
  }

  function pasteSpecial() {
    if (!clipboard) { log = ['copy something first', ...log].slice(0, 6); return }
    const opts: PasteSpecialOptions = { what, operation, transpose }
    const plan = planPaste(clipboard.grid, { row: active.rowIndex, col: active.colIndex }, opts, clipboard.origin)
    let wrote = 0
    for (const entry of plan) {
      if (entry.row >= rows.length || entry.col >= FIELDS.length) continue
      const decision = resolvePasteCell(entry.source, compute(entry.row, entry.col), opts, entry.offset)
      if (decision.kind === 'skip') continue
      if (decision.kind === 'value' || decision.kind === 'both') {
        setRaw(entry.row, entry.col, decision.value)
        wrote += 1
      }
      if ((decision.kind === 'format' || decision.kind === 'both') && decision.format) {
        store.set([[entry.row, entry.col, entry.row, entry.col]], decision.format, lookup)
      }
    }
    version += 1
    log = [`pasted ${what}${operation !== 'none' ? ` (${operation})` : ''}${transpose ? ' transposed' : ''}: ${wrote} cells`, ...log].slice(0, 6)
  }

  function doReplaceAll() {
    const n = replaceAll(cmd(), findText, replaceText, { lookIn })
    version += 1
    log = [`replaced ${n} cell${n === 1 ? '' : 's'} (looking in ${lookIn})`, ...log].slice(0, 6)
  }

  function doInsert() {
    insertRows(cmd(), active.rowIndex, 1)
    log = [`inserted a row at ${active.rowIndex + 1}; formulas rewritten`, ...log].slice(0, 6)
  }

  function doDelete() {
    if (rows.length <= 1) return
    deleteRows(cmd(), active.rowIndex, 1)
    log = [`deleted row ${active.rowIndex + 1}; formulas rewritten`, ...log].slice(0, 6)
  }

  function doFind() {
    const hits = findAll(cmd(), findText, { lookIn })
    log = [`found ${hits.length} match${hits.length === 1 ? '' : 'es'} in ${lookIn}`, ...log].slice(0, 6)
  }

  const features = tableFeatures({})
  const columns = $derived<GridColumns<Row>>(
    FIELDS.map((field, c) => ({
      id: field,
      field,
      header: String.fromCharCode(65 + c),
      width: 120,
      editable: false,
      cell: (cc: { row: { index: number } }) => renderSnippet(Cell, { r: cc.row.index, c }),
    })),
  )
</script>

{#snippet Cell(props: { r: number; c: number })}
  {@const rowId = rows[props.r]?.id}
  {@const columnId = FIELDS[props.c]}
  {@const entry = rowId && columnId ? store.get(rowId, columnId) : undefined}
  {@const isActive = active.rowIndex === props.r && active.colIndex === props.c}
  <button
    type="button" class="cell" class:active={isActive}
    style={entryToStyle(entry)}
    title={raw(props.r, props.c)}
    onclick={() => (active = { rowIndex: props.r, colIndex: props.c })}
  >{shown(props.r, props.c)}</button>
{/snippet}

<section class="wrap">
  <div class="panel">
    <fieldset>
      <legend>Paste Special</legend>
      <button type="button" onclick={copySelection}>Copy A1:D4</button>
      <label>What
        <select bind:value={what}>
          <option value="all">all</option>
          <option value="values">values</option>
          <option value="formulas">formulas</option>
          <option value="formats">formats</option>
        </select>
      </label>
      <label>Operation
        <select bind:value={operation}>
          <option value="none">none</option>
          <option value="add">add</option>
          <option value="subtract">subtract</option>
          <option value="multiply">multiply</option>
          <option value="divide">divide</option>
        </select>
      </label>
      <label><input type="checkbox" bind:checked={transpose} /> transpose</label>
      <button type="button" onclick={pasteSpecial}>Paste at the active cell</button>
    </fieldset>

    <fieldset>
      <legend>Find and Replace</legend>
      <label>Find <input bind:value={findText} size="8" /></label>
      <label>Replace <input bind:value={replaceText} size="8" /></label>
      <label>Look in
        <select bind:value={lookIn}>
          <option value="values">values</option>
          <option value="formulas">formulas</option>
        </select>
      </label>
      <button type="button" onclick={doFind}>Find all</button>
      <button type="button" onclick={doReplaceAll}>Replace all</button>
    </fieldset>

    <fieldset>
      <legend>Structure</legend>
      <button type="button" onclick={doInsert}>Insert row above</button>
      <button type="button" onclick={doDelete}>Delete row</button>
      <button type="button" onclick={() => { rows = start(); version += 1; log = [] }}>Reset</button>
    </fieldset>
  </div>

  <SvGrid
    data={rows}
    {columns}
    {features}
    selectionMode="cell"
    enableCellSelection={true}
    filterMode="none"
    containerHeight={230}
  />

  <ul class="log">
    {#each log as line, i (i)}<li>{line}</li>{/each}
  </ul>

  <p class="note">
    Column D holds <code>=B*C</code> and row 5 holds <code>=SUM(...)</code>.
    Insert a row above row 2 and watch the SUM widen rather than drop the new
    row. Replace <code>120</code> looking in <strong>values</strong> and the
    formulas survive; look in <strong>formulas</strong> to rewrite the source
    instead.
  </p>
</section>

<style>
  .wrap { display: flex; flex-direction: column; gap: 10px; }
  .panel { display: flex; flex-wrap: wrap; gap: 10px; }
  fieldset {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    border: 1px solid var(--sg-color-border, #e2e8f0);
    border-radius: 6px; padding: 6px 10px; font-size: 12px;
  }
  legend { padding: 0 4px; color: var(--sg-color-muted, #64748b); }
  label { display: inline-flex; align-items: center; gap: 4px; }
  select, input { font: inherit; }
  button {
    font: inherit; padding: 3px 8px; border-radius: 5px; cursor: pointer;
    border: 1px solid var(--sg-color-border, #cbd5e1);
    background: var(--sg-color-surface, #fff); color: inherit;
  }
  .cell {
    display: block; width: 100%; height: 100%; text-align: inherit;
    font: inherit; border: 0; background: transparent; color: inherit;
    padding: 0 2px; cursor: pointer;
  }
  .cell.active { box-shadow: inset 0 0 0 2px var(--sg-color-accent, #6366f1); border-radius: 2px; }
  .log {
    margin: 0; padding: 0; list-style: none;
    font-family: ui-monospace, Menlo, monospace; font-size: 11px;
    color: var(--sg-color-muted, #64748b); min-height: 16px;
  }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-color-muted, #64748b); }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
</style>
