<script lang="ts">
  /**
   * 207. Blank sheet - just start typing
   * -------------------------------------
   * An empty Excel-looking sheet built on a plain <SvGrid responsive={true}>: column-letter
   * headers (A..J), the grid's own row-number gutter (showRowNumbers), inline
   * cell editing, cell-range selection + fill handle, and drag-resizable rows
   * (rowResize) and columns (native header handle). Above it, a name box +
   * formula bar with Excel-style function autocomplete so you never have to
   * remember a signature.
   *
   * A real formula engine (HyperFormula) computes the display values; the grid
   * holds the RAW text (a literal or a formula like =SUM(B2:B5)).
   */
  import { onDestroy, tick } from 'svelte'
  import { HyperFormula } from 'hyperformula'
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    rowResize,
    createHyperFormulaSheet,
    type ColumnDef,
    type HyperFormulaInstance,
    type HyperFormulaSheet,
  } from '@svgrid/grid'

  // Excel column letters A, B, C ... for n columns.
  function colLetters(n: number): string[] {
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  }
  const letters = colLetters(26) // A..Z
  type Row = Record<string, unknown>

  const ROWS = 200
  const empty = (): Row => Object.fromEntries(letters.map((c) => [c, ''])) as Row
  const seed: Row[] = Array.from({ length: ROWS }, empty)
  const put = (row: number, col: string, v: unknown) => { seed[row - 1]![col] = v }

  // A tiny seeded example so the sheet invites editing. Row 1 is the header
  // band (Jan / Feb / Mar) exactly as you'd label months in Excel.
  put(1, 'A', 'Category'); put(1, 'B', 'Jan'); put(1, 'C', 'Feb'); put(1, 'D', 'Mar'); put(1, 'E', 'Total')
  put(2, 'A', 'Rent');      put(2, 'B', 2400); put(2, 'C', 2400); put(2, 'D', 2400); put(2, 'E', '=SUM(B2:D2)')
  put(3, 'A', 'Payroll');   put(3, 'B', 18200); put(3, 'C', 18900); put(3, 'D', 19500); put(3, 'E', '=SUM(B3:D3)')
  put(4, 'A', 'Cloud');     put(4, 'B', 940); put(4, 'C', 1010); put(4, 'D', 1180); put(4, 'E', '=SUM(B4:D4)')
  put(5, 'A', 'Marketing'); put(5, 'B', 3200); put(5, 'C', 2750); put(5, 'D', 4100); put(5, 'E', '=SUM(B5:D5)')
  put(6, 'A', 'Total');     put(6, 'B', '=SUM(B2:B5)'); put(6, 'C', '=SUM(C2:C5)'); put(6, 'D', '=SUM(D2:D5)'); put(6, 'E', '=SUM(E2:E5)')
  put(8, 'A', 'Avg / month'); put(8, 'B', '=ROUND(E6/3,0)')
  put(9, 'A', 'Burn vs 30k'); put(9, 'B', '=IF(B8>30000,"over","ok")')

  // ---- HyperFormula ----
  const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
  hf.addSheet('Sheet1')
  const sheet: HyperFormulaSheet<Row> = createHyperFormulaSheet({
    hyperformula: hf as unknown as HyperFormulaInstance,
    rows: seed.map((r) => ({ ...r })),
    fields: letters as unknown as ReadonlyArray<keyof Row & string>,
  })
  let raw = $state<Row[]>(sheet.raw)
  let computed = $state<Row[]>(sheet.computed)
  const features = tableFeatures({})

  function commitCell(rowIndex: number, columnId: string, value: unknown) {
    let next: unknown = value
    if (typeof next === 'string' && next.trim() !== '' && !next.trim().startsWith('=')) {
      const n = Number(next)
      if (Number.isFinite(n)) next = n
    }
    const snap = sheet.update(rowIndex, columnId, next)
    computed = snap.computed
    raw = snap.raw
  }
  onDestroy(() => sheet.destroy())

  function fmt(v: unknown): string {
    if (v == null || v === '') return ''
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toLocaleString('en-US', { maximumFractionDigits: 4 })
    return String(v)
  }
  const isFormula = (v: unknown) => typeof v === 'string' && v.startsWith('=')

  const columns: ColumnDef<typeof features, Row>[] = letters.map((letter) => ({
    field: letter,
    header: letter,
    width: letter === 'A' ? 160 : 88,
    editorType: 'text',
    cellClass: (ctx: { row: { index: number } }) => (ctx.row.index === 0 ? 'sheet-head' : ''),
    cell: (ctx: { row: { index: number } }) =>
      renderSnippet(Cell, {
        rawValue: raw[ctx.row.index]?.[letter],
        computedValue: computed[ctx.row.index]?.[letter],
      }),
  }))

  // ---- Row resize (drag a row's bottom edge) ----
  let heights = $state<Record<number, number>>({})
  const rowHeight = (i: number) => heights[i] ?? 24
  const onRowResize = (i: number, h: number) => (heights = { ...heights, [i]: h })

  // ---- Formula bar + Excel-style autocomplete ----
  const FUNCTIONS: { name: string; sig: string; desc: string }[] = [
    { name: 'SUM', sig: 'SUM(range)', desc: 'Add up numbers' },
    { name: 'AVERAGE', sig: 'AVERAGE(range)', desc: 'Mean of a range' },
    { name: 'COUNT', sig: 'COUNT(range)', desc: 'How many numbers' },
    { name: 'MIN', sig: 'MIN(range)', desc: 'Smallest value' },
    { name: 'MAX', sig: 'MAX(range)', desc: 'Largest value' },
    { name: 'IF', sig: 'IF(test, then, else)', desc: 'Branch on a condition' },
    { name: 'ROUND', sig: 'ROUND(number, digits)', desc: 'Round to digits' },
    { name: 'SUMIF', sig: 'SUMIF(range, criteria)', desc: 'Sum cells that match' },
    { name: 'COUNTIF', sig: 'COUNTIF(range, criteria)', desc: 'Count cells that match' },
    { name: 'ABS', sig: 'ABS(number)', desc: 'Absolute value' },
  ]

  let api = $state<{ selectCells: (r: readonly (readonly [number, number, number, number])[]) => void } | null>(null)
  let activeRow = $state(0)
  let activeCol = $state('A')
  let editing = $state(false)
  let draft = $state('')
  let caret = $state(0)
  let sugIndex = $state(0)
  let dismissed = $state(false)
  let inputEl: HTMLInputElement | null = null

  const address = $derived(`${activeCol}${activeRow + 1}`)
  const activeRaw = $derived(String(raw[activeRow]?.[activeCol] ?? ''))
  const token = $derived.by(() => {
    if (!editing || !draft.startsWith('=')) return ''
    return draft.slice(0, caret).match(/([A-Za-z]+)$/)?.[1] ?? ''
  })
  const suggestions = $derived.by(() => {
    if (pickerOpen || dismissed || !editing || !draft.startsWith('=')) return []
    const t = token.toUpperCase()
    if (t) return FUNCTIONS.filter((f) => f.name.startsWith(t)).slice(0, 8)
    const prev = draft.slice(0, caret).slice(-1)
    return prev === '=' || prev === '(' || '+-*/,'.includes(prev) ? FUNCTIONS.slice(0, 8) : []
  })
  $effect(() => { if (sugIndex >= suggestions.length) sugIndex = 0 })

  function sync(e: Event) {
    const el = e.currentTarget as HTMLInputElement
    caret = el.selectionStart ?? el.value.length
    if (e.type === 'input') dismissed = false
  }
  function openBar() {
    draft = activeRaw
    editing = true
    dismissed = false
    tick().then(() => { inputEl?.focus(); caret = draft.length })
  }
  function commitBar() {
    if (!editing) return
    commitCell(activeRow, activeCol, draft)
    editing = false
  }
  function accept(i = sugIndex) {
    const fn = suggestions[i]
    if (!fn) return
    const upto = draft.slice(0, caret)
    const start = upto.length - token.length
    const inserted = fn.name + '('
    draft = upto.slice(0, start) + inserted + draft.slice(caret)
    const next = start + inserted.length
    tick().then(() => { inputEl?.focus(); inputEl?.setSelectionRange(next, next); caret = next })
  }
  function onKey(e: KeyboardEvent) {
    if (suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sugIndex = (sugIndex + 1) % suggestions.length; return }
      if (e.key === 'ArrowUp') { e.preventDefault(); sugIndex = (sugIndex - 1 + suggestions.length) % suggestions.length; return }
      if (e.key === 'Tab' || (e.key === 'Enter' && token)) { e.preventDefault(); accept(); return }
      if (e.key === 'Escape') { e.preventDefault(); dismissed = true; return }
    }
    if (e.key === 'Enter') { e.preventDefault(); commitBar() }
    else if (e.key === 'Escape') { e.preventDefault(); editing = false }
  }

  // ---- Function picker (a browsable dropdown, not just type-ahead) ----
  let pickerOpen = $state(false)
  function insertFunction(name: string) {
    pickerOpen = false
    dismissed = true
    const doInsert = () => {
      if (!draft.startsWith('=')) draft = '='
      const pos = caret > 0 && caret <= draft.length ? caret : draft.length
      const before = draft.slice(0, pos)
      draft = before + name + '(' + draft.slice(pos)
      const next = before.length + name.length + 1
      tick().then(() => { inputEl?.focus(); inputEl?.setSelectionRange(next, next); caret = next })
    }
    if (!editing) {
      draft = activeRaw.startsWith('=') ? activeRaw : '='
      editing = true
      tick().then(() => { caret = draft.length; doInsert() })
    } else {
      doInsert()
    }
  }
  $effect(() => {
    if (!pickerOpen) return
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement)?.closest('.fx')) pickerOpen = false }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  })
</script>

{#snippet Cell({ rawValue, computedValue }: { rawValue: unknown; computedValue: unknown })}
  <span class="cellv" class:is-formula={isFormula(rawValue)} title={isFormula(rawValue) ? String(rawValue) : ''}>{fmt(computedValue)}</span>
{/snippet}

<section class="sheet-demo">
  <header class="bs-head">
    <h1 class="bs-title">Blank sheet</h1>
    <p class="bs-sub">
      A real spreadsheet on a plain <code>&lt;SvGrid&gt;</code>. Click any cell and type a value
      or a formula (<code>=SUM(B2:B5)</code>, <code>=IF(B8&gt;30000,"over","ok")</code>) - start with
      <code>=</code> in the formula bar and pick a function from the list. Drag the fill handle to
      extend a series; drag a row or column border to resize.
    </p>
  </header>

  <div class="fx">
    <span class="fx-addr">{address}</span>
    <button type="button" class="fx-glyph fx-pick" class:open={pickerOpen} title="Insert function"
      aria-label="Insert function" aria-expanded={pickerOpen}
      onmousedown={(e) => { e.preventDefault(); pickerOpen = !pickerOpen }}>f<i>x</i><span class="fx-caret">▾</span></button>
    {#if editing}
      <input bind:this={inputEl} bind:value={draft} class="fx-input" spellcheck="false" autocomplete="off"
        oninput={sync} onkeyup={sync} onclick={sync} onkeydown={onKey} onblur={commitBar} />
    {:else}
      <button type="button" class="fx-display" class:empty={activeRaw === ''} onclick={openBar}>{activeRaw}</button>
    {/if}
    {#if editing && suggestions.length}
      <ul class="fx-suggest" role="listbox">
        {#each suggestions as f, i (f.name)}
          <li>
            <button type="button" class="fx-item" class:active={i === sugIndex} role="option" aria-selected={i === sugIndex}
              onmousedown={(e) => { e.preventDefault(); accept(i) }} onmouseenter={() => (sugIndex = i)}>
              <span class="fx-name">{f.name}</span>
              <span class="fx-sig">{f.sig}</span>
              <span class="fx-desc">{f.desc}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if pickerOpen}
      <ul class="fx-suggest fx-picker" role="listbox">
        {#each FUNCTIONS as f (f.name)}
          <li>
            <button type="button" class="fx-item" role="option" aria-selected="false" onmousedown={(e) => { e.preventDefault(); insertFunction(f.name) }}>
              <span class="fx-name">{f.name}</span>
              <span class="fx-sig">{f.sig}</span>
              <span class="fx-desc">{f.desc}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sheet" use:rowResize={{ onResize: onRowResize, min: 20, max: 320 }}>
    <SvGrid responsive={true}
      columnResize
      data={raw}
      columns={columns}
      features={features}
      sortable={false}
      filterable={false}
      selectionMode="cell"
      showRowNumbers={true}
      rowNumberWidth={46}
      showColumnFilters={false}
      showRowSelection={false}
      enableInlineEditing={true}
      enableRowHover={false}
      enableCellSelection={true}
      contextMenu={['copy', 'cut', 'paste', 'clear']}
      rowHeight={rowHeight}
      containerHeight="100%"
      fitColumns={false}
      onApiReady={(a) => (api = a as never)}
      onActiveCellChange={(e) => { activeRow = e.rowIndex; if (e.columnId) activeCol = e.columnId }}
      onCellValueChange={(e) => { if (e.columnId !== '__rownum__') commitCell(e.rowIndex, e.columnId, e.newValue) }}
    />
  </div>
</section>

<!-- All styling is the shared `.sheet-demo` chrome in src/index.css -->

