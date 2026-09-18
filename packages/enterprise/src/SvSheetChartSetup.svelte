<script lang="ts">
  /**
   * Excel's Chart Design tab, as the one dialog the sheet needs: the chart
   * type, its title, whether the range's first row and column are labels,
   * whether a series is a column of the range or a row, and stacking.
   * Opened by a double-click on a chart or by Chart Setup on the ribbon
   * while one is selected. Delete removes the chart.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import { SHEET_CHART_TYPES, copyObject, type SheetChartObject, type SheetChartType } from './sheet/objects'
  import { colToLetters } from './sheet/address'

  type Props = {
    open?: boolean
    /** The chart as it stands. */
    chart: SheetChartObject
    onApply: (chart: SheetChartObject) => void
    onDelete: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), chart, onApply, onDelete, onClose }: Props = $props()
  const t = useSheetText()

  let type = $state<SheetChartType>('bar')
  let title = $state('')
  let headers = $state(true)
  let series = $state<'columns' | 'rows'>('columns')
  let stacked = $state(false)
  let first = $state<HTMLSelectElement | null>(null)

  $effect(() => {
    if (!open) return
    type = chart.type
    title = chart.title ?? ''
    headers = chart.headers
    series = chart.series
    stacked = Boolean(chart.stacked)
    queueMicrotask(() => first?.focus())
  })

  const rangeText = $derived.by(() => {
    const [r1, c1, r2, c2] = chart.range
    return `${colToLetters(c1)}${r1 + 1}:${colToLetters(c2)}${r2 + 1}`
  })
  /** Stacking means nothing on a pie or a scatter. */
  const stackable = $derived(type === 'bar' || type === 'area' || type === 'line')

  function ok() {
    const next = copyObject(chart) as SheetChartObject
    next.type = type
    next.headers = headers
    next.series = series
    if (title.trim()) next.title = title.trim()
    else delete next.title
    if (stacked && stackable) next.stacked = true
    else delete next.stacked
    open = false
    onApply(next)
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('chartSetup.title')} size="sm">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <div class="where">{t('chartSetup.range', { range: rangeText })}</div>
    <label class="field">
      <span>{t('chartSetup.type')}</span>
      <select bind:this={first} bind:value={type}>
        {#each SHEET_CHART_TYPES as kind (kind)}<option value={kind}>{t(`chartSetup.type.${kind}`)}</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>{t('chartSetup.chartTitle')}</span>
      <input type="text" bind:value={title} spellcheck="false" placeholder={t('chartSetup.titlePlaceholder')} />
    </label>
    <label class="field">
      <span>{t('chartSetup.series')}</span>
      <select bind:value={series}>
        <option value="columns">{t('chartSetup.series.columns')}</option>
        <option value="rows">{t('chartSetup.series.rows')}</option>
      </select>
    </label>
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={headers} /> {t('chartSetup.headers')}</label>
      {#if stackable}
        <label class="check"><input type="checkbox" bind:checked={stacked} /> {t('chartSetup.stacked')}</label>
      {/if}
    </div>
    <p class="hint">{t('chartSetup.hint')}</p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={() => { open = false; onDelete() }}>{t('delete')}</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={ok}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .spacer { flex: 1; }
</style>
