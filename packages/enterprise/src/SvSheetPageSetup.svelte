<script lang="ts">
  /**
   * Excel's Page Setup dialog, the one page of it the sheet prints from:
   * orientation, paper, a margins preset, the scale, the print area, the
   * rows that repeat at the top of every page, and whether gridlines and
   * headings print. Opens on the sheet's setup, hands the whole thing back
   * on OK, and Print... hands it back and prints. Print Titles on the
   * ribbon opens the same dialog, as Excel's opens Page Setup on its
   * Sheet tab.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import { MARGIN_PRESETS, PAPER_SIZES, marginPresetOf, copyPageSetup, type PageSetup, type PaperSize, type MarginPreset } from './sheet/page-setup'
  import { parseRangeText, rangeText } from './sheet/protection'

  type Props = {
    open?: boolean
    /** The sheet's setup as it stands. */
    setup: PageSetup
    onApply: (setup: PageSetup) => void
    /** Print...: the shell applies and prints. */
    onPrint: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), setup, onApply, onPrint, onClose }: Props = $props()
  const t = useSheetText()

  let orientation = $state<PageSetup['orientation']>('portrait')
  let paper = $state<PaperSize>('A4')
  let margins = $state<MarginPreset | 'custom'>('normal')
  let scale = $state('100')
  let area = $state('')
  let titles = $state('')
  let gridlines = $state(false)
  let headings = $state(false)
  let problem = $state<string | null>(null)
  let first = $state<HTMLSelectElement | null>(null)

  const PAPERS = Object.keys(PAPER_SIZES) as PaperSize[]

  $effect(() => {
    if (!open) return
    orientation = setup.orientation
    paper = setup.paper
    margins = marginPresetOf(setup.margins) ?? 'custom'
    scale = String(setup.scale)
    area = setup.printArea ? rangeText(setup.printArea) : ''
    titles = setup.printTitleRows ? `${setup.printTitleRows[0] + 1}:${setup.printTitleRows[1] + 1}` : ''
    gridlines = setup.gridlines
    headings = setup.headings
    problem = null
    queueMicrotask(() => first?.focus())
  })

  /** The setup as the fields say, or null with `problem` set. */
  function read(): PageSetup | null {
    const next = copyPageSetup(setup)
    next.orientation = orientation
    next.paper = paper
    if (margins !== 'custom') next.margins = { ...MARGIN_PRESETS[margins] }
    const pct = Number(scale)
    next.scale = Number.isFinite(pct) && pct >= 10 && pct <= 400 ? Math.round(pct) : 100
    if (area.trim()) {
      const rects = parseRangeText(area)
      if (!rects) { problem = t('pageSetup.invalidArea', { text: area }); return null }
      next.printArea = rects
    } else next.printArea = null
    if (titles.trim()) {
      const m = /^\$?(\d+)\s*:\s*\$?(\d+)$/.exec(titles.trim()) ?? /^\$?(\d+)$/.exec(titles.trim())
      if (!m) { problem = t('pageSetup.invalidRows', { text: titles }); return null }
      const a = Number(m[1]) - 1
      const b = Number(m[2] ?? m[1]) - 1
      if (a < 0 || b < a) { problem = t('pageSetup.invalidRows', { text: titles }); return null }
      next.printTitleRows = [a, b]
    } else next.printTitleRows = null
    next.gridlines = gridlines
    next.headings = headings
    problem = null
    return next
  }

  function ok() {
    const next = read()
    if (!next) return
    open = false
    onApply(next)
    onClose?.()
  }

  function print() {
    const next = read()
    if (!next) return
    open = false
    onApply(next)
    onPrint()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('pageSetup.title')} size="sm" width={420}>
  <form class="sv-sheet-dialog" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <label class="field">
      <span>{t('pageSetup.orientation')}</span>
      <select bind:this={first} bind:value={orientation}>
        <option value="portrait">{t('pageSetup.portrait')}</option>
        <option value="landscape">{t('pageSetup.landscape')}</option>
      </select>
    </label>
    <label class="field">
      <span>{t('pageSetup.paper')}</span>
      <select bind:value={paper}>
        {#each PAPERS as p (p)}<option value={p}>{p}</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>{t('pageSetup.margins')}</span>
      <select bind:value={margins}>
        <option value="normal">{t('pageSetup.margins.normal')}</option>
        <option value="narrow">{t('pageSetup.margins.narrow')}</option>
        <option value="wide">{t('pageSetup.margins.wide')}</option>
        {#if margins === 'custom'}<option value="custom">{t('pageSetup.margins.custom')}</option>{/if}
      </select>
    </label>
    <label class="field">
      <span>{t('pageSetup.scale')}</span>
      <input type="number" min="10" max="400" bind:value={scale} />
    </label>
    <label class="field">
      <span>{t('pageSetup.printArea')}</span>
      <input type="text" bind:value={area} spellcheck="false" placeholder={t('pageSetup.printAreaPlaceholder')} />
    </label>
    <label class="field">
      <span>{t('pageSetup.titleRows')}</span>
      <input type="text" bind:value={titles} spellcheck="false" placeholder={t('pageSetup.titleRowsPlaceholder')} />
    </label>
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={gridlines} /> {t('pageSetup.gridlines')}</label>
      <label class="check"><input type="checkbox" bind:checked={headings} /> {t('pageSetup.headings')}</label>
    </div>
    {#if problem}<p class="status problem" role="alert">{problem}</p>{/if}
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={print}>{t('pageSetup.print')}</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={ok}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .spacer { flex: 1; }
</style>
