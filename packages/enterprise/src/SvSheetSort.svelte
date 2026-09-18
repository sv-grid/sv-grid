<script lang="ts">
  /**
   * Excel's Sort dialog: a level per key, each a column and an order, over
   * the block the shell worked out, with "My data has headers" deciding
   * whether the first row is named in the column lists or sorted with the
   * rest. Add Level, Delete Level, OK; the shell does the sorting, in one
   * undo, from the keys handed back.
   */
  import { useSheetText } from './sheet-text'
  import { untrack } from 'svelte'
  import { SvModal } from '@svgrid/grid'
  import type { Workbook } from './sheet/workbook'
  import type { SortKey } from './sheet/sort'
  import { colToLetters } from './sheet/address'

  type Block = { top: number; left: number; bottom: number; right: number }

  type Props = {
    open?: boolean
    workbook: Workbook
    /** The block to sort, and whether its first row looks like headers. */
    block: Block
    headerGuess: boolean
    /** The column the dialog opens on: the active cell's. */
    activeCol: number
    /**
     * A cell's fill or font colour, for a level that sorts on one. Without
     * it the Sort On list offers values only, since there would be no
     * colours to offer.
     */
    colourAt?: (row: number, col: number, on: 'fill' | 'color') => string | null
    onApply: (keys: SortKey[], hasHeaders: boolean) => void
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, block, headerGuess, activeCol, colourAt, onApply, onClose }: Props = $props()
  const t = useSheetText()

  let levels = $state<SortKey[]>([])
  let hasHeaders = $state(true)

  const raw = (r: number, c: number) => workbook.getRaw(workbook.active, r, c)

  /** The column list: the header text when the block has headers, else the letter. */
  const columns = $derived.by(() =>
    Array.from({ length: block.right - block.left + 1 }, (_, i) => {
      const col = block.left + i
      const letter = t('sort.columnLetter', { letter: colToLetters(col) })
      return { col, label: hasHeaders ? raw(block.top, col) || letter : letter }
    }),
  )

  $effect(() => {
    if (!open) return
    untrack(() => {
      hasHeaders = headerGuess
      levels = [{ col: Math.min(Math.max(activeCol, block.left), block.right), direction: 'asc', on: 'value' }]
    })
  })

  /**
   * The colours a level's column carries, each once. Excel offers exactly
   * these, because a colour that is nowhere in the column would sort
   * nothing.
   */
  function coloursIn(col: number, on: 'fill' | 'color'): string[] {
    if (!colourAt) return []
    const seen: string[] = []
    for (let r = block.top + (hasHeaders ? 1 : 0); r <= block.bottom; r += 1) {
      const colour = colourAt(r, col, on)?.trim().toLowerCase()
      if (colour && !seen.includes(colour)) seen.push(colour)
    }
    return seen
  }

  /** Keep a level's colour one the column actually carries. */
  function onSortOnChange(level: SortKey) {
    if (level.on === 'value') { level.colour = undefined; return }
    const colours = coloursIn(level.col, level.on === 'color' ? 'color' : 'fill')
    if (!level.colour || !colours.includes(level.colour)) level.colour = colours[0]
  }

  function addLevel() {
    // The next column not yet used, or the first one when all are.
    const used = new Set(levels.map((l) => l.col))
    const free = columns.find((c) => !used.has(c.col)) ?? columns[0]
    if (!free) return
    levels = [...levels, { col: free.col, direction: 'asc', on: 'value' }]
  }

  function deleteLevel(index: number) {
    if (levels.length <= 1) return
    levels = levels.filter((_, i) => i !== index)
  }

  function ok() {
    if (!levels.length) return
    onApply(levels.map((l) => ({ ...l })), hasHeaders)
    open = false
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('sort.title')} size="sm" width={460}>
  <form class="sv-sheet-dialog sort" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <div class="toolbar">
      <button type="button" class="btn" onclick={addLevel} disabled={levels.length >= columns.length}>{t('sort.addLevel')}</button>
      <button type="button" class="btn" onclick={() => deleteLevel(levels.length - 1)} disabled={levels.length <= 1}>{t('sort.deleteLevel')}</button>
      <span class="spacer"></span>
      <label class="check"><input type="checkbox" bind:checked={hasHeaders} /> {t('sort.hasHeaders')}</label>
    </div>
    <div class="levels" role="list" aria-label={t('sort.levels')}>
      {#each levels as level, index (index)}
        {@const by = t(index === 0 ? 'sort.sortBy' : 'sort.thenBy')}
        <div class="level" role="listitem">
          <span class="by">{by}</span>
          <select aria-label={t('sort.column', { by })} bind:value={level.col}>
            {#each columns as c (c.col)}<option value={c.col}>{c.label}</option>{/each}
          </select>
          <select
            aria-label={t('sort.on', { by })}
            bind:value={level.on}
            onchange={() => onSortOnChange(level)}
            disabled={!colourAt}
          >
            <option value="value">{t('sort.onValue')}</option>
            <option value="fill">{t('sort.onFill')}</option>
            <option value="color">{t('sort.onFont')}</option>
          </select>
          <select aria-label={t('sort.order', { by })} bind:value={level.direction}>
            <option value="asc">{level.on === 'value' ? t('sort.asc') : t('sort.onTop')}</option>
            <option value="desc">{level.on === 'value' ? t('sort.desc') : t('sort.onBottom')}</option>
          </select>
          {#if level.on !== 'value'}
            {@const colours = coloursIn(level.col, level.on === 'color' ? 'color' : 'fill')}
            <span class="colour-row">
              <span class="by">{t('sort.colour')}</span>
              {#if colours.length}
                <select aria-label={t('sort.colour')} bind:value={level.colour}>
                  {#each colours as colour (colour)}<option value={colour}>{colour}</option>{/each}
                </select>
                <span class="swatch" style:background={level.colour} aria-hidden="true"></span>
              {:else}
                <span class="none">{t('sort.noColours')}</span>
              {/if}
            </span>
          {/if}
        </div>
      {/each}
    </div>
    <p class="hint">
      {t('sort.hint', { range: `${colToLetters(block.left)}${block.top + 1}:${colToLetters(block.right)}${block.bottom + 1}` })}
    </p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok} disabled={!levels.length}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  .toolbar .spacer { flex: 1; }
  .levels {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
    background: var(--sg-bg, #fff);
  }
  .level {
    display: grid;
    grid-template-columns: 64px 1fr 104px 112px;
    align-items: center;
    gap: 8px;
  }
  /* The colour a colour level sorts on, under the level it belongs to. */
  .colour-row {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 64px 1fr auto;
    align-items: center;
    gap: 8px;
  }
  .colour-row .swatch {
    width: 18px;
    height: 18px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
  }
  .colour-row .none { color: var(--sg-muted, #616161); font-size: 12px; }
  .level .by { color: var(--sg-muted, #616161); }
  .level select {
    min-width: 0;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 2px;
    padding: 2px 4px;
  }
  .check { display: inline-flex; align-items: center; gap: 6px; }
  .hint { margin: 8px 0 0; color: var(--sg-muted, #616161); font-size: 12px; }
</style>
