<script lang="ts">
  /**
   * 457. What-if analysis: Goal Seek
   * ---------------------------------
   * A pricing model with three scenarios side by side, and Excel's Goal Seek
   * over it: "what price makes the Base profit 20,000?" You know the answer
   * you want and one cell you are willing to change; the solver finds the
   * input.
   *
   *   Data tab -> Goal Seek       (also on the Formulas tab)
   *   Set cell        B14         the formula to hit
   *   To value        20000       the target
   *   By changing     B5          the input to move
   *
   * The dialog is this file's; the solver is `goalSeekCell` from the
   * package. It is secant with a bisection fallback, and it RESTORES the
   * input cell before returning, so the sheet does not move until the
   * status dialog says "found a solution" and you press OK. That is the
   * Excel sequence: show the answer, then ask whether to keep it.
   *
   * OK writes the answer through the grid's own command context, so it is
   * one Ctrl+Z like any other edit. Blue cells are inputs, the Excel
   * convention for a model; everything else is a formula.
   */
  import { tick } from 'svelte'
  import { SvButton, SvModal, type SvGridApi } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import {
    SvSheet, createWorkbook, goalSeekCell, parseA1, colToLetters,
    type CellFormatEntry, type RibbonActionId,
  } from '@svgrid/enterprise'

  const SCENARIOS = ['Base', 'Growth', 'Downturn'] as const
  const COLS = ['B', 'C', 'D'] as const

  // The same block of formulas in each column, written once per column the
  // way you would fill it right in Excel.
  const per = (f: (c: string) => string) => COLS.map(f)
  const model = [
    ['Pricing model'],
    ['Three scenarios side by side. Blue cells are inputs; everything else is a formula.'],
    [],
    ['', ...SCENARIOS],
    ['Price per seat',    '49',    '59',    '39'],
    ['Seats',             '400',   '520',   '300'],
    ['Cost per seat',     '12',    '12',    '12'],
    ['Fixed costs',       '9000',  '11000', '8000'],
    [],
    ['Revenue',           ...per((c) => `=${c}5*${c}6`)],
    ['Variable cost',     ...per((c) => `=${c}6*${c}7`)],
    ['Gross margin',      ...per((c) => `=${c}10-${c}11`)],
    ['Margin %',          ...per((c) => `=${c}12/${c}10`)],
    ['Profit',            ...per((c) => `=${c}12-${c}8`)],
    ['Break-even seats',  ...per((c) => `=ROUNDUP(${c}8/(${c}5-${c}7),0)`)],
    ['Profit per seat',   ...per((c) => `=${c}14/${c}6`)],
    [],
    ['Best case',         '=INDEX(B4:D4,MATCH(MAX(B14:D14),B14:D14,0))'],
    ['Spread',            '=MAX(B14:D14)-MIN(B14:D14)'],
  ]

  const wb = createWorkbook([{ name: 'Model', cells: model }])

  // ---- formats ------------------------------------------------------------
  const INPUT = { color: '#1d4ed8', numFmt: '#,##0' } as const
  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a', align: 'center' } as const
  const MONEY = { numFmt: '$#,##0' } as const
  const RESULT = { bold: true, fill: '#eef2ff', color: '#1e1b4b', numFmt: '$#,##0' } as const

  const row = (r: number, entry: CellFormatEntry): Record<string, CellFormatEntry> =>
    Object.fromEntries(COLS.map((c) => [`${c}${r}`, entry]))
  const formats: Record<string, CellFormatEntry> = {
    A1: { bold: true, fontSize: 17 },
    A2: { italic: true, color: '#64748b' },
    ...row(4, BAND),
    ...row(5, INPUT), ...row(6, INPUT), ...row(7, INPUT), ...row(8, INPUT),
    ...row(10, MONEY), ...row(11, MONEY), ...row(12, MONEY),
    ...row(13, { numFmt: '0.0%' }),
    A14: { bold: true }, ...row(14, RESULT),
    ...row(15, { numFmt: '#,##0' }),
    ...row(16, { numFmt: '$#,##0.00' }),
    A18: { bold: true }, A19: { bold: true }, B19: MONEY,
  }

  // ---- the Goal Seek dialog -----------------------------------------------
  type Step = 'ask' | 'done'
  let open = $state(false)
  let step = $state<Step>('ask')
  let setCell = $state('B14')
  let toValue = $state('20000')
  let byCell = $state('B5')
  let problem = $state<string | null>(null)
  let found = $state<{ value: number; result: number; converged: boolean; iterations: number } | null>(null)
  let cmdAtOpen: GridCommandContext | null = null
  let api = $state<SvGridApi<any, any> | null>(null)

  // Returning true takes the action over: the shell has a Goal Seek of its
  // own and would open it as well otherwise. This one is the worked example
  // of putting your own in its place.
  function onAction(action: RibbonActionId, cmd: GridCommandContext): boolean {
    if (action !== 'goal-seek') return false
    // The active cell is the natural "Set cell", as it is in Excel.
    const at = cmd.activeCell
    if (at) setCell = `${colToLetters(at.colIndex)}${at.rowIndex + 1}`
    cmdAtOpen = cmd
    step = 'ask'
    problem = null
    found = null
    open = true
    return true
  }

  function address(text: string): { row: number; col: number } | null {
    const ref = parseA1(text.trim().toUpperCase())
    return ref && ref.row !== null ? { row: ref.row, col: ref.col } : null
  }

  function solve() {
    const formula = address(setCell)
    const input = address(byCell)
    const target = Number(toValue)
    if (!formula) { problem = `"${setCell}" is not a cell address`; return }
    if (!input) { problem = `"${byCell}" is not a cell address`; return }
    if (!Number.isFinite(target)) { problem = 'To value must be a number'; return }
    if (!wb.getRaw(wb.active, formula.row, formula.col).startsWith('=')) {
      problem = `${setCell.toUpperCase()} must contain a formula`
      return
    }
    if (wb.getRaw(wb.active, input.row, input.col).startsWith('=')) {
      problem = `${byCell.toUpperCase()} must contain a value, not a formula`
      return
    }
    const result = goalSeekCell(
      wb,
      { sheet: wb.active, ...formula },
      { sheet: wb.active, ...input },
      target,
      { maxIterations: 100 },
    )
    found = result
    problem = null
    step = 'done'
  }

  function keep() {
    const input = address(byCell)
    if (!input || !found) return
    // Through the command context rather than wb.setRaw: the write lands in
    // the grid's undo history and the shell repaints from it, the same path
    // typing the number would take.
    const cmd = api?.getCommandContext() ?? cmdAtOpen
    cmd?.setCellValue(input.row, input.col, String(round(found.value)))
    cmd?.setActiveCell(input.row, input.col)
    close()
  }

  /** Excel returns focus to the sheet when the dialog goes, so Ctrl+Z is
   *  the next keystroke that works rather than the one after a click. The
   *  modal hands focus back to the ribbon button as it unmounts, so this
   *  waits for that and then moves it on. */
  async function close() {
    open = false
    await tick()
    ;(api?.getCommandContext() ?? cmdAtOpen)?.focus()
  }

  const round = (n: number) => Number(n.toFixed(4))
  const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet
    workbook={wb}
    height="100%"
    rows={22}
    columns={8}
    columnWidths={{ A: 170, B: 120, C: 120, D: 120 }}
    {formats}
    {onAction}
    onReady={(a) => (api = a)}
  />
  <p class="note shrink-0">
    Click a profit cell, then <strong>Data -> Goal Seek</strong>. Ask for
    <strong>20000</strong> by changing <strong>B5</strong> and the solver
    finds the price; OK keeps it, Cancel leaves the sheet as it was. Try the
    same for a margin of 80% by changing the cost per seat.
  </p>
</section>

<SvModal bind:open onClose={close} title={step === 'ask' ? 'Goal Seek' : 'Goal Seek Status'} size="sm">
  {#if step === 'ask'}
    <form class="form" onsubmit={(e) => { e.preventDefault(); solve() }}>
      <label class="field">
        <span>Set cell:</span>
        <input type="text" bind:value={setCell} spellcheck="false" />
      </label>
      <label class="field">
        <span>To value:</span>
        <input type="text" bind:value={toValue} inputmode="decimal" />
      </label>
      <label class="field">
        <span>By changing cell:</span>
        <input type="text" bind:value={byCell} spellcheck="false" />
      </label>
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
    </form>
  {:else if found}
    <div class="status">
      <p>
        Goal Seeking with Cell <strong>{setCell.toUpperCase()}</strong>
        {found.converged ? 'found a solution.' : 'may not have found a solution.'}
      </p>
      <dl>
        <dt>Target value:</dt><dd>{money(Number(toValue))}</dd>
        <dt>Current value:</dt><dd>{money(found.result)}</dd>
        <dt>{byCell.toUpperCase()} becomes:</dt><dd>{money(round(found.value))}</dd>
      </dl>
      <p class="quiet">{found.iterations} iterations.</p>
    </div>
  {/if}
  {#snippet footer()}
    {#if step === 'ask'}
      <SvButton variant="ghost" onclick={close}>Cancel</SvButton>
      <SvButton onclick={solve}>OK</SvButton>
    {:else}
      <SvButton variant="ghost" onclick={close}>Cancel</SvButton>
      <SvButton onclick={keep}>OK</SvButton>
    {/if}
  {/snippet}
</SvModal>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }

  .form { display: flex; flex-direction: column; gap: 10px; }
  .field {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
  }
  .field input {
    font: inherit;
    font-size: 13px;
    font-family: ui-monospace, Menlo, monospace;
    padding: 6px 9px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 6px;
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
    min-width: 0;
  }
  .problem { margin: 0; font-size: 12.5px; color: var(--sg-danger, #dc2626); }

  .status { font-size: 13px; color: var(--sg-fg, #0f172a); }
  .status p { margin: 0 0 10px; }
  .status dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 16px;
    margin: 0;
  }
  .status dt { color: var(--sg-muted, #64748b); }
  .status dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 600; }
  .quiet { margin-top: 10px; font-size: 12px; color: var(--sg-muted, #64748b); }
</style>
