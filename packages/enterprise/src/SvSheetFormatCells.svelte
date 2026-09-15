<script lang="ts">
  /**
   * Excel's Format Cells, the six tabs that have something behind them in
   * the sheet: Number, Alignment, Font, Border, Fill, Protection. It opens on the active
   * cell's format and, on OK, applies only what was changed to the whole
   * selection, so setting a fill on a block with mixed fonts leaves the
   * fonts as they were. One undo, through `applyFormat`.
   *
   * The shell opens it for Ctrl+1, the group launchers on the ribbon, the
   * cell menu's Format Cells... and the `format-cells` action.
   */
  import { SvModal } from '@svgrid/grid'
  import type { CellFormatEntry } from './sheet/format-store'
  import { compileNumberFormat, FORMAT_PRESETS, formatCategory } from './sheet/number-format'
  import { FONT_FAMILIES, FONT_SIZES, type BorderPreset } from './sheet/ribbon'
  import { ALL_COLOURS } from './sheet/palette'

  type Props = {
    open?: boolean
    /** The active cell's format, what the dialog opens on. */
    entry: CellFormatEntry | undefined
    /** The active cell's value, for the Number tab's sample. */
    sample: unknown
    /** The selection holds locked and unlocked cells both: the Protection
     *  tab's box opens indeterminate and, left alone, changes nothing. */
    mixedLocked?: boolean
    onApply: (patch: CellFormatEntry, border: BorderPreset | null) => void
    onClose?: () => void
  }

  let { open = $bindable(false), entry, sample, mixedLocked = false, onApply, onClose }: Props = $props()

  type Tab = 'number' | 'alignment' | 'font' | 'border' | 'fill' | 'protection'
  const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: 'number', label: 'Number' },
    { id: 'alignment', label: 'Alignment' },
    { id: 'font', label: 'Font' },
    { id: 'border', label: 'Border' },
    { id: 'fill', label: 'Fill' },
    { id: 'protection', label: 'Protection' },
  ]
  let tab = $state<Tab>('number')

  type Category = 'general' | 'number' | 'currency' | 'percent' | 'date' | 'time' | 'scientific' | 'custom'
  const CATEGORIES: ReadonlyArray<{ id: Category; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'number', label: 'Number' },
    { id: 'currency', label: 'Currency' },
    { id: 'percent', label: 'Percentage' },
    { id: 'date', label: 'Date' },
    { id: 'time', label: 'Time' },
    { id: 'scientific', label: 'Scientific' },
    { id: 'custom', label: 'Custom' },
  ]

  // Number
  let category = $state<Category>('general')
  let decimals = $state(2)
  let thousands = $state(true)
  let custom = $state('')
  // Alignment
  let align = $state<'' | 'left' | 'center' | 'right'>('')
  let wrap = $state(false)
  let indent = $state(0)
  // Font
  let fontFamily = $state('')
  let fontSize = $state('')
  let bold = $state(false)
  let italic = $state(false)
  let underline = $state(false)
  let strike = $state(false)
  let colorAuto = $state(true)
  let color = $state('#000000')
  // Border
  let border = $state<BorderPreset | ''>('')
  // Fill
  let fill = $state<string | null>(null)
  // Protection: null is the indeterminate box of a mixed selection.
  let locked = $state<boolean | null>(true)

  let initial: CellFormatEntry = {}
  /** What the colour input opened on, so an untouched picker keeps a colour
   *  the input cannot show (a CSS name, an rgb()) rather than replacing it. */
  let initialColor = '#000000'

  /** Which category a pattern belongs to, so the dialog opens on it. */
  const categoryOf = (fmt: string | undefined): { category: Category; decimals: number; thousands: boolean } =>
    formatCategory(fmt)

  const zeros = (n: number) => (n > 0 ? '.' + '0'.repeat(n) : '')

  /** The pattern the Number tab's choices spell. */
  const pattern = $derived.by<string | undefined>(() => {
    switch (category) {
      case 'general': return undefined
      case 'number': return `${thousands ? '#,##' : ''}0${zeros(decimals)}`
      case 'currency': return `$#,##0${zeros(decimals)};($#,##0${zeros(decimals)})`
      case 'percent': return `0${zeros(decimals)}%`
      case 'date': return FORMAT_PRESETS.date
      case 'time': return FORMAT_PRESETS.time
      case 'scientific': return `0${zeros(decimals)}E+00`
      case 'custom': return custom || undefined
    }
  })

  const preview = $derived.by(() => {
    if (sample === '' || sample == null) return ''
    if (!pattern) return String(sample)
    try { return compileNumberFormat(pattern).format(sample).text } catch { return String(sample) }
  })

  // Open on the active cell's format.
  $effect(() => {
    if (!open) return
    initial = { ...(entry ?? {}) }
    const num = categoryOf(initial.numFmt)
    category = num.category
    decimals = num.decimals
    thousands = num.thousands
    custom = initial.numFmt ?? ''
    align = initial.align ?? ''
    wrap = initial.wrap ?? false
    indent = initial.indent ?? 0
    fontFamily = initial.fontFamily ?? ''
    fontSize = initial.fontSize ? String(initial.fontSize) : ''
    bold = !!initial.bold
    italic = !!initial.italic
    underline = !!initial.underline
    strike = !!initial.strike
    colorAuto = !initial.color
    color = /^#[0-9a-f]{6}$/i.test(initial.color ?? '') ? initial.color! : '#000000'
    initialColor = color
    border = ''
    fill = initial.fill ?? null
    locked = mixedLocked ? null : initial.locked !== false
  })

  function ok() {
    // Only what changed goes into the patch; `undefined` clears a field.
    const patch: CellFormatEntry = {}
    const set = <K extends keyof CellFormatEntry>(key: K, next: CellFormatEntry[K]) => {
      if (initial[key] !== next) patch[key] = next
    }
    set('numFmt', pattern)
    set('align', align || undefined)
    set('wrap', wrap || undefined)
    set('indent', indent > 0 ? indent : undefined)
    set('fontFamily', fontFamily || undefined)
    set('fontSize', fontSize ? Number(fontSize) : undefined)
    set('bold', bold || undefined)
    set('italic', italic || undefined)
    set('underline', underline || undefined)
    set('strike', strike || undefined)
    set('color', colorAuto ? undefined : color === initialColor ? initial.color : color)
    set('fill', fill ?? undefined)
    // Locked is the default, so only "unlocked" is ever stored; a mixed
    // selection left indeterminate stays as it was.
    if (locked !== null) {
      const next = locked ? undefined : false
      if (mixedLocked || initial.locked !== next) patch.locked = next
    }
    onApply(patch, border || null)
    open = false
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }

  const BORDERS: ReadonlyArray<{ value: BorderPreset; label: string }> = [
    { value: 'none', label: 'None' },
    { value: 'outside', label: 'Outline' },
    { value: 'all', label: 'All borders' },
    { value: 'top', label: 'Top' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'thick-bottom', label: 'Thick bottom' },
  ]
</script>

<SvModal bind:open onClose={onClose} title="Format Cells" size="md">
  <div class="sv-sheet-dialog format" role="group" aria-label="Format Cells">
    <div class="tabs" role="tablist" aria-label="Format Cells tabs">
      {#each TABS as t (t.id)}
        <button
          type="button"
          role="tab"
          class="tab"
          class:on={tab === t.id}
          aria-selected={tab === t.id}
          onclick={() => (tab = t.id)}
        >{t.label}</button>
      {/each}
    </div>

    <div class="panel" role="tabpanel">
      {#if tab === 'number'}
        <div class="number">
          <div class="categories">
            <div class="label">Category:</div>
            <ul role="listbox" aria-label="Category">
              {#each CATEGORIES as c (c.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
                <li role="option" aria-selected={category === c.id} class:selected={category === c.id} onclick={() => (category = c.id)}>{c.label}</li>
              {/each}
            </ul>
          </div>
          <div class="settings">
            <div class="sample">
              <div class="label">Sample</div>
              <div class="sample-text">{preview}</div>
            </div>
            {#if category === 'number' || category === 'currency' || category === 'percent' || category === 'scientific'}
              <label class="field auto">
                <span>Decimal places:</span>
                <input type="number" min="0" max="10" bind:value={decimals} />
              </label>
            {/if}
            {#if category === 'number'}
              <label class="check"><input type="checkbox" bind:checked={thousands} /> Use 1000 separator (,)</label>
            {/if}
            {#if category === 'custom'}
              <label class="field auto">
                <span>Type:</span>
                <input type="text" bind:value={custom} spellcheck="false" placeholder="#,##0.00" />
              </label>
            {/if}
            <p class="hint">
              {#if category === 'general'}General format cells have no specific number format.
              {:else if category === 'number'}Number is used for general display of numbers.
              {:else if category === 'currency'}Currency formats are used for general monetary values.
              {:else if category === 'percent'}Percentage formats multiply the cell value by 100 and display the result with a percent symbol.
              {:else if category === 'date'}Date formats display date serial numbers as dates.
              {:else if category === 'time'}Time formats display date serial numbers as times.
              {:else if category === 'scientific'}Scientific formats display numbers in exponential notation.
              {:else}Type the number format code, using one of the existing codes as a starting point.{/if}
            </p>
          </div>
        </div>
      {:else if tab === 'alignment'}
        <label class="field">
          <span>Horizontal:</span>
          <select bind:value={align}>
            <option value="">General</option>
            <option value="left">Left (Indent)</option>
            <option value="center">Center</option>
            <option value="right">Right (Indent)</option>
          </select>
        </label>
        <label class="field">
          <span>Indent:</span>
          <input type="number" min="0" max="15" bind:value={indent} />
        </label>
        <div class="label">Text control</div>
        <label class="check"><input type="checkbox" bind:checked={wrap} /> Wrap text</label>
      {:else if tab === 'font'}
        <label class="field">
          <span>Font:</span>
          <select bind:value={fontFamily}>
            {#each FONT_FAMILIES as f (f.value)}
              <option value={f.value}>{f.label}</option>
            {/each}
          </select>
        </label>
        <label class="field">
          <span>Size:</span>
          <select bind:value={fontSize}>
            <option value="">Default</option>
            {#each FONT_SIZES as s (s)}
              <option value={String(s)}>{s}</option>
            {/each}
          </select>
        </label>
        <div class="label">Font style</div>
        <div class="checks">
          <label class="check"><input type="checkbox" bind:checked={bold} /> Bold</label>
          <label class="check"><input type="checkbox" bind:checked={italic} /> Italic</label>
          <label class="check"><input type="checkbox" bind:checked={underline} /> Underline</label>
          <label class="check"><input type="checkbox" bind:checked={strike} /> Strikethrough</label>
        </div>
        <div class="label">Color</div>
        <div class="checks">
          <label class="check"><input type="checkbox" bind:checked={colorAuto} /> Automatic</label>
          <input type="color" bind:value={color} disabled={colorAuto} aria-label="Font colour" />
        </div>
        <div class="font-preview" style:font-family={fontFamily || undefined} style:font-size={fontSize ? `${fontSize}px` : undefined} style:font-weight={bold ? 700 : 400} style:font-style={italic ? 'italic' : 'normal'} style:text-decoration={[underline ? 'underline' : '', strike ? 'line-through' : ''].join(' ').trim() || 'none'} style:color={colorAuto ? undefined : color}>AaBbCcYyZz</div>
      {:else if tab === 'border'}
        <div class="label">Presets</div>
        <div class="borders" role="radiogroup" aria-label="Border">
          <label class="check"><input type="radio" name="sheet-border" value="" bind:group={border} /> Keep as is</label>
          {#each BORDERS as b (b.value)}
            <label class="check"><input type="radio" name="sheet-border" value={b.value} bind:group={border} /> {b.label}</label>
          {/each}
        </div>
        <p class="hint">Bottom, top, left and right go on the edge of the selection; All borders lines every cell; Outline frames the block.</p>
      {:else if tab === 'fill'}
        <div class="label">Background Color</div>
        <div class="no-fill">
          <button type="button" class="swatch none" class:on={fill === null} aria-label="No Color" title="No Color" onclick={() => (fill = null)}></button>
          <span>No Color</span>
        </div>
        <div class="swatches" role="radiogroup" aria-label="Fill colour">
          {#each ALL_COLOURS as c, i (i)}
            <button type="button" class="swatch" class:on={fill === c.value} style:background={c.value} aria-label={c.label} title={c.label} onclick={() => (fill = c.value)}></button>
          {/each}
        </div>
        <div class="sample">
          <div class="label">Sample</div>
          <div class="fill-sample" style:background={fill ?? 'transparent'}></div>
        </div>
      {:else if tab === 'protection'}
        <label class="check">
          <input
            type="checkbox"
            checked={locked === true}
            indeterminate={locked === null}
            onchange={(e) => (locked = (e.currentTarget as HTMLInputElement).checked)}
          />
          Locked
        </label>
        <p class="hint">Locking cells has no effect until you protect the sheet (Review tab, Protect Sheet). Every cell is locked to begin with; unlock the ones that may change, then protect the sheet.</p>
      {/if}
    </div>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok}>OK</button>
      <button type="button" class="btn" onclick={close}>Cancel</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .tabs {
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--sg-border, #d1d1d1);
  }
  .tab {
    padding: 5px 12px;
    font: inherit;
    font-size: 13px;
    color: var(--sg-muted, #616161);
    background: transparent;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: var(--sg-radius, 3px) var(--sg-radius, 3px) 0 0;
    cursor: pointer;
  }
  .tab:hover { color: var(--sg-fg, #242424); }
  .tab.on {
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border-color: var(--sg-border, #d1d1d1);
    margin-bottom: -1px;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 220px;
    padding-top: 4px;
  }
  .label { font-weight: 600; }
  .number {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 14px;
  }
  .categories ul {
    height: 200px;
    margin: 4px 0 0;
    padding: 2px 0;
    overflow-y: auto;
    list-style: none;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
  }
  .categories li { padding: 2px 8px; cursor: default; }
  .categories li:hover { background: var(--sg-row-hover-bg, #f5f5f5); }
  .categories li.selected { color: var(--sg-on-accent, #fff); background: var(--sg-accent, #217346); }
  .settings { display: flex; flex-direction: column; gap: 10px; }
  .sample { display: flex; flex-direction: column; gap: 4px; }
  .sample-text,
  .font-preview,
  .fill-sample {
    min-height: 28px;
    padding: 4px 8px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
  }
  .font-preview { min-height: 44px; display: flex; align-items: center; }
  .fill-sample { min-height: 44px; }
  .hint { margin: 0; color: var(--sg-muted, #616161); }
  .borders { display: grid; grid-template-columns: repeat(3, auto); gap: 6px 16px; justify-content: start; }
  .no-fill { display: flex; align-items: center; gap: 8px; }
  .swatches {
    display: grid;
    grid-template-columns: repeat(10, 22px);
    gap: 3px;
  }
  .swatch {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 2px;
    cursor: pointer;
  }
  .swatch.none {
    background:
      linear-gradient(to top left, transparent calc(50% - 1px), var(--sg-danger, #c00) calc(50% - 1px), var(--sg-danger, #c00) calc(50% + 1px), transparent calc(50% + 1px)),
      var(--sg-bg, #fff);
  }
  .swatch.on { outline: 2px solid var(--sg-accent, #217346); outline-offset: 1px; }
</style>
