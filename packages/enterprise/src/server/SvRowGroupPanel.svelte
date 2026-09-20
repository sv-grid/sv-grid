<!--
  A row-group panel (like the "drag columns to group" bar in enterprise grids).
  Shows the current group-by columns as chips you can remove or drag to reorder,
  plus a "+ Group by" menu to add one. It is also a drop target: a column drag
  that carries `text/sv-column` (its column id) adds that column. Wire `onChange`
  to a server group model's `setGroupBy`, or to client grouping.

      <SvRowGroupPanel
        columns={[{ id: 'region', label: 'Region' }, { id: 'country', label: 'Country' }]}
        groupBy={view.groupBy}
        onChange={(g) => ctl.setGroupBy(g)}
      />
-->
<script lang="ts">
  import { GRID_ICON_GLYPHS, type GridIconName, type GridIcons } from '@svgrid/grid'
  import { fillMessage, resolveServerGroupMessages, type ServerGroupMessages } from './messages'

  type Col = { id: string; label: string }
  type Props = {
    /** Columns that can be grouped on. */
    columns: Col[]
    /** Current group-by column ids, outer to inner. */
    groupBy: string[]
    /** Called with the new group-by order. */
    onChange: (groupBy: string[]) => void
    /** Text shown when nothing is grouped. Default: `messages.dropHere`. */
    placeholder?: string
    /**
     * Icon overrides, the same map `<SvGrid icons>` takes. This panel draws
     * `drag-handle`, `remove` and `breadcrumb-separator`. You mount it
     * yourself, so pass the same object you gave the grid to keep them
     * consistent.
     */
    icons?: GridIcons
    /**
     * `'immediate'` (default) calls `onChange` on every edit. `'deferred'`
     * collects edits in the panel and shows Apply / Cancel, so a server
     * model reloads once per session of changes rather than once per chip.
     */
    applyMode?: 'immediate' | 'deferred'
    /**
     * Strings, for localization. Partial; missing keys keep the English
     * default. Pass the same map to `SvGroupCell`.
     */
    messages?: Partial<ServerGroupMessages>
  }
  let {
    columns,
    groupBy,
    onChange,
    placeholder,
    icons,
    applyMode = 'immediate',
    messages,
  }: Props = $props()
  const m = $derived(resolveServerGroupMessages(messages))

  // Deferred mode edits a local copy; a `groupBy` that changes from outside
  // wins over it (a change from elsewhere drops what was pending here). By
  // value, not by identity: a server row model hands out a fresh array on
  // every emit, and a block landing must not throw away un-applied chips.
  let pending = $state<string[] | null>(null)
  let seen = JSON.stringify(groupBy)
  $effect(() => {
    const now = JSON.stringify(groupBy)
    if (now === seen) return
    seen = now
    pending = null
  })
  const shown = $derived(pending ?? groupBy)
  const dirty = $derived(pending !== null && JSON.stringify(pending) !== JSON.stringify(groupBy))
  function commit(next: string[]) {
    if (applyMode === 'deferred') pending = next
    else onChange(next)
  }
  function apply() {
    if (!pending) return
    const next = pending
    pending = null
    onChange(next)
  }
  function cancel() {
    pending = null
  }

  const labelOf = (id: string) => columns.find((c) => c.id === id)?.label ?? id
  const available = $derived(columns.filter((c) => !shown.includes(c.id)))

  let dragIndex = $state<number | null>(null)
  /** Where a dragged chip would land, for the insertion mark. */
  let dropIndex = $state<number | null>(null)
  /** What a keyboard reorder just did, for the live region. */
  let announcement = $state('')

  function remove(id: string) {
    commit(shown.filter((g) => g !== id))
  }
  function add(id: string) {
    if (id && !shown.includes(id)) commit([...shown, id])
  }
  function reorder(to: number) {
    dropIndex = null
    if (dragIndex === null || dragIndex === to) {
      dragIndex = null
      return
    }
    const next = [...shown]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(to, 0, moved!)
    dragIndex = null
    commit(next)
  }
  function onPanelDrop(e: DragEvent) {
    e.preventDefault()
    const id = e.dataTransfer?.getData('text/sv-column')
    if (id) add(id)
  }
  function onChipDragStart(e: DragEvent, i: number) {
    dragIndex = i
    // Firefox starts no drag without data on the transfer.
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', shown[i] ?? '')
      e.dataTransfer.effectAllowed = 'move'
    }
  }
  /** Keyboard equivalent of dragging a chip: moves the chip at `i` one slot earlier/later,
   *  reusing `reorder()` (via `dragIndex`) so there is a single source of truth for the move. */
  function moveByKeyboard(i: number, delta: number) {
    const to = i + delta
    if (to < 0 || to >= shown.length) return
    const id = shown[i]!
    dragIndex = i
    reorder(to)
    announcement = fillMessage(m.movedTo, { label: labelOf(id), index: to + 1, total: shown.length })
  }
  function onChipKeydown(e: KeyboardEvent, i: number) {
    if (!e.altKey) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      moveByKeyboard(i, -1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      moveByKeyboard(i, 1)
    }
  }
</script>

<!-- Same override-or-default resolution SvGrid uses, kept local because this
     component is mounted by the consumer and never sees the grid's snippet. -->
{#snippet ic(name: GridIconName)}
  {@const override = icons?.[name]}
  {#if override}{@render override()}{:else}{GRID_ICON_GLYPHS[name]}{/if}
{/snippet}

<div
  class="sv-rowgroup-panel"
  role="group"
  aria-label={m.rowGroups}
  ondragover={(e) => e.preventDefault()}
  ondrop={onPanelDrop}
>
  <span class="sv-rgp-label" aria-hidden="true">{m.groupBy}</span>
  {#if shown.length === 0}
    <span class="sv-rgp-empty">{placeholder ?? m.dropHere}</span>
  {:else}
    {#each shown as id, i (id)}
      {#if i > 0}<span class="sv-rgp-sep" aria-hidden="true">{@render ic('breadcrumb-separator')}</span>{/if}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <span
        class="sv-rgp-chip"
        class:sv-rgp-chip-drag={dragIndex === i}
        class:sv-rgp-chip-drop={dropIndex === i && dragIndex !== i}
        role="group"
        tabindex="0"
        aria-label={fillMessage(m.groupedBy, { label: labelOf(id), index: i + 1, total: shown.length })}
        draggable="true"
        ondragstart={(e) => onChipDragStart(e, i)}
        ondragend={() => {
          dragIndex = null
          dropIndex = null
        }}
        ondragover={(e) => {
          e.preventDefault()
          if (dragIndex !== null) dropIndex = i
        }}
        ondragleave={() => {
          if (dropIndex === i) dropIndex = null
        }}
        ondrop={(e) => {
          // Handled here: without preventDefault Firefox opens the dropped
          // text as a URL.
          e.preventDefault()
          e.stopPropagation()
          reorder(i)
        }}
        onkeydown={(e) => onChipKeydown(e, i)}
      >
        <span class="sv-rgp-grip" aria-hidden="true">{@render ic('drag-handle')}</span>
        {labelOf(id)}
        <button type="button" class="sv-rgp-x" onclick={() => remove(id)} aria-label={fillMessage(m.stopGroupingBy, { label: labelOf(id) })}>{@render ic('remove')}</button>
      </span>
    {/each}
  {/if}
  {#if available.length}
    <select
      class="sv-rgp-add"
      aria-label={m.addGroupLabel}
      onchange={(e) => { add(e.currentTarget.value); e.currentTarget.value = '' }}
    >
      <option value="">{m.addGroup}</option>
      {#each available as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
    </select>
  {/if}
  {#if applyMode === 'deferred'}
    <span class="sv-rgp-apply" role="group" aria-label={m.applyGrouping}>
      <button type="button" class="sv-rgp-btn sv-rgp-btn-primary" disabled={!dirty} onclick={apply}>{m.apply}</button>
      <button type="button" class="sv-rgp-btn" disabled={!dirty} onclick={cancel}>{m.cancel}</button>
    </span>
  {/if}
  <span class="sv-rgp-live" aria-live="polite">{announcement}</span>
</div>

<style>
  .sv-rowgroup-panel {
    position: relative;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 10px;
    border: 1px dashed var(--sg-border, #cbd5e1);
    border-radius: 10px;
    background: var(--sg-header-bg, #f8fafc);
    font-size: 13px;
  }
  .sv-rgp-label { color: var(--sg-muted, #64748b); font-weight: 600; }
  .sv-rgp-empty { color: var(--sg-muted, #94a3b8); font-style: italic; }
  .sv-rgp-sep { color: var(--sg-muted, #94a3b8); }
  .sv-rgp-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px 3px 8px;
    border-radius: 999px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0);
    cursor: grab;
    user-select: none;
    font-weight: 600;
  }
  .sv-rgp-chip-drag { opacity: 0.5; }
  /* Where the dragged chip will land: an accent edge on the chip it displaces. */
  .sv-rgp-chip-drop { box-shadow: -3px 0 0 0 var(--sg-accent, #2563eb); }
  .sv-rgp-grip { color: var(--sg-muted, #94a3b8); cursor: grab; }
  .sv-rgp-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin: -4px -4px -4px 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--sg-muted, #64748b);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }
  .sv-rgp-x:hover { background: var(--sg-header-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  .sv-rgp-add {
    font: inherit;
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    color: var(--sg-accent, #2563eb);
    cursor: pointer;
  }
  .sv-rgp-apply { display: inline-flex; gap: 6px; margin-left: auto; }
  .sv-rgp-btn {
    font: inherit;
    font-size: 13px;
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .sv-rgp-btn-primary {
    background: var(--sg-accent, #2563eb);
    border-color: var(--sg-accent, #2563eb);
    color: var(--sg-on-accent, #fff);
  }
  .sv-rgp-btn:disabled { opacity: 0.5; cursor: default; }
  /* Apply with nothing to apply reads as off, not as a paler Apply. */
  .sv-rgp-btn-primary:disabled {
    opacity: 1;
    background: var(--sg-header-bg, #f1f5f9);
    border-color: var(--sg-border, #e2e8f0);
    color: var(--sg-muted, #64748b);
  }
  .sv-rgp-chip:focus-visible,
  .sv-rgp-x:focus-visible,
  .sv-rgp-add:focus-visible,
  .sv-rgp-btn:focus-visible {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: 2px;
  }
  /* The live region reads to a screen reader and takes no space. */
  .sv-rgp-live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
