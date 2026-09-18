<script lang="ts">
  /**
   * Excel's Name Manager: every defined name with what it refers to and
   * what that is worth right now; edit one in place, delete one, add one.
   * Writes go to `workbook.names`, and the shell is told afterwards, since
   * no cell was typed into and the sheet would otherwise not repaint.
   */
  import { useSheetText } from './sheet-text'
  import { SvModal } from '@svgrid/grid'
  import type { Workbook } from './sheet/workbook'
  import type { DefinedName } from './sheet/names'
  import { isValidName } from './sheet/names'
  import { parseA1 } from './sheet/address'

  type Props = {
    open?: boolean
    workbook: Workbook
    /** Called after every change, so the shell recomputes and repaints. */
    onChange: () => void
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, onChange, onClose }: Props = $props()
  const t = useSheetText()

  let names = $state<DefinedName[]>([])
  let newName = $state('')
  let newRefersTo = $state('')
  let editing = $state<string | null>(null)
  let editRefersTo = $state('')
  let problem = $state<string | null>(null)

  function reload() {
    names = workbook.names.list()
  }

  $effect(() => {
    if (!open) return
    reload()
    newName = ''
    newRefersTo = ''
    editing = null
    problem = null
  })

  /** What a name is worth right now, for the Value column. */
  function valueOf(entry: DefinedName): string {
    const text = entry.refersTo.replace(/^=/, '')
    const bang = text.lastIndexOf('!')
    const sheetName = bang >= 0 ? text.slice(0, bang).replace(/^'(.*)'$/, '$1') : workbook.active
    const address = bang >= 0 ? text.slice(bang + 1) : text
    const [first, last] = address.split(':')
    const from = parseA1(first ?? '')
    if (!from || from.row === null) return ''
    if (last) {
      const to = parseA1(last)
      if (to && to.row !== null) {
        const cells = (to.row - from.row + 1) * (to.col - from.col + 1)
        return `${cells} cells`
      }
    }
    const v = workbook.getValue(sheetName, from.row, from.col)
    if (typeof v === 'object' && v !== null) return v.error
    if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 4 })
    return String(v)
  }

  /** Accept `Assumptions!B6`, `=Assumptions!$B$6`, `B6` or a range. */
  function normalise(refersTo: string): string | null {
    const text = refersTo.trim().replace(/^=/, '')
    if (text === '') return null
    const bang = text.lastIndexOf('!')
    const address = bang >= 0 ? text.slice(bang + 1) : text
    const [first, last] = address.split(':')
    if (!parseA1(first ?? '')) return null
    if (last !== undefined && !parseA1(last)) return null
    const sheet = bang >= 0 ? text.slice(0, bang + 1) : `${quote(workbook.active)}!`
    return `=${sheet}${address}`
  }

  const quote = (name: string) => (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`)

  function changed() {
    onChange()
    reload()
  }

  function add() {
    const name = newName.trim()
    if (!isValidName(name)) { problem = `"${name}" is not a valid name: letters, digits and underscores, not a cell address`; return }
    if (workbook.names.has(name)) { problem = `${name} is already defined; edit it below instead`; return }
    const refersTo = normalise(newRefersTo)
    if (!refersTo) { problem = `"${newRefersTo}" is not a cell or range`; return }
    workbook.names.define(name, refersTo)
    newName = ''
    newRefersTo = ''
    problem = null
    changed()
  }

  function startEdit(entry: DefinedName) {
    editing = entry.name
    editRefersTo = entry.refersTo
    problem = null
  }

  function saveEdit() {
    if (!editing) return
    const refersTo = normalise(editRefersTo)
    if (!refersTo) { problem = `"${editRefersTo}" is not a cell or range`; return }
    workbook.names.define(editing, refersTo)
    editing = null
    problem = null
    changed()
  }

  function remove(name: string) {
    workbook.names.remove(name)
    changed()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('nameManager.title')} size="md">
  <div class="sv-sheet-dialog manager" role="group" aria-label={t('nameManager.title')}>
    <table class="names">
      <thead>
        <tr><th>{t('nameManager.name')}</th><th>{t('nameManager.refersTo')}</th><th>{t('nameManager.value')}</th><th></th></tr>
      </thead>
      <tbody>
        {#each names as entry (entry.name)}
          <tr>
            <td class="mono">{entry.name}</td>
            <td class="mono">
              {#if editing === entry.name}
                <input
                  type="text"
                  bind:value={editRefersTo}
                  aria-label={t('nameManager.refersTo')}
                  spellcheck="false"
                  onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit() } if (e.key === 'Escape') { e.stopPropagation(); editing = null } }}
                />
              {:else}
                {entry.refersTo}
              {/if}
            </td>
            <td class="num">{valueOf(entry)}</td>
            <td class="actions">
              {#if editing === entry.name}
                <button type="button" class="link" onclick={saveEdit}>{t('save')}</button>
                <button type="button" class="link" onclick={() => (editing = null)}>{t('cancel')}</button>
              {:else}
                <button type="button" class="link" onclick={() => startEdit(entry)}>{t('nameManager.edit')}</button>
                <button type="button" class="link" onclick={() => remove(entry.name)}>{t('delete')}</button>
              {/if}
            </td>
          </tr>
        {:else}
          <tr><td colspan="4" class="empty">{t('nameManager.empty')}</td></tr>
        {/each}
      </tbody>
    </table>

    <form class="new" onsubmit={(e) => { e.preventDefault(); add() }}>
      <label>
        <span>{t('nameManager.nameField')}</span>
        <input type="text" bind:value={newName} placeholder={t('nameManager.namePlaceholder')} spellcheck="false" />
      </label>
      <label>
        <span>{t('nameManager.refersToField')}</span>
        <input type="text" bind:value={newRefersTo} placeholder={t('nameManager.refersToPlaceholder')} spellcheck="false" />
      </label>
      <button type="submit" class="btn">{t('nameManager.new')}</button>
    </form>
    {#if problem}<p class="status problem" role="alert">{problem}</p>{/if}
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn" onclick={close}>{t('close')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .names { width: 100%; border-collapse: collapse; }
  .names th {
    text-align: left;
    font-weight: 600;
    color: var(--sg-muted, #616161);
    padding: 4px 8px;
    border-bottom: 1px solid var(--sg-border, #d1d1d1);
  }
  .names td { padding: 4px 8px; border-bottom: 1px solid var(--sg-border, #e5e5e5); vertical-align: middle; }
  .mono { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
  .num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .actions { display: flex; gap: 8px; justify-content: flex-end; white-space: nowrap; }
  .empty { text-align: center; color: var(--sg-muted, #616161); }
  .link {
    padding: 0;
    font: inherit;
    color: var(--sg-accent, #217346);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .link:hover { text-decoration: underline; }
  .new { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 8px; align-items: end; }
  .new label { display: flex; flex-direction: column; gap: 4px; }
  .new .btn {
    height: 26px;
    padding: 0 14px;
    font: inherit;
    color: var(--sg-fg, #242424);
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    cursor: pointer;
  }
  .problem { color: var(--sg-danger, #dc2626); }
  @media (max-width: 560px) {
    .new { grid-template-columns: 1fr; }
  }
</style>
