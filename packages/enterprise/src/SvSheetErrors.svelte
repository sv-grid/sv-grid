<script lang="ts">
  /**
   * Excel's Error Checking: the cells on this sheet worth a second look,
   * walked one at a time. Each one says what the error means rather than
   * leaving the code to be looked up, and Show Calculation Steps hands the
   * cell to Evaluate Formula, which is where the answer usually is.
   *
   * The selection follows the walk, so the cell being talked about is the
   * cell on screen.
   */
  import { untrack } from 'svelte'
  import { SvModal } from '@svgrid/grid'
  import { useSheetText } from './sheet-text'
  import { colToLetters } from './sheet/address'
  import { checkSheet, describeFinding, type ErrorFinding } from './sheet/error-check'
  import type { Workbook } from './sheet/workbook'

  type Props = {
    open?: boolean
    workbook: Workbook
    sheet: string
    /** Put the selection on a cell being looked at. */
    onGoTo: (cell: { row: number; col: number }) => void
    /** Open Evaluate Formula on the cell being looked at. */
    onSteps: (cell: { row: number; col: number }) => void
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, sheet, onGoTo, onSteps, onClose }: Props = $props()
  const t = useSheetText()

  let findings = $state<ErrorFinding[]>([])
  let at = $state(0)
  let nextButton = $state<HTMLButtonElement | null>(null)

  const current = $derived(findings[at] ?? null)
  const address = $derived(current ? `${colToLetters(current.col)}${current.row + 1}` : '')

  // Opening is the only thing this effect follows. Reading the workbook
  // through it would tie it to every repaint, and moving the selection
  // repaints, so the walk would restart itself forever.
  $effect(() => {
    if (!open) return
    untrack(load)
  })

  function load() {
    const found = checkSheet(sheet, {
      rowCount: () => workbook.rowCount(sheet),
      colCount: () => workbook.colCount(sheet),
      getRaw: (row, col) => workbook.getRaw(sheet, row, col),
      getValue: (row, col) => workbook.getValue(sheet, row, col),
    })
    findings = found
    at = 0
    show(found[0])
    queueMicrotask(() => nextButton?.focus())
  }

  function show(finding: ErrorFinding | undefined) {
    if (finding) onGoTo({ row: finding.row, col: finding.col })
  }

  function move(by: number) {
    const list = findings
    if (list.length === 0) return
    at = (at + by + list.length) % list.length
    show(list[at])
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('errors.title')} size="sm">
  <div class="sv-sheet-dialog">
    {#if current}
      <p class="position">{t('errors.position', { index: at + 1, count: findings.length })}</p>
      <p class="headline">
        <code>{address}</code>
        <strong>{current.kind === 'error' ? current.error : t('errors.inconsistent')}</strong>
      </p>
      <pre class="formula">{current.text}</pre>
      <p class="meaning">{describeFinding(current)}</p>
    {:else}
      <p class="none">{t('errors.none')}</p>
    {/if}
    <p class="hint">{t('errors.hint')}</p>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={() => move(-1)} disabled={findings.length < 2}>{t('errors.previous')}</button>
      <button type="button" class="btn" bind:this={nextButton} onclick={() => move(1)} disabled={findings.length < 2}>{t('errors.next')}</button>
      <span class="spacer"></span>
      <button
        type="button"
        class="btn primary"
        disabled={!current}
        onclick={() => { if (current) { open = false; onSteps({ row: current.row, col: current.col }) } }}
      >{t('errors.steps')}</button>
      <button type="button" class="btn" onclick={close}>{t('close')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .spacer { flex: 1; }
  .position { margin: 0 0 6px; color: var(--sg-muted, #64748b); font-size: 12px; }
  .headline { margin: 0 0 8px; display: flex; align-items: baseline; gap: 8px; }
  .formula {
    margin: 0 0 8px;
    padding: 8px 10px;
    border: 1px solid var(--sg-border, #d4d4d8);
    border-radius: 4px;
    background: var(--sg-surface-2, #f8fafc);
    font-family: var(--sg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .meaning { margin: 0; }
  .none { margin: 0 0 8px; }
</style>
