<script lang="ts">
  /**
   * 211. Financial model (loan amortization)
   * -----------------------------------------
   * A real analyst model on a plain <SvGrid responsive={true}>. Three blue INPUT cells (Principal,
   * APR, Term) drive a full 360-month amortization schedule built entirely from
   * formulas: PMT for the fixed payment, then per-period interest / principal /
   * running balance that each reference the row above. Change an input and all
   * 360 rows plus the summary recompute. A name box + formula bar (with function
   * autocomplete) lets you edit any cell's formula.
   */
  import { onDestroy, tick } from 'svelte'
  import { HyperFormula } from 'hyperformula'
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    rowResize,
    createHyperFormulaSheet,
    type GridColumns,
    type HyperFormulaInstance,
    type HyperFormulaSheet,
  } from '@svgrid/grid'

  function colLetters(n: number): string[] {
    return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  }
  const letters = colLetters(12) // A=#, B=Payment, C=Interest, D=Principal, E=Balance, F..L empty
  type Row = Record<string, unknown>
  const PERIODS = 360
  const SCHED = 9 // 1-based row of period 1
  const total = SCHED + PERIODS - 1

  const empty = (): Row => Object.fromEntries(letters.map((c) => [c, ''])) as Row
  const seed: Row[] = Array.from({ length: total }, empty)
  const put = (row: number, col: string, v: unknown) => { seed[row - 1]![col] = v }

  put(1, 'A', 'Loan amortization')
  put(2, 'A', 'Principal');       put(2, 'B', 350000)
  put(3, 'A', 'APR');             put(3, 'B', 0.0625)
  put(4, 'A', 'Term (years)');    put(4, 'B', 30)
  put(5, 'A', 'Monthly payment'); put(5, 'B', '=ROUND(-PMT(B3/12,B4*12,B2),2)')
  put(6, 'A', 'Total interest');  put(6, 'B', `=ROUND(SUM(C${SCHED}:C${total}),2)`)
  put(8, 'A', '#'); put(8, 'B', 'Payment'); put(8, 'C', 'Interest'); put(8, 'D', 'Principal'); put(8, 'E', 'Balance')
  for (let n = 1; n <= PERIODS; n++) {
    const row = SCHED + n - 1
    const prevBal = n === 1 ? '$B$2' : `E${row - 1}`
    put(row, 'A', n)
    put(row, 'B', '=$B$5')
    put(row, 'C', `=ROUND(${prevBal}*$B$3/12,2)`)
    put(row, 'D', `=ROUND($B$5-C${row},2)`)
    put(row, 'E', `=ROUND(${prevBal}-D${row},2)`)
  }

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

  function money(v: unknown, dp = 2): string {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dp, maximumFractionDigits: dp }) : String(v ?? '')
  }
  function display(v: unknown, rowIndex: number, letter: string): string {
    if (v == null || v === '') return ''
    const rn = rowIndex + 1
    if (letter === 'A') return String(v)
    if (rn === 3 && letter === 'B') { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-US', { style: 'percent', minimumFractionDigits: 2 }) : String(v) }
    if (rn === 4 && letter === 'B') return String(v)
    if (rn === 8) return String(v)
    return money(v, rn >= SCHED ? 2 : 0)
  }
  const isInput = (rn: number, letter: string) => letter === 'B' && (rn === 2 || rn === 3 || rn === 4)

  const columns: GridColumns<Row> = letters.map((letter) => ({
    field: letter,
    header: letter,
    width: letter === 'A' ? 150 : ['B', 'C', 'D', 'E'].includes(letter) ? 132 : 88,
    align: letter === 'A' ? 'left' : 'right',
    editorType: 'text',
    cellClass: (ctx: { row: { index: number } }) => {
      const rn = ctx.row.index + 1
      if (rn === 1) return 'fm-title'
      if (isInput(rn, letter)) return 'fm-input'
      if ((rn === 5 || rn === 6) && letter === 'B') return 'fm-out'
      if (rn <= 6 && letter === 'A') return 'fm-flabel'
      if (rn === 8) return 'fm-header'
      return ''
    },
    cell: (ctx: { row: { index: number } }) => renderSnippet(Cell, { value: computed[ctx.row.index]?.[letter], rowIndex: ctx.row.index, letter }),
  }))

  let heights = $state<Record<number, number>>({})
  const rowHeight = (i: number) => heights[i] ?? 24
  const onRowResize = (i: number, h: number) => (heights = { ...heights, [i]: h })

  // ---- Formula bar + autocomplete ----
  const FUNCTIONS = [
    { name: 'SUM', sig: 'SUM(range)', desc: 'Add up numbers' },
    { name: 'ROUND', sig: 'ROUND(number, digits)', desc: 'Round to digits' },
    { name: 'PMT', sig: 'PMT(rate, nper, pv)', desc: 'Loan payment per period' },
    { name: 'IF', sig: 'IF(test, then, else)', desc: 'Branch on a condition' },
    { name: 'ABS', sig: 'ABS(number)', desc: 'Absolute value' },
    { name: 'AVERAGE', sig: 'AVERAGE(range)', desc: 'Mean of a range' },
    { name: 'MIN', sig: 'MIN(range)', desc: 'Smallest value' },
    { name: 'MAX', sig: 'MAX(range)', desc: 'Largest value' },
    { name: 'NPV', sig: 'NPV(rate, values)', desc: 'Net present value' },
    { name: 'IRR', sig: 'IRR(values)', desc: 'Internal rate of return' },
  ]
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
  const token = $derived.by(() => (!editing || !draft.startsWith('=') ? '' : draft.slice(0, caret).match(/([A-Za-z]+)$/)?.[1] ?? ''))
  const suggestions = $derived.by(() => {
    if (pickerOpen || dismissed || !editing || !draft.startsWith('=')) return []
    const t = token.toUpperCase()
    if (t) return FUNCTIONS.filter((f) => f.name.startsWith(t)).slice(0, 8)
    const prev = draft.slice(0, caret).slice(-1)
    return prev === '=' || prev === '(' || '+-*/,'.includes(prev) ? FUNCTIONS.slice(0, 8) : []
  })
  $effect(() => { if (sugIndex >= suggestions.length) sugIndex = 0 })
  function sync(e: Event) { const el = e.currentTarget as HTMLInputElement; caret = el.selectionStart ?? el.value.length; if (e.type === 'input') dismissed = false }
  function openBar() { draft = activeRaw; editing = true; dismissed = false; tick().then(() => { inputEl?.focus(); caret = draft.length }) }
  function commitBar() { if (!editing) return; commitCell(activeRow, activeCol, draft); editing = false }
  function accept(i = sugIndex) {
    const fn = suggestions[i]; if (!fn) return
    const upto = draft.slice(0, caret); const start = upto.length - token.length; const inserted = fn.name + '('
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

{#snippet Cell({ value, rowIndex, letter }: { value: unknown; rowIndex: number; letter: string })}
  <span class="cellv">{display(value, rowIndex, letter)}</span>
{/snippet}

<section class="sheet-demo">
  <header class="bs-head">
    <h1 class="bs-title">Financial model</h1>
    <p class="bs-sub">
      A 30-year loan amortization built from formulas on a plain <code>&lt;SvGrid&gt;</code>.
      The three <span class="bs-blue">blue</span> cells are inputs - change Principal, APR or
      Term and the monthly payment (PMT), the 360-row schedule, and total interest recompute.
      Each period references the row above, like a hand-built model.
    </p>
  </header>

  <div class="fx">
    <span class="fx-addr">{address}</span>
    <button type="button" class="fx-glyph fx-pick" class:open={pickerOpen} title="Insert function"
      aria-label="Insert function" aria-expanded={pickerOpen}
      onmousedown={(e) => { e.preventDefault(); pickerOpen = !pickerOpen }}>f<i>x</i><span class="fx-caret">▾</span></button>
    {#if editing}
      <input bind:this={inputEl} bind:value={draft} class="fx-input" spellcheck="false" autocomplete="off" oninput={sync} onkeyup={sync} onclick={sync} onkeydown={onKey} onblur={commitBar} />
    {:else}
      <button type="button" class="fx-display" class:empty={activeRaw === ''} onclick={openBar}>{activeRaw}</button>
    {/if}
    {#if editing && suggestions.length}
      <ul class="fx-suggest" role="listbox">
        {#each suggestions as f, i (f.name)}
          <li>
            <button type="button" class="fx-item" class:active={i === sugIndex} role="option" aria-selected={i === sugIndex} onmousedown={(e) => { e.preventDefault(); accept(i) }} onmouseenter={() => (sugIndex = i)}>
              <span class="fx-name">{f.name}</span><span class="fx-sig">{f.sig}</span><span class="fx-desc">{f.desc}</span>
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
              <span class="fx-name">{f.name}</span><span class="fx-sig">{f.sig}</span><span class="fx-desc">{f.desc}</span>
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
      onActiveCellChange={(e) => { activeRow = e.rowIndex; if (e.columnId) activeCol = e.columnId }}
      onCellValueChange={(e) => { if (e.columnId !== '__rownum__') commitCell(e.rowIndex, e.columnId, e.newValue) }}
    />
  </div>
</section>

<!-- Shared Excel chrome + formula bar are `.sheet-demo` in src/index.css;
     only the finance-model cell tints live here. -->
<style>
  /* Finance "blue = input" convention, driven by the theme accent. */
  .bs-blue { color: var(--sg-accent, #2563eb); font-weight: 700; }
  .sheet :global(.sv-grid-cell.fm-title) { font-weight: 800; text-align: left; }
  .sheet :global(.sv-grid-cell.fm-flabel) { text-align: left; font-weight: 600; color: var(--sg-muted, #475569); }
  .sheet :global(.sv-grid-cell.fm-input) { color: var(--sg-accent, #2563eb) !important; font-weight: 700; background: color-mix(in srgb, var(--sg-accent, #2563eb) 8%, transparent) !important; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sg-accent, #2563eb) 30%, transparent); }
  .sheet :global(.sv-grid-cell.fm-out) { font-weight: 700; }
  .sheet :global(.sv-grid-cell.fm-header) { background: var(--sg-header-bg, #eef2f7) !important; font-weight: 700; text-align: right; border-top: 2px solid var(--sg-fg, #334155); }
</style>
