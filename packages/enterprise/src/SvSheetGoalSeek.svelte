<script lang="ts">
  /**
   * Excel's Goal Seek: set a formula cell to a value by changing one input
   * cell. The solver restores the input while it searches and the status
   * page shows what it found; OK keeps the answer through the command
   * context, so it lands in the grid's history like a typed number.
   */
  import { useSheetText } from './sheet-text'
  import { untrack } from 'svelte'
  import { SvModal } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import type { Workbook } from './sheet/workbook'
  import { goalSeekCell, type GoalSeekResult } from './sheet/goal-seek'
  import { parseA1, colToLetters } from './sheet/address'

  type Props = {
    open?: boolean
    workbook: Workbook
    /** The command context the dialog was opened with. */
    cmd: () => GridCommandContext | null
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, cmd, onClose }: Props = $props()
  const t = useSheetText()

  let step = $state<'ask' | 'done'>('ask')
  let setCell = $state('')
  let toValue = $state('')
  let byCell = $state('')
  let problem = $state<string | null>(null)
  let found = $state<GoalSeekResult | null>(null)
  let firstInput = $state<HTMLInputElement | null>(null)

  // The active cell is the natural "Set cell", as it is in Excel.
  $effect(() => {
    if (!open) return
    untrack(prepare)
  })

  function prepare() {
    const at = cmd()?.activeCell
    setCell = at ? `${colToLetters(at.colIndex)}${at.rowIndex + 1}` : ''
    toValue = ''
    byCell = ''
    step = 'ask'
    problem = null
    found = null
    queueMicrotask(() => firstInput?.focus())
  }

  function address(text: string): { row: number; col: number } | null {
    const ref = parseA1(text.trim().toUpperCase())
    return ref && ref.row !== null ? { row: ref.row, col: ref.col } : null
  }

  function solve() {
    const formula = address(setCell)
    const input = address(byCell)
    const target = Number(toValue)
    if (!formula) { problem = t('goalSeek.notAddress', { text: setCell }); return }
    if (!input) { problem = t('goalSeek.notAddress', { text: byCell }); return }
    if (toValue.trim() === '' || !Number.isFinite(target)) { problem = t('goalSeek.toValueNumber'); return }
    const sheet = workbook.active
    if (!workbook.getRaw(sheet, formula.row, formula.col).startsWith('=')) {
      problem = t('goalSeek.needsFormula', { cell: setCell.toUpperCase() })
      return
    }
    if (workbook.getRaw(sheet, input.row, input.col).startsWith('=')) {
      problem = `${byCell.toUpperCase()} must contain a value, not a formula`
      return
    }
    found = goalSeekCell(workbook, { sheet, ...formula }, { sheet, ...input }, target, { maxIterations: 100 })
    problem = null
    step = 'done'
  }

  function keep() {
    const input = address(byCell)
    const c = cmd()
    if (!input || !found || !c) return
    c.setCellValue(input.row, input.col, String(round(found.value)))
    c.setActiveCell(input.row, input.col)
    close()
  }

  function close() {
    open = false
    onClose?.()
  }

  const round = (n: number) => Number(n.toFixed(4))
  const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
</script>

<SvModal bind:open onClose={onClose} title={t(step === 'ask' ? 'goalSeek.title' : 'goalSeek.statusTitle')} size="sm">
  {#if step === 'ask'}
    <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); solve() }}>
      <label class="field">
        <span>{t('goalSeek.setCell')}</span>
        <input bind:this={firstInput} type="text" bind:value={setCell} spellcheck="false" />
      </label>
      <label class="field">
        <span>{t('goalSeek.toValue')}</span>
        <input type="text" bind:value={toValue} inputmode="decimal" />
      </label>
      <label class="field">
        <span>{t('goalSeek.byChanging')}</span>
        <input type="text" bind:value={byCell} spellcheck="false" />
      </label>
      {#if problem}<p class="status problem" role="alert">{problem}</p>{/if}
    </form>
  {:else if found}
    <div class="sv-sheet-dialog">
      <p class="lead">
        {t(found.converged ? 'goalSeek.found' : 'goalSeek.notFound', { cell: setCell.toUpperCase() })}
      </p>
      <dl class="facts">
        <dt>{t('goalSeek.target')}</dt><dd>{money(Number(toValue))}</dd>
        <dt>{t('goalSeek.current')}</dt><dd>{money(found.result)}</dd>
        <dt>{t('goalSeek.becomes', { cell: byCell.toUpperCase() })}</dt><dd>{money(round(found.value))}</dd>
      </dl>
      <p class="status">{t('goalSeek.iterations', { count: found.iterations })}</p>
    </div>
  {/if}
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={step === 'ask' ? solve : keep}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .lead { margin: 0; }
  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
  }
  .facts dt { color: var(--sg-muted, #616161); }
  .facts dd { margin: 0; font-variant-numeric: tabular-nums; }
  .problem { color: var(--sg-danger, #dc2626); }
</style>
