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
  import {
    TABLE_STYLES, DEFAULT_TABLE_STYLE, NO_TABLE_STYLE,
    tableStyleColours, tableStyleLabel,
  } from './sheet/table-styles'
  import type { Rect } from './sheet/format-store'

  type Props = {
    open?: boolean
    /** The block the table covers, header row included. */
    range: Rect
    name: string
    headers?: boolean
    totals?: boolean
    existing?: boolean
    /** The look, by Excel's name for it, or `'None'`. */
    style?: string
    onApply: (table: { range: Rect; name: string; headers: boolean; totals: boolean; style: string }) => void
    onRemove?: () => void
    onClose?: () => void
  }

  let {
    open = $bindable(false), range, name, headers = true, totals = false, existing = false,
    style = DEFAULT_TABLE_STYLE, onApply, onRemove, onClose,
  }: Props = $props()
  const t = useSheetText()

  let where = $state('')
  let label = $state('')
  let hasHeaders = $state(true)
  let hasTotals = $state(false)
  let look = $state(DEFAULT_TABLE_STYLE)
  let error = $state('')
  let first = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    where = rangeText([range])
    label = name
    hasHeaders = headers
    hasTotals = totals
    look = style
    error = ''
    queueMicrotask(() => first?.focus())
  })

  function ok() {
    const rects = parseRangeText(where)
    const block = rects && rects.length === 1 ? rects[0]! : null
    if (!block) { error = t('table.badRange'); return }
    if (!isValidTableName(label.trim())) { error = t('table.badName'); return }
    open = false
    onApply({ range: block as Rect, name: label.trim(), headers: hasHeaders, totals: hasTotals, style: look })
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
    <fieldset class="styles">
      <legend>{t('table.style')}</legend>
      <div class="gallery" role="radiogroup" aria-label={t('table.style')}>
        <button
          type="button"
          class="swatch none"
          class:chosen={look === NO_TABLE_STYLE}
          role="radio"
          aria-checked={look === NO_TABLE_STYLE}
          title={t('table.styleNone')}
          aria-label={t('table.styleNone')}
          onclick={() => { look = NO_TABLE_STYLE }}
        ><span class="row head"></span><span class="row"></span><span class="row"></span></button>
        {#each TABLE_STYLES as preset (preset.id)}
          {@const colours = tableStyleColours(preset)}
          <button
            type="button"
            class="swatch"
            class:chosen={look === preset.id}
            role="radio"
            aria-checked={look === preset.id}
            title={tableStyleLabel(preset)}
            aria-label={tableStyleLabel(preset)}
            onclick={() => { look = preset.id }}
          >
            <span class="row head" style={`background:${colours?.header}`}></span>
            <span class="row" style={`background:${colours?.band}`}></span>
            <span class="row"></span>
          </button>
        {/each}
      </div>
    </fieldset>
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
  /* The gallery: each swatch is a header band over two body rows, which is
     the smallest drawing that still says what the style will look like. */
  .styles { margin: 8px 0 0; padding: 0; border: 0; }
  .styles legend { padding: 0 0 4px; color: var(--sg-muted, #64748b); font-size: 12px; }
  .gallery { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
  .swatch {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 2px;
    border: 1px solid var(--sg-border, #d4d4d8);
    border-radius: 3px;
    background: var(--sg-surface, #fff);
    cursor: pointer;
  }
  .swatch .row { display: block; height: 5px; background: var(--sg-surface-2, #f1f5f9); }
  .swatch .row.head { height: 7px; }
  .swatch.none .row.head { background: var(--sg-border, #d4d4d8); }
  .swatch.chosen { outline: 2px solid var(--sg-accent, #107c41); outline-offset: 1px; }
  .swatch:focus-visible { outline: 2px solid var(--sg-accent, #107c41); outline-offset: 1px; }
  .error { margin: 4px 0 0; color: var(--sg-danger, #c42b1c); font-size: 12px; }
</style>
