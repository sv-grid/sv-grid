<script lang="ts">
  /**
   * Excel's Create Sparklines dialog, and its Sparkline Design tab folded
   * into the same box: the kind, the two ranges, the colours, one scale for
   * the group or one each. Opened by Insert > Sparklines, and again by a
   * double-click on a cell that holds one, which is how a group is edited.
   */
  import { SvModal } from '@svgrid/grid'
  import { useSheetText } from './sheet-text'
  import { parseRangeText, rangeText } from './sheet/protection'
  import { SPARKLINE_TYPES, type SheetSparklineType, type SparklineGroup } from './sheet/sparklines'
  import type { Rect } from './sheet/format-store'

  type Props = {
    open?: boolean
    /** The group as it stands, new or being edited. */
    group: SparklineGroup
    /** True when the group is already on the sheet, which offers Delete. */
    existing?: boolean
    onApply: (group: SparklineGroup) => void
    onDelete?: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), group, existing = false, onApply, onDelete, onClose }: Props = $props()
  const t = useSheetText()

  let type = $state<SheetSparklineType>('line')
  let data = $state('')
  let location = $state('')
  let colour = $state('')
  let negative = $state('')
  let sameScale = $state(false)
  let markers = $state(false)
  let error = $state('')
  let first = $state<HTMLSelectElement | null>(null)

  $effect(() => {
    if (!open) return
    type = group.type
    data = rangeText([group.data])
    location = rangeText([group.location])
    colour = group.color ?? ''
    negative = group.negativeColor ?? ''
    sameScale = Boolean(group.sameScale)
    markers = Boolean(group.markers)
    error = ''
    queueMicrotask(() => first?.focus())
  })

  /** One rectangle, or null: these two fields take a range, not a list. */
  function oneRect(text: string): Rect | null {
    const rects = parseRangeText(text)
    return rects && rects.length === 1 ? rects[0]! : null
  }

  /** The location has to hold one cell per line of the data. */
  function shapesAgree(d: Rect, l: Rect): boolean {
    const lines = l[2] - l[0] >= l[3] - l[1] ? d[2] - d[0] : d[3] - d[1]
    const cells = Math.max(l[2] - l[0], l[3] - l[1])
    return lines === cells
  }

  function ok() {
    const d = oneRect(data)
    const l = oneRect(location)
    if (!d || !l) { error = t('sparklines.badRange'); return }
    if (!shapesAgree(d, l)) { error = t('sparklines.mismatch'); return }
    const next: SparklineGroup = { ...group, type, data: d, location: l, sameScale, markers }
    if (colour.trim()) next.color = colour.trim()
    else delete next.color
    if (negative.trim()) next.negativeColor = negative.trim()
    else delete next.negativeColor
    open = false
    onApply(next)
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('sparklines.title')} size="sm">
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <label class="field">
      <span>{t('sparklines.type')}</span>
      <select bind:this={first} bind:value={type}>
        {#each SPARKLINE_TYPES as kind (kind)}<option value={kind}>{t(`sparklines.type.${kind}`)}</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>{t('sparklines.data')}</span>
      <input type="text" bind:value={data} spellcheck="false" placeholder={t('sparklines.dataPlaceholder')} />
    </label>
    <label class="field">
      <span>{t('sparklines.location')}</span>
      <input type="text" bind:value={location} spellcheck="false" placeholder={t('sparklines.locationPlaceholder')} />
    </label>
    <label class="field">
      <span>{t('sparklines.colour')}</span>
      <input type="color" value={colour || '#107c41'} oninput={(e) => (colour = e.currentTarget.value)} />
    </label>
    {#if type !== 'line'}
      <label class="field">
        <span>{t('sparklines.negativeColour')}</span>
        <input type="color" value={negative || '#c42b1c'} oninput={(e) => (negative = e.currentTarget.value)} />
      </label>
    {/if}
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={sameScale} /> {t('sparklines.sameScale')}</label>
      {#if type === 'line'}
        <label class="check"><input type="checkbox" bind:checked={markers} /> {t('sparklines.markers')}</label>
      {/if}
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <p class="hint">{t('sparklines.hint')}</p>
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
</style>
