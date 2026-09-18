<script lang="ts">
  /**
   * Excel's Sort dialog: a level per key, each a column and an order, over
   * the block the shell worked out, with "My data has headers" deciding
   * whether the first row is named in the column lists or sorted with the
   * rest. Add Level, Delete Level, OK; the shell does the sorting, in one
   * undo, from the keys handed back.
   */
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
    onApply: (keys: SortKey[], hasHeaders: boolean) => void
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, block, headerGuess, activeCol, onApply, onClose }: Props = $props()

  let levels = $state<SortKey[]>([])
  let hasHeaders = $state(true)

  const raw = (r: number, c: number) => workbook.getRaw(workbook.active, r, c)

  /** The column list: the header text when the block has headers, else the letter. */
  const columns = $derived.by(() =>
    Array.from({ length: block.right - block.left + 1 }, (_, i) => {
      const col = block.left + i
      const letter = `Column ${colToLetters(col)}`
      return { col, label: hasHeaders ? raw(block.top, col) || letter : letter }
    }),
  )

  $effect(() => {
    if (!open) return
    untrack(() => {
      hasHeaders = headerGuess
      levels = [{ col: Math.min(Math.max(activeCol, block.left), block.right), direction: 'asc' }]
    })
  })

  function addLevel() {
    // The next column not yet used, or the first one when all are.
    const used = new Set(levels.map((l) => l.col))
    const free = columns.find((c) => !used.has(c.col)) ?? columns[0]
    if (!free) return
    levels = [...levels, { col: free.col, direction: 'asc' }]
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

<SvModal bind:open onClose={onClose} title="Sort" size="sm" width={460}>
  <form class="sv-sheet-dialog sort" onsubmit={(e) => { e.preventDefault(); ok() }}>
    <div class="toolbar">
      <button type="button" class="btn" onclick={addLevel} disabled={levels.length >= columns.length}>Add Level</button>
      <button type="button" class="btn" onclick={() => deleteLevel(levels.length - 1)} disabled={levels.length <= 1}>Delete Level</button>
      <span class="spacer"></span>
      <label class="check"><input type="checkbox" bind:checked={hasHeaders} /> My data has headers</label>
    </div>
    <div class="levels" role="list" aria-label="Sort levels">
      {#each levels as level, index (index)}
        <div class="level" role="listitem">
          <span class="by">{index === 0 ? 'Sort by' : 'Then by'}</span>
          <select aria-label={`${index === 0 ? 'Sort by' : 'Then by'} column`} bind:value={level.col}>
            {#each columns as c (c.col)}<option value={c.col}>{c.label}</option>{/each}
          </select>
          <select aria-label={`${index === 0 ? 'Sort by' : 'Then by'} order`} bind:value={level.direction}>
            <option value="asc">A to Z</option>
            <option value="desc">Z to A</option>
          </select>
        </div>
      {/each}
    </div>
    <p class="hint">
      Sorting {colToLetters(block.left)}{block.top + 1}:{colToLetters(block.right)}{block.bottom + 1}.
      Numbers sort before text, blanks go last, and formats move with their rows.
    </p>
  </form>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={ok} disabled={!levels.length}>OK</button>
      <button type="button" class="btn" onclick={close}>Cancel</button>
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
    grid-template-columns: 64px 1fr 110px;
    align-items: center;
    gap: 8px;
  }
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
