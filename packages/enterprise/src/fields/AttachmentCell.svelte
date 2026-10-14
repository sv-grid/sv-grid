<script lang="ts">
  /**
   * Attachment cells in read mode: images as square thumbnails, other files as
   * chips (type badge + name), as many as the column width holds, then "+N".
   * Thumbnails are a fixed size with lazy loading and async decoding, so a
   * scroll never waits on an image or re-lays out the row.
   *
   * Files dropped on the cell are added to it (uploaded with the column's
   * uploader, written through the grid's edit path). Each file uploads on
   * its own: the ones that land are written, a refused or failed one is
   * reported in a toast, and uploads still running when the cell goes away
   * are aborted.
   */
  import { toast } from '@svgrid/grid'
  import type { FieldCellProps } from './registry.svelte'
  import { isImage, limitAttachments, rejectReason, safeUrl, toAttachments, uploadAttachment, type Attachment, type AttachmentFieldProps } from './attachments'
  import { writeCell } from './grid-access'

  let { ctrl, row, column, value, props }: FieldCellProps<AttachmentFieldProps> = $props()

  const THUMB = 26
  const CHIP = 96
  const GAP = 4
  const PLUS = 30

  const items = $derived(toAttachments(value))
  const width = $derived(
    Number((ctrl as { getColumnWidth?: (id: string) => number }).getColumnWidth?.(column.id)) ||
      Number(column.columnDef.width) ||
      200,
  )
  // How many fit, leaving room for the "+N" badge when some do not.
  const shown = $derived.by(() => {
    const room = width - 12
    let used = 0
    let n = 0
    for (const a of items) {
      const w = (isImage(a) ? THUMB : CHIP) + GAP
      const rest = items.length - n - 1
      if (used + w + (rest > 0 ? PLUS : 0) > room) break
      used += w
      n += 1
    }
    return Math.max(items.length ? 1 : 0, n)
  })
  const label = $derived(
    items.length === 0
      ? 'No attachments'
      : `${items.length} attachment${items.length === 1 ? '' : 's'}: ${items.map((a) => a.name).join(', ')}`,
  )
  const ext = (a: Attachment) => (a.name.split('.').pop() ?? '').slice(0, 4).toUpperCase() || 'FILE'

  // ---- Files dropped on the cell ----
  const canDrop = $derived(!!(ctrl as { editingEnabled?: boolean } | null)?.editingEnabled && column.columnDef.editable !== false && !!row?.id)
  let over = $state(false)
  const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')
  function dragOver(e: DragEvent) {
    if (!canDrop || !hasFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    over = true
  }
  // Each running upload's progress (0..1), averaged into the bar under the cell.
  let uploads = $state<Record<string, number>>({})
  const progress = $derived.by(() => {
    const parts = Object.values(uploads)
    return parts.length ? parts.reduce((s, p) => s + p, 0) / parts.length : null
  })
  const running = new Set<AbortController>()
  $effect(() => () => {
    for (const ctl of running) ctl.abort()
  })
  let seq = 0

  async function drop(e: DragEvent) {
    over = false
    if (!canDrop || !hasFiles(e)) return
    e.preventDefault()
    e.stopPropagation()
    // The row as it was dropped on; the write goes to it even if the cell is reused.
    const rowId = row.id
    const original = row.original as Record<string, unknown> | undefined
    const field = column.columnDef.field as string | undefined
    const current = () => (original && field ? toAttachments(original[field]) : items)
    const refused: string[] = []
    const queue: File[] = []
    for (const file of [...(e.dataTransfer?.files ?? [])]) {
      const why = rejectReason(file, props, items.length + queue.length)
      if (why) refused.push(`${file.name}: ${why}`)
      else queue.push(file)
    }
    if (refused.length) toast.warning(refused.join('\n'), { title: 'Not added' })
    if (!queue.length) return
    const ctl = new AbortController()
    running.add(ctl)
    const keys = queue.map(() => `u${++seq}`)
    uploads = { ...uploads, ...Object.fromEntries(keys.map((k) => [k, 0])) }
    const results = await Promise.allSettled(
      queue.map((file, i) =>
        uploadAttachment(file, props, {
          row: original,
          columnId: column.id,
          signal: ctl.signal,
          onProgress: (f) => {
            if (keys[i]! in uploads) uploads = { ...uploads, [keys[i]!]: Math.max(0, Math.min(1, f)) }
          },
        }),
      ),
    )
    running.delete(ctl)
    if (ctl.signal.aborted) return
    uploads = Object.fromEntries(Object.entries(uploads).filter(([k]) => !keys.includes(k)))
    const failed: string[] = []
    const added: Attachment[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') added.push(r.value)
      else failed.push(`${queue[i]!.name}: ${r.reason instanceof Error && r.reason.message ? r.reason.message : 'Upload failed'}`)
    })
    // Another drop may have filled the cell meanwhile; maxFiles still holds.
    const base = current()
    const { kept, rejected } = limitAttachments(added, props, base.length)
    if (kept.length) writeCell(ctrl, rowId, column.id, [...base, ...kept])
    if (rejected.length) toast.warning(rejected.join('\n'), { title: 'Not added' })
    if (failed.length) toast.error(failed.join('\n'), { title: failed.length === 1 ? 'Upload failed' : `${failed.length} uploads failed` })
  }
</script>

<span
  class="sv-att"
  class:is-drop={over}
  role="img"
  aria-label={label}
  title={items.map((a) => a.name).join('\n')}
  ondragover={dragOver}
  ondragleave={() => (over = false)}
  ondrop={drop}
>
  {#each items.slice(0, shown) as a (a.id)}
    {#if isImage(a) && safeUrl(a.thumbnailUrl ?? a.url, true)}
      <img
        class="sv-att-thumb"
        src={safeUrl(a.thumbnailUrl ?? a.url, true)}
        alt=""
        width={THUMB}
        height={THUMB}
        loading="lazy"
        decoding="async"
        draggable="false"
      />
    {:else}
      <span class="sv-att-chip">
        <span class="sv-att-ext">{ext(a)}</span>
        <span class="sv-att-name">{a.name}</span>
      </span>
    {/if}
  {/each}
  {#if items.length > shown}
    <span class="sv-att-more">+{items.length - shown}</span>
  {/if}
  {#if progress !== null}
    <span
      class="sv-att-progress"
      role="progressbar"
      aria-label="Uploading"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(progress * 100)}
      style:--sv-att-done={`${Math.round(progress * 100)}%`}
    ></span>
  {/if}
</span>

<style>
  .sv-att {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    width: 100%;
    min-height: 100%;
    overflow: hidden;
  }
  /* Files over the cell: where they will land. */
  .sv-att.is-drop {
    outline: 2px dashed var(--sg-accent, #2563eb);
    outline-offset: -2px;
    border-radius: 4px;
  }
  .sv-att-thumb {
    flex: none;
    width: 26px;
    height: 26px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  .sv-att-chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    width: 96px;
    height: 24px;
    padding: 0 6px 0 3px;
    border-radius: 4px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
    font-size: 11px;
  }
  .sv-att-ext {
    flex: none;
    padding: 1px 3px;
    border-radius: 3px;
    background: var(--sg-bg, #fff);
    color: var(--sg-muted, #64748b);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .sv-att-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sv-att-more {
    flex: none;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  /* Uploads from a drop: a thin bar along the bottom of the cell. */
  .sv-att-progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: linear-gradient(to right, var(--sg-accent, #2563eb) var(--sv-att-done), transparent var(--sv-att-done));
  }
</style>
