<script lang="ts">
  /**
   * Excel's small conditional-formatting dialogs, one component: Greater
   * Than..., Less Than..., Between..., Equal To..., Text that Contains...,
   * Duplicate Values..., Top 10 Items..., Bottom 10 Items..., Above Average
   * and Below Average. Each is a sentence with its inputs and the "with"
   * picker of Excel's six styles. It opens empty for a new rule from the
   * ribbon, or on a rule from Manage Rules > Edit, and hands back the rule's
   * body for the shell to place.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import { CF_PRESET_STYLES, type CfPreset, type CfBody, type CfStyledRule } from './sheet/conditional-formats'

  type Props = {
    open?: boolean
    preset: CfPreset
    /** The rule being edited, for Manage Rules > Edit. */
    rule?: CfStyledRule | null
    /** The selection as A1, for the heading. */
    address: string
    onApply: (body: CfBody) => void
    onClose?: () => void
  }

  let { open = $bindable(false), preset, rule = null, address, onApply, onClose }: Props = $props()
  const t = useSheetText()


  let value1 = $state('')
  let value2 = $state('')
  let rank = $state('10')
  let percent = $state(false)
  let unique = $state(false)
  let styleId = $state(CF_PRESET_STYLES[0]!.id)
  let first = $state<HTMLInputElement | HTMLSelectElement | null>(null)

  $effect(() => {
    if (!open) return
    value1 = ''
    value2 = ''
    rank = '10'
    percent = false
    unique = false
    styleId = CF_PRESET_STYLES[0]!.id
    const r = rule
    if (r) {
      if (r.kind === 'cellIs') { value1 = r.value1; value2 = r.value2 ?? '' }
      else if (r.kind === 'text') value1 = r.value
      else if (r.kind === 'duplicates') unique = !!r.unique
      else if (r.kind === 'topBottom') { rank = String(r.rank); percent = !!r.percent }
      else if (r.kind === 'formula') value1 = r.formula
      const match = CF_PRESET_STYLES.find((p) => JSON.stringify(p.style) === JSON.stringify(r.style))
      if (match) styleId = match.id
    }
    queueMicrotask(() => first?.focus())
  })

  const needsValue = $derived(preset === 'greater' || preset === 'less' || preset === 'between' || preset === 'equal' || preset === 'text' || preset === 'formula')
  const valid = $derived(
    (!needsValue || value1.trim() !== '')
      && (preset !== 'between' || value2.trim() !== '')
      && ((preset !== 'top10' && preset !== 'bottom10') || (Number.isInteger(Number(rank)) && Number(rank) > 0)),
  )

  function body(): CfBody {
    const style = CF_PRESET_STYLES.find((p) => p.id === styleId)?.style ?? CF_PRESET_STYLES[0]!.style
    switch (preset) {
      case 'greater': return { kind: 'cellIs', operator: 'greater', value1: value1.trim(), style }
      case 'less': return { kind: 'cellIs', operator: 'less', value1: value1.trim(), style }
      case 'between': return { kind: 'cellIs', operator: 'between', value1: value1.trim(), value2: value2.trim(), style }
      case 'equal': return { kind: 'cellIs', operator: 'equal', value1: value1.trim(), style }
      case 'text': return { kind: 'text', match: 'contains', value: value1.trim(), style }
      case 'duplicates': return { kind: 'duplicates', unique, style }
      case 'top10': return { kind: 'topBottom', top: true, rank: Number(rank), percent, style }
      case 'bottom10': return { kind: 'topBottom', top: false, rank: Number(rank), percent, style }
      case 'aboveAverage': return { kind: 'average', above: true, style }
      case 'belowAverage': return { kind: 'average', above: false, style }
      case 'formula': {
        const text = value1.trim()
        return { kind: 'formula', formula: text.startsWith('=') ? text : `=${text}`, style }
      }
    }
  }

  function ok() {
    if (!valid) return
    onApply(body())
    open = false
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }

  const sample = $derived(CF_PRESET_STYLES.find((p) => p.id === styleId)?.style ?? {})
</script>

<SvModal bind:open onClose={onClose} title={t(`cf.title.${preset}`)} size="sm" width={440}>
  <form class="sv-sheet-dialog cf" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <div class="where">{address}</div>
    <div class="lead">{t(`cf.lead.${preset}`)}</div>
    <div class="row">
      {#if preset === 'between'}
        <input bind:this={first} type="text" bind:value={value1} aria-label={t('cf.lowerValue')} spellcheck="false" />
        <span>{t('cf.and')}</span>
        <input type="text" bind:value={value2} aria-label={t('cf.upperValue')} spellcheck="false" />
      {:else if needsValue}
        <input bind:this={first} type="text" bind:value={value1} aria-label={t(preset === 'formula' ? 'cf.formula' : 'cf.value')} spellcheck="false" placeholder={preset === 'text' ? t('cf.textPlaceholder') : preset === 'formula' ? '=$B2>100' : t('cf.valuePlaceholder')} />
      {:else if preset === 'duplicates'}
        <select bind:this={first} bind:value={unique} aria-label={t('cf.duplicateOrUnique')}>
          <option value={false}>{t('cf.duplicate')}</option>
          <option value={true}>{t('cf.unique')}</option>
        </select>
        <span>{t('cf.values')}</span>
      {:else if preset === 'top10' || preset === 'bottom10'}
        <input bind:this={first} type="number" min="1" bind:value={rank} aria-label={t('cf.howMany')} />
        <label class="check"><input type="checkbox" bind:checked={percent} /> {t('cf.percentOfRange')}</label>
      {/if}
      <span>{t('cf.with')}</span>
      <select bind:value={styleId} aria-label={t('cf.formatStyle')}>
        {#each CF_PRESET_STYLES as p (p.id)}<option value={p.id}>{t(`cf.style.${p.id}`)}</option>{/each}
      </select>
    </div>
    {#if preset === 'formula'}
      <p class="hint">{t('cf.formulaHint')}</p>
    {/if}
    <div class="sample" style:background={sample.fill ?? 'transparent'} style:color={sample.color ?? 'inherit'}>AaBbCcYyZz</div>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok} disabled={!valid}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .where { color: var(--sg-muted, #616161); }
  .lead { font-weight: 600; }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .row input[type="text"] { flex: 1 1 110px; min-width: 90px; }
  .row input[type="number"] { width: 64px; }
  .row select { max-width: 240px; }
  .sample {
    width: 120px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    text-align: center;
  }
</style>
