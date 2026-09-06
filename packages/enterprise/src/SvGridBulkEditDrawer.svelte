<script lang="ts">
  /**
   * The bulk-edit drawer behind the selection bar's `editFields` button.
   *
   * Edits ONE OR MORE fields across ONE OR MORE selected rows. It is the same
   * side drawer + schema form the grid already uses for single-row editing
   * (`SvDrawer` + `SvForm`), so a user who has edited one row here already
   * knows this screen.
   *
   * The rule that makes multi-field bulk edit safe: **only fields you actually
   * change are written.** A field every selected row already agrees on opens
   * showing that value; a field they disagree on opens blank and labelled
   * "Multiple values". Leave either alone and every row keeps what it had.
   */
  import { untrack } from 'svelte'
  import { SvDrawer, SvForm, type FormField, type FormFieldType } from '@svgrid/grid'
  import {
    applyBulkEdit,
    bulkEditInitialValues,
    bulkEditableFields,
    coerceBulkValue,
    type BulkEditField,
    type BulkEditResult,
  } from './bulk-edit'

  let {
    ctrl,
    open = $bindable(false),
    onApplied,
  }: {
    ctrl: any
    open?: boolean
    onApplied?: (r: BulkEditResult) => void
  } = $props()

  const messages = $derived(ctrl.messages)
  const columns = $derived(bulkEditableFields(ctrl) as BulkEditField[])
  const count = $derived((ctrl.selectionBarTarget?.ids ?? []).length as number)

  /** A column's editor type mapped onto the form's control vocabulary. */
  function controlFor(editorType: string, hasOptions: boolean): FormFieldType {
    if (hasOptions) return 'select'
    switch (editorType) {
      case 'number': return 'number'
      case 'checkbox': return 'checkbox'
      case 'date': return 'date'
      case 'datetime': return 'datetime'
      case 'time': return 'time'
      case 'textarea': return 'textarea'
      case 'color': return 'color'
      default: return 'text'
    }
  }

  // Snapshotted when the drawer opens rather than derived: the form is
  // uncontrolled once mounted, and a baseline that kept re-deriving as rows
  // changed underneath would make "did the user change this?" unanswerable.
  let baseline = $state<Record<string, unknown>>({})
  let mixed = $state<Set<string>>(new Set())
  let formKey = $state(0)

  // Only `open` is tracked. The snapshot reads `columns` and the grid's rows,
  // and writes state that `fields` derives from - tracking either would make
  // this effect depend on what it writes, which Svelte rejects.
  $effect(() => {
    if (!open) return
    untrack(() => {
      const snapshot = bulkEditInitialValues(ctrl, columns)
      baseline = snapshot.values
      mixed = snapshot.mixed
      // Remount the form so it picks the new initial values up.
      formKey += 1
    })
  })

  const fields = $derived<FormField[]>(
    columns.map((c) => ({
      name: c.id,
      label: c.label,
      type: controlFor(c.editorType, !!c.options?.length),
      // Placeholder only. The same sentence repeated under every differing
      // field was five identical lines of noise - the lead says it once.
      placeholder: mixed.has(c.id) ? messages.bulkEditMixed : undefined,
      options: c.options?.map((o) => ({ value: o.value as string | number, label: o.label })),
    })),
  )

  const fill = (t: string, n: number) => t.replace(/\{count\}/g, String(n))

  function submit(values: Record<string, unknown>) {
    const byId = new Map(columns.map((c) => [c.id, c]))
    const edits: Record<string, unknown> = {}
    for (const [name, raw] of Object.entries(values)) {
      const column = byId.get(name)
      if (!column) continue
      const next = coerceBulkValue(column.editorType, raw)
      // Untouched fields are the ones that keep every row's own value. A field
      // that opened "Multiple values" and was left blank is untouched too.
      if (next === baseline[name]) continue
      if (mixed.has(name) && (raw === '' || raw == null)) continue
      edits[name] = next
    }
    const result = applyBulkEdit(ctrl, edits)
    open = false
    onApplied?.(result)
  }
</script>

<SvDrawer
  bind:open
  side="right"
  title={messages.bulkEditTitle}
  onClose={() => (open = false)}
>
  <div class="sv-bulk">
    {#if columns.length === 0}
      <p class="sv-bulk-empty">{messages.bulkEditNoFields}</p>
    {:else}
      <p class="sv-bulk-lead">{fill(messages.bulkEditLead, count)}</p>
      {#key formKey}
        <SvForm
          {fields}
          initial={baseline}
          columns={1}
          submitLabel={fill(messages.bulkEditApply, count)}
          cancelLabel={messages.bulkEditCancel}
          onSubmit={submit}
          onCancel={() => (open = false)}
        />
      {/key}
    {/if}
  </div>
</SvDrawer>

<style>
  /* Fill the drawer so the actions can sit against its bottom edge. Without
     this the buttons stop wherever the last field happens to end, with the
     rest of the panel empty below them - which reads as an unfinished panel
     rather than a short form. */
  .sv-bulk { display: flex; flex-direction: column; min-height: 100%; }
  .sv-bulk :global(.sv-form) { flex: 1; }
  .sv-bulk :global(.sv-form__actions) {
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
  }

  .sv-bulk-lead {
    margin: 0 0 14px;
    font-size: 13px;
    color: var(--sg-muted, #64748b);
  }
  .sv-bulk-empty {
    margin: 0;
    font-size: 13px;
    color: var(--sg-muted, #64748b);
  }
</style>
