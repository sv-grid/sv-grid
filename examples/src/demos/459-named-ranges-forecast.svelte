<script lang="ts">
  /**
   * 459. Defined names: an assumptions-driven forecast
   * ---------------------------------------------------
   * The way a finance model is actually built: one sheet of inputs, each
   * with a NAME, and a forecast that reads the names rather than the
   * addresses. `=B2*(1+Growth-Churn)` says what it does; `=B2*(1+$B$5-$B$6)`
   * does not, and breaks the day someone inserts a row above the inputs.
   *
   *   Assumptions   six inputs, each defined as a name: StartMRR, Growth,
   *                 Churn, Margin, Opex, OpexGrowth.
   *   Forecast      twelve months of MRR, gross profit, opex and net, every
   *                 formula written against the names. Change an input and
   *                 the twelve months move; the dependency graph follows the
   *                 name to its cell, so nothing is left stale.
   *
   *   Name Box      lists every name; pick one to jump to it, switching to
   *                 the Assumptions sheet on the way.
   *   Name Manager  Formulas -> Name Manager (Ctrl+F3). Add, repoint or
   *                 delete a name and the sheet recomputes: repoint Growth at
   *                 the "aggressive" cell next to it and month 12 changes.
   *
   * The dialog is this file's; `wb.names` is the package's. After the
   * dialog writes to it, `sheet.refresh()` tells the shell the workbook
   * moved underneath it, since no cell was typed into.
   */
  import { SvButton, SvModal } from '@svgrid/grid'
  import { tick } from 'svelte'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import {
    SvSheet, createWorkbook, isValidName, parseA1,
    type CellFormatEntry, type RibbonActionId, type DefinedName,
  } from '@svgrid/enterprise'

  const INPUTS: ReadonlyArray<readonly [label: string, name: string, base: string, aggressive: string]> = [
    ['Starting MRR',     'StartMRR',   '42000', '42000'],
    ['Monthly growth',   'Growth',     '0.06',  '0.11'],
    ['Monthly churn',    'Churn',      '0.015', '0.02'],
    ['Gross margin',     'Margin',     '0.78',  '0.78'],
    ['Monthly opex',     'Opex',       '38000', '46000'],
    ['Opex growth',      'OpexGrowth', '0.02',  '0.035'],
  ]

  const assumptions = [
    ['Assumptions'],
    ['Each input is a defined name. The Forecast sheet reads the names, not the addresses.'],
    [],
    ['Input', 'Base case', 'Aggressive', 'Name'],
    ...INPUTS.map(([label, name, base, aggressive]) => [label, base, aggressive, name]),
  ]

  const MONTHS = ['Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027', 'Feb 2027', 'Mar 2027',
    'Apr 2027', 'May 2027', 'Jun 2027', 'Jul 2027', 'Aug 2027', 'Sep 2027']
  const forecast = [
    ['Month', 'MRR', 'Gross profit', 'Opex', 'Net', 'Cumulative', 'Profitable'],
    ...MONTHS.map((month, i) => {
      const r = i + 2
      return [
        month,
        i === 0 ? '=StartMRR' : `=B${r - 1}*(1+Growth-Churn)`,
        `=B${r}*Margin`,
        i === 0 ? '=Opex' : `=D${r - 1}*(1+OpexGrowth)`,
        `=C${r}-D${r}`,
        i === 0 ? `=E${r}` : `=F${r - 1}+E${r}`,
        `=IF(E${r}>0,"yes","")`,
      ]
    }),
    [],
    ['First profitable month', '=IFERROR(INDEX(A2:A13,MATCH("yes",G2:G13,0)),"not within 12 months")'],
    ['Exit MRR', '=B13'],
    ['Twelve-month net', '=SUM(E2:E13)'],
    ['Peak burn', '=MIN(F2:F13)'],
  ]

  const wb = createWorkbook([
    { name: 'Forecast', cells: forecast },
    { name: 'Assumptions', cells: assumptions },
  ])
  INPUTS.forEach(([, name], i) => wb.names.define(name, `=Assumptions!$B$${i + 5}`))

  // ---- formats ------------------------------------------------------------
  const BAND = { bold: true, fill: '#e2e8f0', color: '#0f172a' } as const
  const INPUT = { color: '#1d4ed8' } as const
  const MONEY = { numFmt: '$#,##0' } as const
  const PCT = { numFmt: '0.0%' } as const
  const A = 'Assumptions!'

  const col = (sheet: string, letter: string, from: number, to: number, entry: CellFormatEntry) =>
    Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [`${sheet}${letter}${from + i}`, entry]))
  const formats: Record<string, CellFormatEntry> = {
    // Forecast
    ...Object.fromEntries([...'ABCDEFG'].map((c) => [`${c}1`, BAND])),
    ...col('', 'B', 2, 13, MONEY), ...col('', 'C', 2, 13, MONEY), ...col('', 'D', 2, 13, MONEY),
    ...col('', 'E', 2, 13, { numFmt: '$#,##0;[Red]($#,##0)' }),
    ...col('', 'F', 2, 13, { numFmt: '$#,##0;[Red]($#,##0)' }),
    ...col('', 'G', 2, 13, { align: 'center', color: '#15803d' }),
    A15: { bold: true }, A16: { bold: true }, A17: { bold: true }, A18: { bold: true },
    B16: MONEY, B17: { numFmt: '$#,##0;[Red]($#,##0)' }, B18: { numFmt: '$#,##0;[Red]($#,##0)' },
    // Assumptions
    [`${A}A1`]: { bold: true, fontSize: 17 },
    [`${A}A2`]: { italic: true, color: '#64748b' },
    ...Object.fromEntries([...'ABCD'].map((c) => [`${A}${c}4`, BAND])),
    [`${A}B5`]: { ...INPUT, ...MONEY }, [`${A}C5`]: MONEY,
    [`${A}B6`]: { ...INPUT, ...PCT }, [`${A}C6`]: PCT,
    [`${A}B7`]: { ...INPUT, ...PCT }, [`${A}C7`]: PCT,
    [`${A}B8`]: { ...INPUT, ...PCT }, [`${A}C8`]: PCT,
    [`${A}B9`]: { ...INPUT, ...MONEY }, [`${A}C9`]: MONEY,
    [`${A}B10`]: { ...INPUT, ...PCT }, [`${A}C10`]: PCT,
    ...col(A, 'D', 5, 10, { fontFamily: 'ui-monospace, Menlo, monospace', color: '#64748b' }),
  }

  // ---- the Name Manager ---------------------------------------------------
  let sheet = $state<ReturnType<typeof SvSheet>>()
  let open = $state(false)
  let names = $state<DefinedName[]>([])
  let newName = $state('')
  let newRefersTo = $state('')
  let editing = $state<string | null>(null)
  let editRefersTo = $state('')
  let problem = $state<string | null>(null)
  let cmdAtOpen: GridCommandContext | null = null

  function reload() {
    names = wb.names.list()
  }

  // Returning true takes the action over: the shell's own Name Manager
  // stays closed and this one, the worked example, opens instead.
  function onAction(action: RibbonActionId, cmd: GridCommandContext): boolean {
    if (action !== 'name-manager') return false
    cmdAtOpen = cmd
    reload()
    newName = ''
    newRefersTo = ''
    editing = null
    problem = null
    open = true
    return true
  }

  /** What a name is worth right now, for the dialog's Value column. */
  function valueOf(entry: DefinedName): string {
    const text = entry.refersTo.replace(/^=/, '')
    const bang = text.lastIndexOf('!')
    const sheetName = bang >= 0 ? text.slice(0, bang).replace(/^'(.*)'$/, '$1') : wb.active
    const address = bang >= 0 ? text.slice(bang + 1) : text
    const [first, last] = address.split(':')
    const from = parseA1(first ?? '')
    if (!from || from.row === null) return ''
    if (last) {
      const to = parseA1(last)
      if (to && to.row !== null) {
        const cells = (to.row - from.row + 1) * (to.col - from.col + 1)
        return `${cells} cells`
      }
    }
    const v = wb.getValue(sheetName, from.row, from.col)
    if (typeof v === 'object' && v !== null) return v.error
    if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
    return String(v)
  }

  /** Accept `Assumptions!B6`, `=Assumptions!$B$6`, `B6` or a range. */
  function normalise(refersTo: string): string | null {
    const text = refersTo.trim().replace(/^=/, '')
    if (text === '') return null
    const bang = text.lastIndexOf('!')
    const address = bang >= 0 ? text.slice(bang + 1) : text
    const [first, last] = address.split(':')
    if (!parseA1(first ?? '')) return null
    if (last !== undefined && !parseA1(last)) return null
    return `=${bang >= 0 ? text.slice(0, bang + 1) : `${wb.active}!`}${address}`
  }

  function changed() {
    // Redefining a name recalculates the workbook, but no cell was typed
    // into, so the shell is told the document moved underneath it.
    sheet?.refresh()
    reload()
  }

  function add() {
    const name = newName.trim()
    if (!isValidName(name)) { problem = `"${name}" is not a valid name: letters, digits and underscores, not a cell address`; return }
    if (wb.names.has(name)) { problem = `${name} is already defined; edit it below instead`; return }
    const refersTo = normalise(newRefersTo)
    if (!refersTo) { problem = `"${newRefersTo}" is not a cell or range`; return }
    wb.names.define(name, refersTo)
    newName = ''
    newRefersTo = ''
    problem = null
    changed()
  }

  function startEdit(entry: DefinedName) {
    editing = entry.name
    editRefersTo = entry.refersTo
    problem = null
  }

  function saveEdit() {
    if (!editing) return
    const refersTo = normalise(editRefersTo)
    if (!refersTo) { problem = `"${editRefersTo}" is not a cell or range`; return }
    wb.names.define(editing, refersTo)
    editing = null
    problem = null
    changed()
  }

  function remove(name: string) {
    wb.names.remove(name)
    changed()
  }

  async function close() {
    open = false
    // The modal returns focus to the ribbon button as it unmounts; the sheet
    // is where the next keystroke belongs.
    await tick()
    cmdAtOpen?.focus()
  }
</script>

<section class="wrap flex flex-col flex-1 min-h-0">
  <SvSheet
    bind:this={sheet}
    workbook={wb}
    height="100%"
    rows={20}
    columns={8}
    columnWidths={{ A: 180, B: 120, C: 120, D: 120, E: 120, F: 120, G: 90 }}
    {formats}
    {onAction}
  />
  <p class="note shrink-0">
    Every formula on <strong>Forecast</strong> reads a name. Open the Name Box
    and pick <code>Growth</code>: it switches to Assumptions and lands on the
    cell. Change it to 0.08 and come back. Then <strong>Formulas -> Name
    Manager</strong>: point <code>Growth</code> at <code>Assumptions!C6</code>,
    the aggressive case, and watch month 12.
  </p>
</section>

<SvModal bind:open onClose={close} title="Name Manager" size="md">
  <div class="manager">
    <table class="names">
      <thead>
        <tr><th>Name</th><th>Refers to</th><th>Value</th><th></th></tr>
      </thead>
      <tbody>
        {#each names as entry (entry.name)}
          <tr>
            <td class="mono">{entry.name}</td>
            <td class="mono">
              {#if editing === entry.name}
                <input
                  type="text"
                  bind:value={editRefersTo}
                  aria-label="Refers to"
                  onkeydown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') editing = null }}
                />
              {:else}
                {entry.refersTo}
              {/if}
            </td>
            <td class="num">{valueOf(entry)}</td>
            <td class="actions">
              {#if editing === entry.name}
                <SvButton size="sm" onclick={saveEdit}>Save</SvButton>
                <SvButton size="sm" variant="ghost" onclick={() => (editing = null)}>Cancel</SvButton>
              {:else}
                <SvButton size="sm" variant="outline" onclick={() => startEdit(entry)}>Edit</SvButton>
                <SvButton size="sm" variant="ghost" onclick={() => remove(entry.name)}>Delete</SvButton>
              {/if}
            </td>
          </tr>
        {:else}
          <tr><td colspan="4" class="empty">No defined names. Add one below.</td></tr>
        {/each}
      </tbody>
    </table>

    <form class="new" onsubmit={(e) => { e.preventDefault(); add() }}>
      <label>
        <span>Name</span>
        <input type="text" bind:value={newName} placeholder="TaxRate" spellcheck="false" />
      </label>
      <label>
        <span>Refers to</span>
        <input type="text" bind:value={newRefersTo} placeholder="Assumptions!B11 or B2:B13" spellcheck="false" />
      </label>
      <SvButton type="submit" variant="outline">New</SvButton>
    </form>
    {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
  </div>
  {#snippet footer()}
    <SvButton onclick={close}>Close</SvButton>
  {/snippet}
</SvModal>

<style>
  .wrap { gap: 8px; }
  .note { margin: 0; font-size: 13px; line-height: 1.6; color: var(--sg-muted, #64748b); }
  .note code {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--sg-header-bg, #f1f5f9);
    color: var(--sg-fg, #0f172a);
  }

  .manager { display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .names { width: 100%; border-collapse: collapse; }
  .names th {
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-muted, #64748b);
    padding: 4px 8px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .names td { padding: 5px 8px; border-bottom: 1px solid var(--sg-border, #e2e8f0); vertical-align: middle; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; }
  .num { font-variant-numeric: tabular-nums; text-align: right; }
  .actions { display: flex; gap: 4px; justify-content: flex-end; white-space: nowrap; }
  .empty { text-align: center; color: var(--sg-muted, #64748b); }
  .names input, .new input {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12.5px;
    padding: 5px 8px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    border-radius: 6px;
    background: var(--sg-input-bg, #fff);
    color: var(--sg-fg, #0f172a);
  }
  .new { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 8px; align-items: end; }
  .new label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .problem { margin: 0; font-size: 12.5px; color: var(--sg-danger, #dc2626); }

  @media (max-width: 560px) {
    .new { grid-template-columns: 1fr; }
  }
</style>
