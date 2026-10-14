<script lang="ts">
  /**
   * A group's header in a table grouped by fields: the field's name over its
   * value, drawn as the cell draws it (a select's pill, a person's avatar),
   * the number of records, the summaries the fields picked for this group
   * ("Budget Sum $4,300"), and "+" to add a record that is already in it.
   */
  import { tick } from 'svelte'
  import FieldCell from './FieldCell.svelte'
  import { newRowValues } from './field-ops'
  import { typeDrawsCell } from './registry.svelte'
  import { groupLeaves, leafFilter } from './grid-access'

  type Row = {
    id: string
    depth: number
    original: Record<string, unknown>
    subRows?: Row[]
    getCanExpand?: () => boolean
    getIsExpanded?: () => boolean
    toggleExpanded?: () => void
    __treeRow?: boolean
  }
  type Col = { id: string; columnDef: Record<string, any> }
  let { ctrl, row, column, value }: { ctrl: any; row: Row; column: Col | undefined; value: unknown; count: number } = $props()

  // The group's records the view's filter keeps (the grid groups before it filters).
  const records = $derived(groupLeaves(row, leafFilter(ctrl)))
  // The first record's own value: the group key is text, the record has the value (an array, a number).
  const raw = $derived(column?.columnDef.field ? (records[0]?.original?.[column.columnDef.field] ?? value) : value)
  const draws = $derived(!!column?.columnDef.fieldType && column.columnDef.cell == null && typeDrawsCell(column.columnDef))
  const empty = $derived(raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0))
  const label = $derived(column ? (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id) : '')

  // The fields with a summary chosen, computed over this group's records.
  const summaries = $derived.by(() => {
    const out: Array<{ id: string; label: string; text: string }> = []
    for (const c of (ctrl.allColumns ?? []) as Col[]) {
      const fn = c.columnDef.summary
      if (typeof fn !== 'function' || c.id === column?.id) continue
      const text = String(fn([], records.map((r) => r.original)) ?? '')
      if (text) out.push({ id: c.id, label: typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id, text })
    }
    return out
  })

  /** A new record with this group's values (and its parent groups'), as "+ Add row" makes one. */
  async function add() {
    const api = ctrl.buildApi?.()
    const first = records[0]
    if (!api || !first) return
    const grouped: string[] = ctrl.grid?.getState?.().grouping ?? []
    const values: Record<string, unknown> = {}
    for (const id of grouped.slice(0, row.depth + 1)) {
      const def = ((ctrl.allColumns ?? []) as Col[]).find((c) => c.id === id)?.columnDef ?? ((ctrl.internalColumns ?? []) as Array<Record<string, any>>).find((d) => String(d.id ?? d.field) === id)
      const field = def?.field
      if (field && !def?.fieldFn) values[field] = copy(first.original[field])
    }
    const cfg = ctrl.props.rowAdder
    const defaults = cfg && typeof cfg === 'object' && typeof cfg.defaults === 'function' ? cfg.defaults() : {}
    const next: Record<string, unknown> = newRowValues(ctrl, { ...defaults, ...values })
    api.addRow(next, 'bottom')
    // Open the group, so the new record shows.
    if (!row.getIsExpanded?.()) row.toggleExpanded?.()
    await tick()
    const index = (ctrl.allRows as Array<{ original: unknown }>).findIndex((r) => r.original === next)
    if (index >= 0) {
      api.scrollToRow(index)
      await tick()
      for (const c of ctrl.allColumns as Array<{ id: string }>) {
        if (api.startEditing(index, c.id)) break
      }
    }
    ctrl.props.onRowAdd?.({ row: next })
  }
  /** A list value (tags) is copied, not shared with the record it came from. */
  const copy = (v: unknown): unknown => (Array.isArray(v) ? [...v] : v)
</script>

<span class="sv-fgh">
  <span class="sv-fgh-key">
    <span class="sv-fgh-name">{label}</span>
    <span class="sv-fgh-value">
      {#if empty}
        <span class="sv-fgh-empty">Empty</span>
      {:else if draws && column}
        <FieldCell {ctrl} row={{ id: row.id, original: records[0]?.original ?? {} }} {column} value={raw} />
      {:else}
        {column?.columnDef.formatter ? String(column.columnDef.formatter({ value: raw, row: records[0] ?? null, column }) ?? '') : String(raw)}
      {/if}
    </span>
  </span>
  <span class="sv-fgh-count">{records.length} {records.length === 1 ? 'record' : 'records'}</span>
  {#each summaries as s (s.id)}
    <span class="sv-fgh-sum"><span class="sv-fgh-sum-label">{s.label}</span>{s.text}</span>
  {/each}
  {#if ctrl.props.rowAdder && ctrl.editingEnabled}
    <button
      type="button"
      class="sv-fgh-add"
      aria-label={`Add a record to ${label} ${empty ? 'Empty' : String(value ?? '')}`}
      title="Add a record to this group"
      onclick={(e) => {
        e.stopPropagation()
        void add()
      }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
    </button>
  {/if}
</span>

<style>
  .sv-fgh { display: inline-flex; align-items: center; gap: 14px; min-width: 0; }
  .sv-fgh-key { display: inline-flex; flex-direction: column; justify-content: center; gap: 4px; line-height: 1.2; min-width: 0; }
  .sv-fgh-name { font-size: 11px; color: var(--sg-muted, #64748b); }
  .sv-fgh-value { display: inline-flex; align-items: center; font-weight: 600; min-height: 20px; }
  .sv-fgh-empty { color: var(--sg-muted, #64748b); font-weight: 400; font-style: italic; }
  .sv-fgh-count { font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-fgh-sum { font-size: 12px; font-variant-numeric: tabular-nums; }
  .sv-fgh-sum-label { color: var(--sg-muted, #64748b); margin-inline-end: 4px; }
  .sv-fgh-add {
    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0;
    border: 0; border-radius: 6px; background: none; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-fgh-add:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
</style>
