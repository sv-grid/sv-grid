<script lang="ts">
  /**
   * Excel's File > Options > Formulas > Calculation options, raised to the
   * Formulas tab because it is the one setting there that changes what a
   * formula is worth: with iteration on a circular reference settles on its
   * fixed point instead of showing #CYCLE!.
   */
  import { SvModal } from '@svgrid/grid'
  import { useSheetText } from './sheet-text'
  import type { IterationSettings } from './sheet/workbook'

  type Props = {
    open?: boolean
    iteration: IterationSettings
    onApply: (next: IterationSettings) => void
    onClose?: () => void
  }

  let { open = $bindable(false), iteration, onApply, onClose }: Props = $props()
  const t = useSheetText()

  let enabled = $state(false)
  let passes = $state('100')
  let change = $state('0.001')
  let error = $state('')
  let first = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    enabled = iteration.enabled
    passes = String(iteration.maxIterations)
    change = String(iteration.maxChange)
    error = ''
    queueMicrotask(() => first?.focus())
  })

  function ok() {
    const maxIterations = Number(passes)
    const maxChange = Number(change)
    if (!Number.isFinite(maxIterations) || maxIterations < 1 || !Number.isFinite(maxChange) || maxChange < 0) {
      error = t('iteration.badNumbers')
      return
    }
    open = false
    onApply({ enabled, maxIterations: Math.round(maxIterations), maxChange })
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('iteration.title')} size="sm">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <label class="check"><input type="checkbox" bind:this={first} bind:checked={enabled} /> {t('iteration.enable')}</label>
    <label class="field">
      <span>{t('iteration.maxIterations')}</span>
      <input type="number" min="1" step="1" bind:value={passes} disabled={!enabled} />
    </label>
    <label class="field">
      <span>{t('iteration.maxChange')}</span>
      <input type="number" min="0" step="0.0001" bind:value={change} disabled={!enabled} />
    </label>
    {#if error}<p class="error">{error}</p>{/if}
    <p class="hint">{t('iteration.hint')}</p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={ok}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .spacer { flex: 1; }
  .error { margin: 4px 0 0; color: var(--sg-danger, #c42b1c); font-size: 12px; }
</style>
