<script lang="ts">
  /**
   * The last child of a grid's header row (registerGridExtension's `headerEnd`):
   * the "+" cell of the `columnAdder` prop, and the host of this grid's field
   * editor (opened by the "+" and the column-menu field actions) and record
   * view (opened by a row header's expand button).
   */
  import { untrack } from 'svelte'
  import FieldEditor from './FieldEditor.svelte'
  import { primaryIdOf } from './grid-access'
  import RecordView from './RecordView.svelte'
  import LinkedRecordView from './LinkedRecordView.svelte'
  import DeleteFieldConfirm from './DeleteFieldConfirm.svelte'
  import DeleteRecordConfirm from './DeleteRecordConfirm.svelte'
  import { askDeleteRecord, getDeleteRecordRequest } from './record-delete.svelte'
  import LinkPreview from './LinkPreview.svelte'
  import {
    closeFieldEditor,
    closeLinkedRecord,
    closeRecord,
    getFieldEditorRequest,
    getDeleteFieldRequest,
    askDeleteField,
    getLinkPreview,
    getLinkedRecords,
    getRecordRequest,
    openFieldEditor,
  } from './editor-request.svelte'

  let { ctrl }: { ctrl: any } = $props()

  const request = $derived(getFieldEditorRequest())
  const mine = $derived(request && request.ctrl === ctrl ? request : null)
  const deleting = $derived.by(() => {
    const d = getDeleteFieldRequest()
    return d && d.ctrl === ctrl ? d : null
  })
  const adder = $derived(!!ctrl.props.columnAdder)
  const record = $derived(getRecordRequest())
  const myRecord = $derived(record && record.ctrl === ctrl ? record : null)
  // Linked records opened from this grid's chips, stacked, and the chip preview.
  const linked = $derived(getLinkedRecords().filter((r) => r.ctrl === ctrl))
  const preview = $derived.by(() => {
    const p = getLinkPreview()
    return p && p.ctrl === ctrl ? p : null
  })

  // Rows drag into a new order (`rowDragManaged`) only while nothing sorts or
  // groups them: in a sorted table the order is the sort's.
  $effect(() => {
    // Only a grid whose app turned dragging on (our override is set only then).
    const overridden = 'rowDragManaged' in (ctrl.optionOverrides ?? {})
    if (!overridden && ctrl.props.rowDragManaged !== true) return
    void ctrl.gridStateVersion
    const s = ctrl.grid?.getState?.() ?? {}
    const ordered = (s.sorting?.length ?? 0) > 0 || (s.grouping?.length ?? 0) > 0
    const want = ordered ? false : undefined
    untrack(() => {
      if (ctrl.optionOverrides?.rowDragManaged !== want) ctrl.buildApi?.().setOption('rowDragManaged', want)
    })
  })

  // `primaryField`: first, pinned and shown, whatever the column menu or a
  // restored view did.
  const primary = $derived(primaryIdOf(ctrl))
  $effect(() => {
    if (!primary) return
    const pin = ctrl.columnPinning as { left: string[]; right: string[] }
    const hidden = !!ctrl.hiddenColumns[primary]
    untrack(() => {
      if (hidden) {
        const next = { ...ctrl.hiddenColumns }
        delete next[primary]
        ctrl.hiddenColumns = next
      }
      if (pin.left[0] !== primary || pin.right.includes(primary)) {
        ctrl.columnPinning = { left: [primary, ...pin.left.filter((id) => id !== primary)], right: pin.right.filter((id) => id !== primary) }
      }
    })
  })
</script>

{#if adder}
  <th class="sv-grid-column sv-field-column-adder" role="columnheader" aria-label="Add a field">
    <button
      type="button"
      class="sv-field-column-adder-button"
      aria-label="Add a field"
      title="Add a field"
      onclick={() => openFieldEditor({ ctrl, mode: 'add', index: 'end' })}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
    </button>
  </th>
{/if}
{#if mine}
  {#key mine}
    <FieldEditor {ctrl} mode={mine.mode} columnId={mine.columnId} index={mine.index} onClose={closeFieldEditor} />
  {/key}
{/if}
{#if deleting}
  {#key deleting}
    <DeleteFieldConfirm {ctrl} columnId={deleting.columnId} onClose={() => askDeleteField(null)} />
  {/key}
{/if}
{#if getDeleteRecordRequest()?.ctrl === ctrl}
  {@const r = getDeleteRecordRequest()!}
  {#key r}
    <DeleteRecordConfirm {ctrl} api={r.api} row={r.row} onClose={() => askDeleteRecord(null)} />
  {/key}
{/if}
{#if myRecord}
  {#key myRecord}
    <RecordView {ctrl} rowId={myRecord.rowId} editPrimary={myRecord.editPrimary} onClose={closeRecord} />
  {/key}
{/if}
{#each linked as r, i (`${i}:${r.table}:${r.rowId}`)}
  <LinkedRecordView {ctrl} table={r.table} rowId={r.rowId} onClose={closeLinkedRecord} />
{/each}
{#if preview}
  <LinkPreview request={preview} />
{/if}

<style>
  .sv-field-column-adder {
    flex: none;
    width: 44px;
    min-width: 44px;
    max-width: 44px;
    padding: 0;
  }
  .sv-field-column-adder-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 32px;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
  }
  .sv-field-column-adder-button:hover { color: var(--sg-fg, #0f172a); background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-field-column-adder-button:focus-visible { outline: 2px solid var(--sg-accent, #2563eb); outline-offset: -2px; }
</style>
