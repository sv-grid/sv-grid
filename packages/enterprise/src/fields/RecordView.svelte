<script lang="ts">
  /**
   * A row opened as a record (`expandRows`, Space on a cell, a gallery card,
   * a linked record's chip): every field of the row, its name with the
   * type's icon over its value, the value drawn as the cell draws it. A
   * click on an editable value opens the same editor the cell uses; a value
   * is written through the grid's own edit path, so undo, validation,
   * onCellValueChange and "last modified" fields behave as in the cell.
   * Fields hidden in the grid are listed under the others, folded. Beside
   * the fields, the record's activity: its changes and its comments. A
   * change made elsewhere (another user, an agent) shows who made it and what
   * the field held before, and opening the record marks it seen.
   * Previous and next step through the rows in the grid's order.
   */
  import { onMount, untrack } from 'svelte'
  import { getRecordRequest, type RecordRequest } from './editor-request.svelte'
  import { SvModal } from '@svgrid/grid'
  import FieldInput from './FieldInput.svelte'
  import { getFieldType } from './registry.svelte'
  import { cellText, fieldColumns, primaryIdOf, type FieldColumn } from './grid-access'
  import { addComment, changesOf, commentsOf, markSeen, timeAgo, unseenOf } from './activity.svelte'
  import { findFieldUser } from './sources.svelte'

  let {
    ctrl,
    rowId,
    editPrimary = false,
    focus,
    onClose,
  }: {
    ctrl: any
    rowId: string
    editPrimary?: boolean
    /** 'comment': open with the comment box focused (also read from the open request). */
    focus?: 'comment'
    onClose: () => void
  } = $props()

  type Col = { id: string; columnDef: Record<string, any> }
  type Row = { id: string; original: unknown; getCellValueByColumnId: (id: string) => unknown }

  // svelte-ignore state_referenced_locally
  let current = $state(rowId)
  let open = $state(true)
  let editing = $state<string | null>(null)
  let showHidden = $state(false)
  let comment = $state('')

  const rows = $derived((ctrl.allRows ?? []) as Row[])
  const index = $derived(rows.findIndex((r) => r.id === current))
  const row = $derived(index >= 0 ? rows[index]! : null)
  // Where the record was last seen. An edit can take it out of the view (a
  // filter it no longer matches); Previous and Next then go on from there:
  // the row that followed it now sits at that position.
  let lastIndex = 0
  const at = $derived.by(() => {
    if (index >= 0) lastIndex = index
    return lastIndex
  })
  // Both read `at` on every change of `index`, so it never misses a position.
  const canPrev = $derived(at > 0 && rows.length > 0)
  const canNext = $derived(at < rows.length - (index >= 0 ? 1 : 0))
  const columns = $derived(
    ((ctrl.allColumns ?? []) as Col[]).filter((c) => !c.id.startsWith('__') && (c.columnDef.field != null || c.columnDef.fieldFn != null)),
  )
  // Fields the grid hides: shown here, read-only (an edit goes through the grid's cells).
  const hidden = $derived.by<Col[]>(() => {
    const shownIds = new Set(columns.map((c) => c.id))
    return fieldColumns(ctrl)
      .filter((c) => !shownIds.has(c.id))
      .map((c) => ({ id: c.id, columnDef: c.def }))
  })

  // Through the grid's edit overlay, as the cells read it: an edit writes
  // there (and into the row object), so a value changed here or in the grid
  // shows at once.
  function valueOf(c: Col): unknown {
    if (!row) return undefined
    const base = c.columnDef.fieldFn ? c.columnDef.fieldFn(row.original) : (row.original as Record<string, unknown>)?.[c.columnDef.field]
    return ctrl.getCellDisplayValue(row.id, c.id, columns.includes(c) ? row.getCellValueByColumnId(c.id) : base)
  }
  const asField = (c: Col): FieldColumn => ({ id: c.id, field: String(c.columnDef.field ?? c.id), header: label(c), fieldType: c.columnDef.fieldType, def: c.columnDef, visible: true })
  // The record's name: the primary field, else its first text field, else the first field.
  const primaryId = $derived(primaryIdOf(ctrl))
  const primary = $derived(columns.find((c) => c.id === primaryId) ?? columns.find((c) => c.columnDef.fieldType === 'text' || (!c.columnDef.fieldType && c.columnDef.editorType == null)) ?? columns[0])
  const title = $derived(row && primary ? cellText(asField(primary), valueOf(primary), row) || 'Untitled' : 'Record')
  function label(c: Col): string {
    return typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id
  }
  const iconOf = (c: Col) => (c.columnDef.fieldType ? getFieldType(c.columnDef.fieldType)?.icon : undefined)
  function editable(c: Col): boolean {
    if (!row || !ctrl.editingEnabled) return false
    const ci = (ctrl.allColumns as Col[]).findIndex((x) => x.id === c.id)
    if (ci < 0) return false
    return ctrl.isCellEditableAt ? !!ctrl.isCellEditableAt(index, ci) : c.columnDef.editable !== false
  }

  // A record just made opens with its name being typed.
  onMount(() => {
    if (editPrimary && primary && editable(primary)) editing = primary.id
  })

  // "Comment" in a record or card menu opens the record with `focus: 'comment'`:
  // the comment box takes focus, on open or when the request comes later.
  let commentBox = $state<HTMLTextAreaElement | null>(null)
  const commentFocusFor = (r: RecordRequest | null) => r?.focus === 'comment' && r.ctrl === ctrl
  const initialFocus = () => (focus === 'comment' || commentFocusFor(getRecordRequest()) ? commentBox : null)
  $effect(() => {
    const r = getRecordRequest()
    if (!commentFocusFor(r)) return
    untrack(() => {
      if (r!.rowId !== current) current = r!.rowId
      queueMicrotask(() => commentBox?.focus())
    })
  })

  /** Write a value the way an edit in the cell does. */
  function commit(c: Col, v: unknown) {
    editing = null
    if (!row || v === undefined) return
    const at = (ctrl.allRows as Row[]).findIndex((r) => r.id === current)
    if (at < 0 || !ctrl.startEditing(at, c.id)) return
    ctrl.updateEditingCellValue(v)
    ctrl.saveEditingCell()
  }
  /** Tab from a field: the next (or previous) editable one. */
  function editBeside(c: Col, dir: 1 | -1) {
    const at = columns.findIndex((x) => x.id === c.id)
    for (let i = at + dir; i >= 0 && i < columns.length; i += dir) {
      const next = columns[i]!
      if (editable(next) && next.columnDef.editorType !== 'checkbox') {
        editing = next.id
        return
      }
    }
  }
  function go(by: 1 | -1) {
    const next = index >= 0 ? rows[index + by] : rows[Math.min(at, rows.length) - (by < 0 ? 1 : 0)]
    if (!next) return
    editing = null
    current = next.id
  }

  // ---- Activity ---------------------------------------------------------------
  const allCols = $derived([...columns, ...hidden])
  type FeedItem = { key: string; at: number; by?: string; automation?: string; via?: string; remote?: boolean; kind: 'edit' | 'added' | 'comment'; field: string; text: string; from?: string }
  const feed = $derived.by(() => {
    if (!row) return []
    const edits = changesOf(ctrl, row.id).map((ch): FeedItem => {
      if (ch.added) return { key: `a${ch.at}`, at: ch.at, by: ch.by, remote: true, kind: 'added', field: '', text: '' }
      const c = allCols.find((x) => x.id === ch.columnId)
      const show = (v: unknown) => (c ? cellText(asField(c), v, row) : String(v ?? ''))
      return {
        key: `e${ch.at}${ch.columnId}`,
        at: ch.at,
        by: ch.by,
        automation: ch.automation,
        via: ch.via,
        remote: ch.remote,
        kind: 'edit',
        field: c ? label(c) : ch.columnId,
        text: show(ch.value),
        // What it held before, for a change made elsewhere (nothing to show when it was empty).
        ...('from' in ch && show(ch.from) ? { from: show(ch.from) } : {}),
      }
    })
    const notes = commentsOf(ctrl, row.id).map((n): FeedItem => ({ key: n.id, at: n.at, by: n.by, kind: 'comment', field: '', text: n.text }))
    return [...edits, ...notes].sort((a, b) => a.at - b.at)
  })
  const person = (item: FeedItem) => (item.by ? (findFieldUser(item.by)?.name ?? 'Someone') : item.remote ? 'Someone else' : 'You')
  // A proposal someone accepted (change review) is credited to what proposed it, and to them.
  const who = (item: FeedItem) =>
    item.automation ? `Automation: ${item.automation}` : item.via ? `${item.via} (accepted by ${person(item)})` : person(item)
  // Shown here: a change made elsewhere is seen, so the grid stops marking it.
  $effect(() => {
    const id = row?.id
    if (id != null && unseenOf(ctrl, id)) untrack(() => markSeen(ctrl, id))
  })
  function send() {
    if (!row || !comment.trim()) return
    addComment(ctrl, row.id, comment)
    comment = ''
  }
</script>

{#snippet field(c: Col, canEdit: boolean)}
  <div class="sv-frv-field">
    <div class="sv-frv-label">
      {#if iconOf(c)}<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d={iconOf(c)} fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
      <span>{label(c)}</span>
      {#if !canEdit}<span class="sv-frv-ro">{columns.includes(c) ? 'read-only' : 'hidden in the grid'}</span>{/if}
    </div>
    <FieldInput
      {ctrl}
      column={c}
      value={valueOf(c)}
      row={row ? { id: row.id, original: row.original } : null}
      rowId={row?.id ?? ''}
      label={label(c)}
      editable={canEdit}
      editing={editing === c.id}
      onStart={() => (editing = c.id)}
      onStop={() => (editing = null)}
      onCommit={(v) => commit(c, v)}
      onTab={(dir) => editBeside(c, dir)}
    />
  </div>
{/snippet}

<SvModal bind:open {title} width={940} {onClose} {initialFocus}>
  {#if !row}
    <p class="sv-frv-gone">This row is not in the grid's view any more.</p>
  {:else}
    <div class="sv-frv-layout">
      <div class="sv-frv-fields">
        {#each columns as c (c.id)}
          {@render field(c, editable(c))}
        {/each}
        {#if hidden.length}
          <button type="button" class="sv-frv-hidden-toggle" aria-expanded={showHidden} onclick={() => (showHidden = !showHidden)}>
            {showHidden ? 'Hide' : 'Show'} {hidden.length} hidden field{hidden.length === 1 ? '' : 's'}
          </button>
          {#if showHidden}
            {#each hidden as c (c.id)}
              {@render field(c, false)}
            {/each}
          {/if}
        {/if}
      </div>
      <aside class="sv-frv-activity" aria-label="Activity">
        <h3 class="sv-frv-activity-title">Activity</h3>
        <ol class="sv-frv-feed">
          {#each feed as item (item.key)}
            <li class="sv-frv-item" class:is-comment={item.kind === 'comment'}>
              <div class="sv-frv-item-head"><strong>{who(item)}</strong>{item.kind === 'edit' ? ` changed ${item.field}` : item.kind === 'added' ? ' added this record' : ''}<span class="sv-frv-when">{timeAgo(item.at)}</span></div>
              {#if item.kind !== 'added'}
                <div class="sv-frv-item-body">
                  {#if item.from !== undefined}<span class="sv-frv-from">{item.from}</span><span class="sv-frv-arrow" aria-label="to">→</span>{/if}{item.text || (item.kind === 'edit' ? '(cleared)' : '')}
                </div>
              {/if}
            </li>
          {:else}
            <li class="sv-frv-none">No changes or comments yet.</li>
          {/each}
        </ol>
        <form
          class="sv-frv-comment"
          onsubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <textarea
            bind:this={commentBox}
            rows="2"
            placeholder="Leave a comment"
            aria-label="Leave a comment"
            bind:value={comment}
            onkeydown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                send()
              }
            }}
          ></textarea>
          <button type="submit" class="sv-frv-btn" disabled={!comment.trim()}>Comment</button>
        </form>
      </aside>
    </div>
  {/if}
  {#snippet footer()}
    <div class="sv-frv-footer">
      <button type="button" class="sv-frv-btn" disabled={!canPrev} onclick={() => go(-1)} aria-label="Previous record">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <button type="button" class="sv-frv-btn" disabled={!canNext} onclick={() => go(1)} aria-label="Next record">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <span class="sv-frv-pos">{index >= 0 ? `${index + 1} of ${rows.length}` : `Not in view (${rows.length} records)`}</span>
      <!-- The modal tells onClose only when it closes itself (X, Escape, backdrop). -->
      <button
        type="button"
        class="sv-frv-btn is-primary"
        onclick={() => {
          open = false
          onClose()
        }}>Close</button
      >
    </div>
  {/snippet}
</SvModal>

<style>
  .sv-frv-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; align-items: start; }
  .sv-frv-fields { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .sv-frv-field { display: flex; flex-direction: column; gap: 6px; }
  .sv-frv-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-frv-ro { font-weight: 400; font-size: 11px; opacity: 0.8; }
  .sv-frv-hidden-toggle {
    align-self: flex-start; border: 0; padding: 2px 0; background: none; font: inherit; font-size: 13px;
    color: var(--sg-accent, #2563eb); cursor: pointer;
  }
  .sv-frv-activity {
    position: sticky; top: 0; display: flex; flex-direction: column; gap: 8px; max-height: 70vh;
    padding-inline-start: 16px; border-inline-start: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-frv-activity-title { margin: 0; font-size: 13px; font-weight: 600; }
  .sv-frv-feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; overflow: auto; min-height: 60px; }
  .sv-frv-item { font-size: 12px; }
  .sv-frv-item-head { color: var(--sg-muted, #64748b); }
  .sv-frv-item-head strong { color: var(--sg-fg, #0f172a); font-weight: 600; }
  .sv-frv-from { color: var(--sg-muted, #64748b); text-decoration: line-through; }
  .sv-frv-arrow { margin: 0 5px; color: var(--sg-muted, #64748b); }
  .sv-frv-when { margin-inline-start: 6px; opacity: 0.8; }
  .sv-frv-item-body { margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
  .sv-frv-item.is-comment .sv-frv-item-body {
    padding: 6px 8px; border-radius: 8px; background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, transparent);
  }
  .sv-frv-none { color: var(--sg-muted, #64748b); font-size: 12px; }
  .sv-frv-comment { display: grid; gap: 6px; }
  .sv-frv-comment textarea {
    width: 100%; box-sizing: border-box; padding: 6px 8px; font: inherit; font-size: 13px; resize: vertical;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px;
  }
  .sv-frv-comment .sv-frv-btn { justify-self: end; }
  .sv-frv-gone { color: var(--sg-muted, #64748b); }
  .sv-frv-footer { display: flex; align-items: center; gap: 6px; width: 100%; }
  .sv-frv-pos { flex: 1; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-frv-btn {
    display: inline-flex; align-items: center; justify-content: center; height: 32px; min-width: 32px; padding: 0 12px;
    font: inherit; font-size: 13px; cursor: pointer; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .sv-frv-btn:disabled { opacity: 0.4; cursor: default; }
  .sv-frv-btn.is-primary { background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); border-color: var(--sg-fg, #0f172a); }
  @media (max-width: 760px) {
    .sv-frv-layout { grid-template-columns: minmax(0, 1fr); }
    .sv-frv-activity { position: static; padding-inline-start: 0; border-inline-start: 0; border-top: 1px solid var(--sg-border, #e2e8f0); padding-top: 12px; }
  }
</style>
