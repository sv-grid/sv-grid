<script lang="ts">
  /**
   * Excel's Evaluate Formula: the active cell's formula with one part
   * underlined, and a button that replaces that part with what it is worth.
   * Keep clicking and the formula collapses into the cell's answer, which is
   * the quickest way to see which half of a long formula is the wrong half.
   *
   * The walk itself is `evaluationSteps`; this shows it and lets the reader
   * move back and forth through it.
   */
  import { untrack } from 'svelte'
  import { SvModal } from '@svgrid/grid'
  import { useSheetText } from './sheet-text'
  import { colToLetters } from './sheet/address'
  import { parseFormula } from './sheet/parse'
  import { evaluationSteps, printValue, type EvaluationStep } from './sheet/evaluate-steps'
  import type { Workbook } from './sheet/workbook'

  type Props = {
    open?: boolean
    workbook: Workbook
    sheet: string
    /** The cell to walk, which is the active one when the dialog opens. */
    cell: { row: number; col: number }
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, sheet, cell, onClose }: Props = $props()
  const t = useSheetText()

  let steps = $state<EvaluationStep[]>([])
  let at = $state(0)
  let problem = $state('')
  let evaluateButton = $state<HTMLButtonElement | null>(null)

  const address = $derived(`${sheet}!${colToLetters(cell.col)}${cell.row + 1}`)
  /** The line on screen: the formula as it stands before the next step, or
   *  the final value once every part has been worked out. */
  const current = $derived(steps[at] ?? null)
  const finished = $derived(steps.length > 0 && at >= steps.length)
  const answer = $derived(steps.length > 0 ? steps[steps.length - 1]!.value : null)

  // The cell is followed, because Error Checking hands this dialog a new
  // one while it is open; the workbook is not, or every repaint would
  // restart the walk.
  $effect(() => {
    if (!open) return
    const target = cell
    untrack(() => walk(target))
  })

  function walk(target: { row: number; col: number }) {
    at = 0
    problem = ''
    steps = []
    const text = workbook.getRaw(sheet, target.row, target.col).trim()
    if (!text.startsWith('=')) {
      problem = t('evaluate.noFormula')
      return
    }
    try {
      steps = evaluationSteps(
        parseFormula(text),
        (formula) => workbook.evaluateText(sheet, formula, undefined, { row: target.row, col: target.col }),
      )
    } catch {
      problem = t('evaluate.noFormula')
    }
    queueMicrotask(() => evaluateButton?.focus())
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('evaluate.title')} size="md">
  <div class="sv-sheet-dialog">
    <p class="reference"><span class="label">{t('evaluate.reference')}</span> <code>{address}</code></p>
    {#if problem}
      <p class="error">{problem}</p>
    {:else}
      <p class="label">{t('evaluate.evaluation')}</p>
      <pre class="evaluation" data-testid="sv-sheet-evaluation">{#if current}{current.formula.slice(0, current.from)}<mark>{current.formula.slice(current.from, current.to)}</mark>{current.formula.slice(current.to)}{:else}{printValue(answer ?? '')}{/if}</pre>
      {#if finished}
        <p class="done">{t('evaluate.done')} <strong>{printValue(answer ?? '')}</strong></p>
      {/if}
      <p class="hint">{t('evaluate.hint')}</p>
    {/if}
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={() => { at = Math.max(0, at - 1) }} disabled={at === 0 || !!problem}>{t('evaluate.stepBack')}</button>
      <button type="button" class="btn" onclick={() => { at = 0 }} disabled={at === 0 || !!problem}>{t('evaluate.restart')}</button>
      <span class="spacer"></span>
      <button
        type="button"
        class="btn primary"
        bind:this={evaluateButton}
        onclick={() => { at = Math.min(steps.length, at + 1) }}
        disabled={finished || !!problem}
      >{t('evaluate.evaluate')}</button>
      <button type="button" class="btn" onclick={close}>{t('close')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .spacer { flex: 1; }
  .reference { margin: 0 0 8px; }
  .label { color: var(--sg-muted, #64748b); font-size: 12px; }
  .evaluation {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--sg-border, #d4d4d8);
    border-radius: 4px;
    background: var(--sg-surface-2, #f8fafc);
    font-family: var(--sg-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .evaluation mark {
    background: var(--sg-accent-soft, #dbeafe);
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .done { margin: 8px 0 0; }
  .error { margin: 4px 0 0; color: var(--sg-danger, #c42b1c); font-size: 12px; }
</style>
