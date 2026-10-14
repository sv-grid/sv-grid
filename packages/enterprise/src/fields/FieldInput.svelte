<script lang="ts">
  /**
   * One field's value outside the grid (the expanded record, the form view):
   * drawn as its cell draws it, and on a click the editor its cell uses (the
   * number box, the select panel, the date picker...) or a plain box. A
   * checkbox toggles at once. The parent writes the value (`onCommit`) and
   * decides which field is being edited, so Tab can move between them.
   */
  import { SvDateTimePicker, getCellEditor, resolveEditorProps } from '@svgrid/grid'
  import FieldCell from './FieldCell.svelte'
  import { typeDrawsCell } from './registry.svelte'

  type Col = { id: string; columnDef: Record<string, any> }
  let {
    ctrl,
    column,
    value,
    row,
    rowId = '',
    label,
    editable,
    editing,
    placeholder = 'Empty',
    onStart,
    onStop,
    onCommit,
    onTab,
    addOptions = true,
  }: {
    ctrl: any
    column: Col
    value: unknown
    /** The row the value belongs to (none in a form). */
    row?: { id: string; original: unknown } | null
    rowId?: string
    label: string
    editable: boolean
    editing: boolean
    placeholder?: string
    onStart: () => void
    onStop: () => void
    onCommit: (value: unknown) => void
    /** Tab or Shift+Tab out of the editor, after its value was committed. */
    onTab?: (dir: 1 | -1) => void
    /** False in a form: a select offers only the field's options, never "Add option". */
    addOptions?: boolean
  } = $props()

  let draft: unknown = undefined
  const reg = $derived(getCellEditor(String(column.columnDef.editorType ?? 'text')))
  const drawsCell = $derived(!!column.columnDef.fieldType && column.columnDef.cell == null && typeDrawsCell(column.columnDef))
  // Stars and a checkbox say what an empty value is; other cells would draw nothing.
  const drawnEmpty = $derived(column.columnDef.fieldType === 'rating' || column.columnDef.fieldType === 'checkbox')
  // An empty value shows the placeholder, not an empty drawing.
  const blank = $derived(value == null || value === '' || (Array.isArray(value) && value.length === 0))
  const text = $derived.by(() => {
    const f = column.columnDef.formatter as ((x: { value: unknown; row: unknown; column: unknown }) => unknown) | undefined
    // `{ id, original }`, the shape a grid row has: in a form, the draft with id ''.
    if (f) return String(f({ value, row: row ?? null, column }) ?? '')
    if (Array.isArray(value)) return value.join(', ')
    return value == null ? '' : String(value)
  })

  function start() {
    if (!editable) return
    if (column.columnDef.editorType === 'checkbox') return onCommit(!value)
    draft = value
    onStart()
  }
  const commit = (v: unknown) => {
    onStop()
    if (v !== undefined) onCommit(v)
  }
  function editorProps(r: NonNullable<ReturnType<typeof getCellEditor>>) {
    const props = resolveEditorProps(r, {
      value,
      rowId,
      columnId: column.id,
      columnDef: column.columnDef,
      row: row?.original,
      grid: ctrl,
      typed: false,
      inCell: false,
      onChange: (v: unknown) => (draft = v),
      onCommit: (v?: unknown) => commit(v === undefined ? draft : v),
      onCancel: onStop,
      onRequestClose: onStop,
      onCommitAndMove: (v: unknown, dir: 1 | -1) => {
        commit(v === undefined ? draft : v)
        onTab?.(dir)
      },
      onCommitAndMoveDown: (v?: unknown) => commit(v === undefined ? draft : v),
    })
    // Editors that do not read it ignore it.
    return addOptions ? props : { ...props, addOptions: false }
  }
  function plainKey(e: KeyboardEvent, multiline: boolean) {
    const el = e.currentTarget as HTMLInputElement | HTMLTextAreaElement
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onStop()
    } else if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      commit(el.value)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      commit(el.value)
      onTab?.(e.shiftKey ? -1 : 1)
    }
  }
  function focusOnMount(el: HTMLInputElement | HTMLTextAreaElement) {
    queueMicrotask(() => {
      el.focus()
      el.select()
    })
  }
  const blurCommit = (e: Event) => {
    if (editing) commit((e.currentTarget as HTMLInputElement).value)
  }
</script>

{#if editing}
  <div class="sv-frv-box is-editing">
    {#if reg}
      <reg.component {...editorProps(reg)} />
    {:else if column.columnDef.editorType === 'date' || column.columnDef.editorType === 'datetime'}
      <SvDateTimePicker
        value={value as string | number | Date | null}
        formatString={column.columnDef.editorFormatString ?? (column.columnDef.editorType === 'date' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm')}
        dropDownDisplayMode={column.columnDef.editorType === 'date' ? 'calendar' : 'both'}
        autoOpen
        block
        onChange={(d) => (draft = d)}
        onCommit={() => commit(draft)}
        onCancel={onStop}
      />
    {:else if column.columnDef.editorType === 'textarea'}
      <textarea class="sv-frv-input" rows="4" value={String(value ?? '')} use:focusOnMount onkeydown={(e) => plainKey(e, true)} onblur={blurCommit}></textarea>
    {:else}
      <input class="sv-frv-input" value={String(value ?? '')} use:focusOnMount onkeydown={(e) => plainKey(e, false)} onblur={blurCommit} />
    {/if}
  </div>
{:else}
  <!-- A box acting as a button, not a <button>: a cell drawn in it can hold
       buttons of its own (a linked record's chip), and buttons do not nest. -->
  <div
    class="sv-frv-box"
    class:is-readonly={!editable}
    role="button"
    tabindex={editable ? 0 : -1}
    aria-disabled={!editable}
    aria-label={`${label}: ${text || 'empty'}${editable ? ', edit' : ''}`}
    onclick={start}
    onkeydown={(e) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
      e.preventDefault()
      start()
    }}
  >
    {#if drawsCell && (!blank || drawnEmpty)}
      <FieldCell {ctrl} row={row ?? { id: rowId, original: {} }} column={column as never} {value} />
    {:else if text}
      <span class="sv-frv-text">{text}</span>
    {:else}
      <span class="sv-frv-empty">{editable ? placeholder : ''}</span>
    {/if}
  </div>
{/if}

<style>
  .sv-frv-box {
    position: relative; display: flex; align-items: center; min-height: 36px; width: 100%; box-sizing: border-box;
    padding: 0 10px; text-align: start; font: inherit; font-size: 14px; color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px); background: var(--sg-input-bg, var(--sg-bg, #fff));
    cursor: pointer;
  }
  .sv-frv-box:hover:not(.is-readonly) { border-color: var(--sg-input-border, var(--sg-border, #cbd5e1)); }
  .sv-frv-box:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: 1px; }
  .sv-frv-box.is-readonly { cursor: default; background: var(--sg-header-bg, #f8fafc); }
  .sv-frv-box.is-editing { padding: 0; border-color: var(--sg-accent, #2563eb); cursor: auto; }
  .sv-frv-text { white-space: pre-wrap; padding: 8px 0; }
  .sv-frv-empty { color: var(--sg-muted, #94a3b8); font-size: 13px; }
  .sv-frv-input {
    width: 100%; box-sizing: border-box; min-height: 34px; padding: 8px 10px; border: 0; outline: none; resize: vertical;
    font: inherit; font-size: 14px; background: none; color: var(--sg-fg, #0f172a);
  }
</style>
