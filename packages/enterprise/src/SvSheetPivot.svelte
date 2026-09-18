<script lang="ts">
  /**
   * Excel's Create PivotTable dialog with its field list folded in: the
   * source block, where the result goes, and which field is a row, a column
   * or a measure. Opened by Insert > PivotTable, and again by Refresh on a
   * cell inside a pivot, which is how one is changed.
   */
  import { SvModal } from '@svgrid/grid'
  import { useSheetText } from './sheet-text'
  import { parseRangeText, rangeText } from './sheet/protection'
  import { parseA1, formatA1 } from './sheet/address'
  import {
    SHEET_PIVOT_AGGS, ALL_VALUES,
    type SheetPivot, type SheetPivotAgg, type SheetPivotValue, type SheetPivotFilter,
  } from './sheet/pivot-range'
  import type { Rect } from './sheet/format-store'

  type Props = {
    open?: boolean
    /** The pivot as it stands, new or being edited. */
    pivot: SheetPivot
    /** The source's field names, read from its header row. */
    fields: ReadonlyArray<string>
    /**
     * The values each field carries, for the Filters area's value list.
     * The dialog has the definition, not the cells, so the shell reads
     * them off the source.
     */
    valuesOf?: (field: string) => ReadonlyArray<string>
    existing?: boolean
    onApply: (pivot: SheetPivot) => void
    onDelete?: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), pivot, fields, valuesOf, existing = false, onApply, onDelete, onClose }: Props = $props()
  const t = useSheetText()

  let source = $state('')
  let target = $state('')
  let rows = $state<string[]>([])
  let cols = $state<string[]>([])
  let values = $state<SheetPivotValue[]>([])
  let filters = $state<SheetPivotFilter[]>([])
  let grandTotalRow = $state(true)
  let rowSubtotals = $state(true)
  let error = $state('')
  let first = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    source = rangeText([pivot.source])
    target = formatA1({ sheet: null, row: pivot.target.row, col: pivot.target.col, rowAbs: false, colAbs: false })
    rows = [...pivot.rows]
    cols = [...pivot.cols]
    values = pivot.values.map((v) => ({ ...v }))
    filters = (pivot.filters ?? []).map((f) => ({ ...f }))
    grandTotalRow = pivot.grandTotalRow !== false
    rowSubtotals = pivot.rowSubtotals !== false
    error = ''
    queueMicrotask(() => first?.focus())
  })

  /** Where a field sits now: down the rows, across the columns, or a measure. */
  function placeOf(field: string): Placement {
    if (rows.includes(field)) return 'rows'
    if (cols.includes(field)) return 'cols'
    if (values.some((v) => v.field === field)) return 'values'
    if (filters.some((f) => f.field === field)) return 'filters'
    return 'none'
  }

  type Placement = 'none' | 'rows' | 'cols' | 'values' | 'filters'

  function place(field: string, to: Placement) {
    rows = rows.filter((f) => f !== field)
    cols = cols.filter((f) => f !== field)
    values = values.filter((v) => v.field !== field)
    filters = filters.filter((f) => f.field !== field)
    if (to === 'rows') rows = [...rows, field]
    else if (to === 'cols') cols = [...cols, field]
    else if (to === 'values') values = [...values, { field, agg: 'sum' }]
    else if (to === 'filters') filters = [...filters, { field, value: '' }]
  }

  function setFilter(field: string, value: string) {
    filters = filters.map((f) => (f.field === field ? { ...f, value } : f))
  }

  function setAgg(field: string, agg: SheetPivotAgg) {
    values = values.map((v) => (v.field === field ? { ...v, agg } : v))
  }

  function ok() {
    const rects = parseRangeText(source)
    const block = rects && rects.length === 1 ? rects[0]! : null
    const at = parseA1(target.trim())
    if (!block || !at || at.row === null) { error = t('pivot.badRange'); return }
    if (!values.length) { error = t('pivot.needValue'); return }
    const next: SheetPivot = {
      ...pivot,
      source: block as Rect,
      target: { row: at.row, col: at.col },
      rows: [...rows],
      cols: [...cols],
      values: values.map((v) => ({ ...v })),
      ...(filters.length ? { filters: filters.map((f) => ({ ...f })) } : { filters: [] }),
      grandTotalRow,
      rowSubtotals,
    }
    if (!next.filters?.length) delete next.filters
    open = false
    onApply(next)
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('pivot.title')} size="md">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <label class="field">
      <span>{t('pivot.source')}</span>
      <input type="text" bind:this={first} bind:value={source} spellcheck="false" placeholder={t('pivot.sourcePlaceholder')} />
    </label>
    <label class="field">
      <span>{t('pivot.target')}</span>
      <input type="text" bind:value={target} spellcheck="false" placeholder={t('pivot.targetPlaceholder')} />
    </label>
    <div class="fields">
      <div class="head">
        <span>{t('pivot.field')}</span>
        <span>{t('pivot.place')}</span>
        <span>{t('pivot.summarise')}</span>
      </div>
      {#each fields as field (field)}
        {@const place_ = placeOf(field)}
        <div class="row">
          <span class="name" title={field}>{field}</span>
          <select value={place_} onchange={(e) => place(field, e.currentTarget.value as Placement)}>
            <option value="none">{t('pivot.place.none')}</option>
            <option value="rows">{t('pivot.place.rows')}</option>
            <option value="cols">{t('pivot.place.cols')}</option>
            <option value="values">{t('pivot.place.values')}</option>
            <option value="filters">{t('pivot.place.filters')}</option>
          </select>
          {#if place_ === 'values'}
            {@const agg = values.find((v) => v.field === field)?.agg ?? 'sum'}
            <select value={agg} onchange={(e) => setAgg(field, e.currentTarget.value as SheetPivotAgg)}>
              {#each SHEET_PIVOT_AGGS as id (id)}<option value={id}>{t(`pivot.agg.${id}`)}</option>{/each}
            </select>
          {:else if place_ === 'filters'}
            {@const chosen = filters.find((f) => f.field === field)?.value ?? ''}
            <select value={chosen} onchange={(e) => setFilter(field, e.currentTarget.value)} aria-label={t('pivot.filterValue', { field })}>
              <option value="">{ALL_VALUES}</option>
              {#each valuesOf?.(field) ?? [] as value (value)}<option value={value}>{value}</option>{/each}
            </select>
          {:else}
            <span class="dash">&mdash;</span>
          {/if}
        </div>
      {/each}
    </div>
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={grandTotalRow} /> {t('pivot.grandTotal')}</label>
      <label class="check"><input type="checkbox" bind:checked={rowSubtotals} /> {t('pivot.subtotals')}</label>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <p class="hint">{t('pivot.hint')}</p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      {#if existing && onDelete}
        <button type="button" class="btn" onclick={() => { open = false; onDelete?.() }}>{t('delete')}</button>
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
  .fields {
    margin-top: 8px;
    max-height: 220px;
    overflow: auto;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 4px);
  }
  .head,
  .row {
    display: grid;
    grid-template-columns: 1fr 120px 130px;
    gap: 8px;
    align-items: center;
    padding: 4px 8px;
  }
  .head {
    position: sticky;
    top: 0;
    background: var(--sg-header-bg, #f3f3f3);
    color: var(--sg-muted, #616161);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .row + .row { border-top: 1px solid var(--sg-border, #ececec); }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dash { color: var(--sg-muted, #9a9a9a); text-align: center; }
</style>
