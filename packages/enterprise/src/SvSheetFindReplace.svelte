<script lang="ts">
  /**
   * Excel's Find and Replace, the Replace tab: what to find, what to put in
   * its place, whether case and the whole cell must match, and whether to
   * look at what a cell shows or at the formula behind it. Find Next walks
   * the sheet from the active cell and wraps; Replace changes the active
   * cell when it matches and moves on; Replace All is one undo.
   *
   * The shell opens it for Ctrl+H, the ribbon's Find & Select and the
   * `find-replace` action. It reads and writes through the find target the
   * shell registers, so a replacement lands in the workbook and in the
   * grid's history like a typed edit. Styled by the `.sv-sheet-dialog`
   * rules the shell carries for all four of its dialogs.
   */
  import { SvModal } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import { findAll, findNext, replaceOne, replaceAll, type FindOptions } from './sheet/find-replace'

  type Props = {
    open?: boolean
    /** The command context to search with; null while the grid has no api. */
    cmd: () => GridCommandContext | null
    onClose?: () => void
  }

  let { open = $bindable(false), cmd, onClose }: Props = $props()

  let findText = $state('')
  let replaceText = $state('')
  let matchCase = $state(false)
  let entireCell = $state(false)
  let lookIn = $state<'values' | 'formulas'>('values')
  let status = $state('')
  let findInput = $state<HTMLInputElement | null>(null)

  const options = (): FindOptions => ({ matchCase, matchEntireCell: entireCell, lookIn })

  // A fresh open starts with the caret in Find what, as Excel's does.
  $effect(() => {
    if (open) {
      status = ''
      queueMicrotask(() => findInput?.focus())
    }
  })

  function land(hit: { rowIndex: number; colIndex: number } | null) {
    const c = cmd()
    if (!c) return
    if (!hit) {
      status = findText ? `We couldn't find what you were looking for.` : ''
      return
    }
    c.setActiveCell(hit.rowIndex, hit.colIndex)
    c.setSelection(hit.rowIndex, hit.colIndex)
    c.scrollIntoView(hit.rowIndex, hit.colIndex)
    status = ''
  }

  function next(direction: 1 | -1 = 1) {
    const c = cmd()
    if (!c || !findText) return
    land(findNext(c, findText, options(), direction))
  }

  function countAll() {
    const c = cmd()
    if (!c || !findText) return
    const n = findAll(c, findText, options()).length
    status = n === 0 ? `We couldn't find what you were looking for.` : `${n} cell${n === 1 ? '' : 's'} found`
  }

  function replace() {
    const c = cmd()
    if (!c || !findText) return
    replaceOne(c, findText, replaceText, options())
  }

  function all() {
    const c = cmd()
    if (!c || !findText) return
    const n = replaceAll(c, findText, replaceText, options())
    status = n === 0
      ? `We couldn't find anything to replace.`
      : `All done. We made ${n} replacement${n === 1 ? '' : 's'}.`
  }

  function close() {
    open = false
    onClose?.()
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      next(event.shiftKey ? -1 : 1)
    }
  }
</script>

<SvModal bind:open onClose={onClose} title="Find and Replace" size="sm">
  <div class="sv-sheet-dialog" role="group" aria-label="Find and Replace">
    <label class="field">
      <span>Find what:</span>
      <input bind:this={findInput} type="text" bind:value={findText} onkeydown={onKey} spellcheck="false" autocomplete="off" />
    </label>
    <label class="field">
      <span>Replace with:</span>
      <input type="text" bind:value={replaceText} onkeydown={onKey} spellcheck="false" autocomplete="off" />
    </label>
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={matchCase} /> Match case</label>
      <label class="check"><input type="checkbox" bind:checked={entireCell} /> Match entire cell contents</label>
      <label class="field auto">
        <span>Look in:</span>
        <select bind:value={lookIn}>
          <option value="values">Values</option>
          <option value="formulas">Formulas</option>
        </select>
      </label>
    </div>
    <div class="status" role="status" aria-live="polite">{status}</div>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={all} disabled={!findText}>Replace All</button>
      <button type="button" class="btn" onclick={replace} disabled={!findText}>Replace</button>
      <button type="button" class="btn" onclick={countAll} disabled={!findText}>Find All</button>
      <button type="button" class="btn primary" onclick={() => next(1)} disabled={!findText}>Find Next</button>
      <button type="button" class="btn" onclick={close}>Close</button>
    </div>
  {/snippet}
</SvModal>
