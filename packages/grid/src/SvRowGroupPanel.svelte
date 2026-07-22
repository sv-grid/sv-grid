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
  type Col = { id: string; label: string }
  type Props = {
    /** Columns that can be grouped on. */
    columns: Col[]
    /** Current group-by column ids, outer to inner. */
    groupBy: string[]
    /** Called with the new group-by order. */
    onChange: (groupBy: string[]) => void
    /** Text shown when nothing is grouped. */
    placeholder?: string
  }
  let { columns, groupBy, onChange, placeholder = 'Drag a column here to group by it' }: Props = $props()

  const labelOf = (id: string) => columns.find((c) => c.id === id)?.label ?? id
  const available = $derived(columns.filter((c) => !groupBy.includes(c.id)))

  let dragIndex = $state<number | null>(null)

  function remove(id: string) {
    onChange(groupBy.filter((g) => g !== id))
  }
  function add(id: string) {
    if (id && !groupBy.includes(id)) onChange([...groupBy, id])
  }
  function reorder(to: number) {
    if (dragIndex === null || dragIndex === to) return
    const next = [...groupBy]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(to, 0, moved!)
    dragIndex = null
    onChange(next)
  }
  function onPanelDrop(e: DragEvent) {
    const id = e.dataTransfer?.getData('text/sv-column')
    if (id) add(id)
  }
</script>

<div
  class="sv-rowgroup-panel"
  role="group"
  aria-label="Row groups"
  ondragover={(e) => e.preventDefault()}
  ondrop={onPanelDrop}
>
  <span class="sv-rgp-label" aria-hidden="true">Group by:</span>
  {#if groupBy.length === 0}
    <span class="sv-rgp-empty">{placeholder}</span>
  {:else}
    {#each groupBy as id, i (id)}
      {#if i > 0}<span class="sv-rgp-sep" aria-hidden="true">›</span>{/if}
      <span
        class="sv-rgp-chip"
        class:sv-rgp-chip-drag={dragIndex === i}
        draggable="true"
        ondragstart={() => (dragIndex = i)}
        ondragend={() => (dragIndex = null)}
        ondragover={(e) => e.preventDefault()}
        ondrop={() => reorder(i)}
      >
        <span class="sv-rgp-grip" aria-hidden="true">⠿</span>
        {labelOf(id)}
        <button type="button" class="sv-rgp-x" onclick={() => remove(id)} aria-label={`Stop grouping by ${labelOf(id)}`}>×</button>
      </span>
    {/each}
  {/if}
  {#if available.length}
    <select
      class="sv-rgp-add"
      aria-label="Add a group column"
      onchange={(e) => { add(e.currentTarget.value); e.currentTarget.value = '' }}
    >
      <option value="">+ Group by</option>
      {#each available as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
    </select>
  {/if}
</div>

<style>
  .sv-rowgroup-panel {
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
  .sv-rgp-grip { color: var(--sg-muted, #94a3b8); cursor: grab; }
  .sv-rgp-x {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
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
</style>
