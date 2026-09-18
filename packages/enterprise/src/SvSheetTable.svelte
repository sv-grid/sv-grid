<script lang="ts">
  /**
   * Excel's Create Table dialog: the cells, whether the first row is the
   * header, the name the columns will be read by, and a totals row.
   * Opened by Insert > Table or Ctrl+T, and again on a cell inside one,
   * which is how a table is renamed or resized.
   */
  import { SvModal } from '@svgrid/grid'
  import { useSheetText } from './sheet-text'
  import { parseRangeText, rangeText } from './sheet/protection'
  import { isValidTableName } from './sheet/tables'
  import type { Rect } from './sheet/format-store'

  type Props = {
    open?: boolean
    /** The block the table covers, header row included. */
    range: Rect
    name: string
    headers?: boolean
    totals?: boolean
    existing?: boolean
    onApply: (table: { range: Rect; name: string; headers: boolean; totals: boolean }) => void
    onRemove?: () => void
    onClose?: () => void
  }

  let {
    open = $bindable(false), range, name, headers = true, totals = false, existing = false,
    onApply, onRemove, onClose,
  }: Props = $props()
  const t = useSheetText()

  let where = $state('')
  let label = $state('')
  let hasHeaders = $state(true)
  let hasTotals = $state(false)
  let error = $state('')
  let first = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    where = rangeText([range])
    label = name
    hasHeaders = headers
    hasTotals = totals
    error = ''
    queueMicrotask(() => first?.focus())
  })

  function ok() {
    const rects = parseRangeText(where)
    const block = rects && rects.length === 1 ? rects[0]! : null
    if (!block) { error = t('table.badRange'); return }
    if (!isValidTableName(label.trim())) { error = t('table.badName'); return }
    open = false
    onApply({ range: block as Rect, name: label.trim(), headers: hasHeaders, totals: hasTotals })
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('table.title')} size="sm">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <label class="field">
      <span>{t('table.range')}</span>
      <input type="text" bind:this={first} bind:value={where} spellcheck="false" placeholder={t('table.rangePlaceholder')} />
    </label>
    <label class="field">
      <span>{t('table.name')}</span>
      <input type="text" bind:value={label} spellcheck="false" placeholder={t('table.namePlaceholder')} />
    </label>
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={hasHeaders} /> {t('table.headers')}</label>
      <label class="check"><input type="checkbox" bind:checked={hasTotals} /> {t('table.totals')}</label>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <p class="hint">{t('table.hint')}</p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      {#if existing && onRemove}
        <button type="button" class="btn" onclick={() => { open = false; onRemove?.() }}>{t('delete')}</button>
      {/if}
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
