<script lang="ts">
  /**
   * Excel's Remove Duplicates: the columns of the block around the
   * selection, tick the ones that decide what a duplicate is, say whether
   * the first row is headers, OK. Survivors close up from the top and the
   * rows they vacated go blank, in one batch, so it is one Ctrl+Z; the
   * sentence Excel's dialog ends on is handed back for the status bar.
   */
  import { untrack } from 'svelte'
  import { SvModal } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import type { Workbook } from './sheet/workbook'
  import { findDuplicates } from './sheet/transforms'
  import { colToLetters } from './sheet/address'

  type Props = {
    open?: boolean
    workbook: Workbook
    cmd: () => GridCommandContext | null
    onDone: (message: string) => void
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, cmd, onDone, onClose }: Props = $props()

  type Block = { top: number; left: number; bottom: number; right: number }
  let block = $state<Block>({ top: 0, left: 0, bottom: 0, right: 0 })
  let chosen = $state<boolean[]>([])
  let hasHeaders = $state(true)

  const raw = (r: number, c: number) => workbook.getRaw(workbook.active, r, c)

  const headers = $derived.by(() =>
    Array.from({ length: block.right - block.left + 1 }, (_, i) => {
      const letter = colToLetters(block.left + i)
      return hasHeaders ? raw(block.top, block.left + i) || `Column ${letter}` : `Column ${letter}`
    }),
  )

  /**
   * The block: the selection when it is a range, else everything used from
   * the active cell's column rightwards, top row down, the way Excel grows
   * a single cell to its current region.
   */
  $effect(() => {
    if (!open) return
    untrack(prepare)
  })

  function prepare() {
    const c = cmd()
    const range = c?.ranges[c.ranges.length - 1]
    const rows = Math.max(workbook.rowCount(workbook.active) - 1, 0)
    const cols = Math.max(workbook.colCount(workbook.active) - 1, 0)
    if (range && (range[0] !== range[2] || range[1] !== range[3])) {
      block = { top: range[0], left: range[1], bottom: Math.min(range[2], rows), right: Math.min(range[3], cols) }
    } else {
      const left = c?.activeCell?.colIndex ?? 0
      block = { top: 0, left, bottom: rows, right: Math.max(cols, left) }
    }
    chosen = Array.from({ length: block.right - block.left + 1 }, () => true)
  }

  function remove() {
    const c = cmd()
    if (!c) return
    const first = hasHeaders ? block.top + 1 : block.top
    const width = block.right - block.left + 1
    const rows = Array.from({ length: Math.max(block.bottom - first + 1, 0) }, (_, i) =>
      Array.from({ length: width }, (_, k) => raw(first + i, block.left + k)),
    )
    const columns = chosen.flatMap((on, i) => (on ? [i] : []))
    const report = findDuplicates(rows, { columns })
    const message = `${report.remove.length} duplicate value${report.remove.length === 1 ? '' : 's'} found and removed; ${report.keep.length} unique value${report.keep.length === 1 ? '' : 's'} remain.`
    if (report.remove.length > 0) {
      const kept = report.keep.map((i) => rows[i]!)
      c.batch(() => {
        for (let i = 0; i < rows.length; i += 1) {
          const source = kept[i]
          for (let k = 0; k < width; k += 1) {
            c.setCellValue(first + i, block.left + k, source ? source[k] ?? '' : '')
          }
        }
      })
    }
    open = false
    if (report.remove.length > 0) {
      c.setSelection(block.top, block.left)
      c.extendSelection(first + (report.keep.length || 1) - 1, block.right)
    }
    onDone(message)
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title="Remove Duplicates" size="sm">
  <div class="sv-sheet-dialog" role="group" aria-label="Remove Duplicates">
    <p class="lead">To delete duplicate values, select one or more columns that contain duplicates.</p>
    <div class="checks">
      <button type="button" class="small" onclick={() => (chosen = chosen.map(() => true))}>Select All</button>
      <button type="button" class="small" onclick={() => (chosen = chosen.map(() => false))}>Unselect All</button>
      <label class="check"><input type="checkbox" bind:checked={hasHeaders} /> My data has headers</label>
    </div>
    <fieldset class="group">
      <legend>Columns</legend>
      {#each headers as header, i (i)}
        <label class="check"><input type="checkbox" bind:checked={chosen[i]} /> {header}</label>
      {/each}
    </fieldset>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={remove} disabled={!chosen.some(Boolean)}>OK</button>
      <button type="button" class="btn" onclick={close}>Cancel</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .lead { margin: 0; }
  .group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow: auto;
    margin: 0;
    padding: 6px 10px 8px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
  }
  .group legend { padding: 0 4px; font-weight: 600; }
  .small {
    height: 24px;
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    cursor: pointer;
  }
</style>
