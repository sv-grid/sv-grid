<script lang="ts">
  /**
   * Excel's Allow Users to Edit Ranges: the blocks that take an edit while
   * the sheet is protected, locked or not, each with a title. New adds
   * one from a title and an A1 text (`B2:B10`, or several areas with
   * commas), Modify edits one in place, Delete removes it; OK hands the
   * list back as one change, and Protect Sheet... closes this and opens
   * that dialog, as Excel's button does. No password per range.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import { newEditRangeId, parseRangeText, rangeText, type EditRange } from './sheet/protection'

  type Props = {
    open?: boolean
    /** The sheet's ranges as they stand. */
    ranges: ReadonlyArray<EditRange>
    /** The selection as A1 text, what a new range's cells open on. */
    selection: string
    onApply: (ranges: EditRange[]) => void
    /** The Protect Sheet... button: the shell opens that dialog. */
    onProtect: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), ranges, selection, onApply, onProtect, onClose }: Props = $props()
  const t = useSheetText()

  let working = $state<EditRange[]>([])
  let newTitle = $state('')
  let newRefers = $state('')
  let editing = $state<string | null>(null)
  let editTitle = $state('')
  let editRefers = $state('')
  let problem = $state<string | null>(null)
  let titleBox = $state<HTMLInputElement | null>(null)

  $effect(() => {
    if (!open) return
    const copy = ranges.map((r) => ({ ...r, rects: r.rects.map(([r1, c1, r2, c2]) => [r1, c1, r2, c2] as const) }))
    working = copy
    newTitle = `Range${copy.length + 1}`
    newRefers = selection
    editing = null
    problem = null
    queueMicrotask(() => titleBox?.focus())
  })

  function add() {
    const rects = parseRangeText(newRefers)
    if (!rects) { problem = t('editRanges.invalidRef', { text: newRefers }); return }
    const title = newTitle.trim() || `Range${working.length + 1}`
    working = [...working, { id: newEditRangeId(), title, rects }]
    newTitle = `Range${working.length + 1}`
    newRefers = ''
    problem = null
  }

  function startEdit(range: EditRange) {
    editing = range.id
    editTitle = range.title
    editRefers = rangeText(range.rects)
    problem = null
  }

  function saveEdit() {
    const rects = parseRangeText(editRefers)
    if (!rects) { problem = t('editRanges.invalidRef', { text: editRefers }); return }
    working = working.map((r) => (r.id === editing ? { ...r, title: editTitle.trim() || r.title, rects } : r))
    editing = null
    problem = null
  }

  function remove(id: string) {
    working = working.filter((r) => r.id !== id)
    if (editing === id) editing = null
  }

  function ok() {
    open = false
    onApply(working)
    onClose?.()
  }

  function protect() {
    open = false
    onApply(working)
    onProtect()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('editRanges.title')} size="md">
  <div class="sv-sheet-dialog ranges" role="group" aria-label={t('editRanges.title')}>
    <div class="lead">{t('editRanges.lead')}</div>
    <table class="list">
      <thead>
        <tr><th>{t('editRanges.name')}</th><th>{t('editRanges.refersTo')}</th><th></th></tr>
      </thead>
      <tbody>
        {#each working as range (range.id)}
          <tr>
            {#if editing === range.id}
              <td><input type="text" bind:value={editTitle} aria-label={t('editRanges.name')} spellcheck="false" /></td>
              <td class="mono">
                <input
                  type="text"
                  bind:value={editRefers}
                  aria-label={t('editRanges.refersTo')}
                  spellcheck="false"
                  onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit() } if (e.key === 'Escape') { e.stopPropagation(); editing = null } }}
                />
              </td>
              <td class="actions">
                <button type="button" class="link" onclick={saveEdit}>{t('save')}</button>
                <button type="button" class="link" onclick={() => (editing = null)}>{t('cancel')}</button>
              </td>
            {:else}
              <td>{range.title}</td>
              <td class="mono">{rangeText(range.rects)}</td>
              <td class="actions">
                <button type="button" class="link" onclick={() => startEdit(range)}>{t('editRanges.modify')}</button>
                <button type="button" class="link" onclick={() => remove(range.id)}>{t('delete')}</button>
              </td>
            {/if}
          </tr>
        {:else}
          <tr><td colspan="3" class="empty">{t('editRanges.empty')}</td></tr>
        {/each}
      </tbody>
    </table>
    <form class="new" onsubmit={(e) => { e.preventDefault(); add() }}>
      <label>
        <span>{t('editRanges.titleField')}</span>
        <input bind:this={titleBox} type="text" bind:value={newTitle} placeholder={t('editRanges.titlePlaceholder')} spellcheck="false" />
      </label>
      <label>
        <span>{t('editRanges.refersField')}</span>
        <input type="text" bind:value={newRefers} placeholder={t('editRanges.refersPlaceholder')} spellcheck="false" />
      </label>
      <button type="submit" class="btn">{t('editRanges.new')}</button>
    </form>
    {#if problem}<p class="status problem" role="alert">{problem}</p>{/if}
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={protect}>{t('editRanges.protectSheet')}</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={ok}>{t('ok')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .ranges { min-width: 460px; }
  .list {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .list th {
    padding: 4px 8px;
    text-align: left;
    font-weight: 600;
    color: var(--sg-muted, #616161);
    border-bottom: 1px solid var(--sg-border, #d1d1d1);
  }
  .list td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--sg-border, #e5e5e5);
    vertical-align: middle;
  }
  .list td input {
    width: 100%;
    box-sizing: border-box;
    padding: 3px 6px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .empty { color: var(--sg-muted, #616161); text-align: center; }
  .actions { white-space: nowrap; text-align: right; }
  .link {
    padding: 0 4px;
    font: inherit;
    color: var(--sg-accent, #107c41);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .link:hover { text-decoration: underline; }
  .new {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
    gap: 8px;
    align-items: end;
    margin-top: 6px;
  }
  .new label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
  .new input {
    padding: 4px 8px;
    font: inherit;
    color: inherit;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: 3px;
  }
  .spacer { flex: 1; }
</style>
