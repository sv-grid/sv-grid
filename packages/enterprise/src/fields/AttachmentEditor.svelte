<script lang="ts">
  /**
   * The grid mounts this when an attachment cell is edited (Enter, double
   * click, typing): it opens the attachment dialog over the page and commits
   * the dialog's list, or cancels. Registered with registerCellEditor as
   * 'attachment' by enableFields().
   */
  import AttachmentDialog from './AttachmentDialog.svelte'
  import { fieldPropsOf } from './registry.svelte'
  import type { Attachment, AttachmentFieldProps } from './attachments'

  let {
    value,
    columnDef,
    columnId,
    row,
    onCommit,
    onCancel,
  }: {
    value: unknown
    columnDef?: Record<string, unknown>
    columnId: string
    row?: unknown
    onCommit: (v?: unknown) => void
    onCancel: () => void
  } = $props()

  const props = $derived(fieldPropsOf((columnDef ?? {}) as { fieldType?: unknown; fieldProps?: Record<string, unknown> }) as AttachmentFieldProps)
  const title = $derived(typeof columnDef?.header === 'string' ? columnDef.header : 'Attachments')
</script>

<span class="sv-att-editing" aria-hidden="true"></span>
<AttachmentDialog
  {value}
  {title}
  {props}
  {row}
  {columnId}
  onDone={(next: Attachment[]) => onCommit(next)}
  onCancel={() => onCancel()}
/>
