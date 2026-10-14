<script lang="ts">
  /**
   * The view bar's view switcher: the saved views (switch, rename, duplicate,
   * delete) and "Create" for a new one of any type the page can show. A
   * Kanban asks what to stack by, a calendar or Gantt which date field, a
   * gallery which attachment field makes the cover.
   */
  import { panelFocus } from './panel-focus'
  import { coverColumns, dateColumns, dependencyColumns, progressColumns, stackableColumns, viewTypeInfo, type FieldView, type FieldViewType } from '../view-model'
  import { CHART_KINDS, chartXColumns, chartYColumns, defaultChart, type ChartSetting } from '../chart-view'

  let {
    ctrl,
    views,
    activeId,
    types,
    onSwitch,
    onCreate,
    onRename,
    onDuplicate,
    onDelete,
  }: {
    ctrl: any
    views: ReadonlyArray<FieldView>
    activeId: string
    types: ReadonlyArray<FieldViewType>
    onSwitch: (id: string) => void
    onCreate: (view: Omit<FieldView, 'id'>) => void
    onRename: (id: string, name: string) => void
    onDuplicate: (id: string) => void
    onDelete: (id: string) => void
  } = $props()

  let renaming = $state<string | null>(null)
  let draft = $state<{ type: FieldViewType; name: string; stackBy?: string; dateField?: string; endField?: string; progressField?: string; dependencyField?: string; coverField?: string; chart?: ChartSetting } | null>(null)

  const stacks = $derived(stackableColumns(ctrl))
  const dates = $derived(dateColumns(ctrl))
  const covers = $derived(coverColumns(ctrl))
  const progresses = $derived(progressColumns(ctrl))
  const dependencies = $derived(dependencyColumns(ctrl))
  const chartXs = $derived(chartXColumns(ctrl))
  const chartYs = $derived(chartYColumns(ctrl))
  /** A type the table can show: a Kanban needs a field to stack by, a calendar a date, a chart a field to group by. */
  const possible = (t: FieldViewType) =>
    t === 'kanban' ? stacks.length > 0 : t === 'calendar' || t === 'gantt' ? dates.length > 0 : t === 'chart' ? chartXs.length > 0 : true

  function nameFor(t: FieldViewType): string {
    const base = viewTypeInfo(t).label
    let n = 1
    const taken = new Set(views.map((v) => v.name))
    while (taken.has(n === 1 ? base : `${base} ${n}`)) n += 1
    return n === 1 ? base : `${base} ${n}`
  }
  function start(t: FieldViewType) {
    draft = {
      type: t,
      name: nameFor(t),
      ...(t === 'kanban' ? { stackBy: stacks[0]?.id } : {}),
      ...(t === 'calendar' || t === 'gantt' ? { dateField: dates[0]?.id, endField: t === 'gantt' ? dates[1]?.id : undefined } : {}),
      // A Gantt starts with the table's progress and depends-on fields, when it has them.
      ...(t === 'gantt' ? { progressField: progresses[0]?.id, dependencyField: dependencies[0]?.id } : {}),
      ...(t === 'gallery' && covers[0] ? { coverField: covers[0].id } : {}),
      ...(t === 'chart' ? { chart: defaultChart(ctrl) ?? undefined } : {}),
    }
  }
  function create() {
    if (!draft) return
    const d = draft
    draft = null
    onCreate({ ...d, name: d.name.trim() || nameFor(d.type) })
  }
  function focusSelect(node: HTMLInputElement) {
    node.focus()
    node.select()
  }
</script>

<div class="sv-fvb-panel sv-fviews" use:panelFocus>
  {#if draft}
    {@const d = draft}
    <p class="sv-fvb-title">New {viewTypeInfo(d.type).label.toLowerCase()} view</p>
    <label class="sv-fviews-field">
      <span>Name</span>
      <input class="sv-fvb-input" bind:value={d.name} use:focusSelect onkeydown={(e) => {
        if (e.key === 'Enter') create()
      }} />
    </label>
    {#if d.type === 'kanban'}
      <label class="sv-fviews-field">
        <span>Stack records by</span>
        <select class="sv-fvb-select" bind:value={d.stackBy}>
          {#each stacks as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
        </select>
      </label>
    {:else if d.type === 'calendar' || d.type === 'gantt'}
      <label class="sv-fviews-field">
        <span>{d.type === 'gantt' ? 'Start date' : 'Date field'}</span>
        <select class="sv-fvb-select" bind:value={d.dateField}>
          {#each dates as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
        </select>
      </label>
      <label class="sv-fviews-field">
        <span>End date</span>
        <select class="sv-fvb-select" bind:value={d.endField}>
          <option value={undefined}>None</option>
          {#each dates.filter((c) => c.id !== d.dateField) as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
        </select>
      </label>
      {#if d.type === 'gantt' && progresses.length}
        <label class="sv-fviews-field">
          <span>Progress</span>
          <select class="sv-fvb-select" bind:value={d.progressField}>
            <option value={undefined}>None</option>
            {#each progresses as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
          </select>
        </label>
      {/if}
      {#if d.type === 'gantt' && dependencies.length}
        <label class="sv-fviews-field">
          <span>Depends on</span>
          <select class="sv-fvb-select" bind:value={d.dependencyField}>
            <option value={undefined}>None</option>
            {#each dependencies as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
          </select>
        </label>
      {/if}
    {:else if d.type === 'chart' && d.chart}
      {@const c = d.chart}
      <label class="sv-fviews-field">
        <span>Chart type</span>
        <select class="sv-fvb-select" bind:value={c.kind}>
          {#each CHART_KINDS as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
        </select>
      </label>
      <label class="sv-fviews-field">
        <span>Group by</span>
        <select class="sv-fvb-select" bind:value={c.x}>
          {#each chartXs as col (col.id)}<option value={col.id}>{col.header}</option>{/each}
        </select>
      </label>
      <label class="sv-fviews-field">
        <span>Value</span>
        <select class="sv-fvb-select" bind:value={c.y}>
          <option value={undefined}>Number of records</option>
          {#each chartYs as col (col.id)}<option value={col.id}>Sum of {col.header}</option>{/each}
        </select>
      </label>
    {:else if d.type === 'gallery'}
      <label class="sv-fviews-field">
        <span>Cover image</span>
        <select class="sv-fvb-select" bind:value={d.coverField}>
          <option value={undefined}>None</option>
          {#each covers as c (c.id)}<option value={c.id}>{c.header}</option>{/each}
        </select>
      </label>
    {/if}
    <div class="sv-fvb-foot sv-fviews-actions">
      <button type="button" class="sv-fvb-text-btn" onclick={() => (draft = null)}>Cancel</button>
      <button type="button" class="sv-fvb-solid-btn" onclick={create}>Create view</button>
    </div>
  {:else}
    <ul class="sv-fviews-list" role="list">
      {#each views as v (v.id)}
        <li class="sv-fviews-item" class:is-active={v.id === activeId}>
          {#if renaming === v.id}
            <input
              class="sv-fvb-input"
              aria-label="View name"
              value={v.name}
              use:focusSelect
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  onRename(v.id, (e.currentTarget as HTMLInputElement).value.trim() || v.name)
                  renaming = null
                } else if (e.key === 'Escape') {
                  e.stopPropagation()
                  renaming = null
                }
              }}
              onblur={(e) => {
                onRename(v.id, (e.currentTarget as HTMLInputElement).value.trim() || v.name)
                renaming = null
              }}
            />
          {:else}
            <button type="button" class="sv-fviews-pick" aria-current={v.id === activeId ? 'true' : undefined} onclick={() => onSwitch(v.id)}>
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d={viewTypeInfo(v.type).icon} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>{v.name}</span>
            </button>
            <span class="sv-fviews-acts">
              <button type="button" class="sv-fvb-icon-btn" aria-label={`Rename ${v.name}`} title="Rename" onclick={() => (renaming = v.id)}>
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" /></svg>
              </button>
              <button type="button" class="sv-fvb-icon-btn" aria-label={`Duplicate ${v.name}`} title="Duplicate" onclick={() => onDuplicate(v.id)}>
                <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M8 8h12v12H8zM16 8V4H4v12h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" /></svg>
              </button>
              {#if views.length > 1}
                <button type="button" class="sv-fvb-icon-btn" aria-label={`Delete ${v.name}`} title="Delete" onclick={() => onDelete(v.id)}>
                  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" /></svg>
                </button>
              {/if}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="sv-fvb-title sv-fviews-create">Create</p>
    <ul class="sv-fviews-types" role="list">
      {#each types as t (t)}
        {@const info = viewTypeInfo(t)}
        <li>
          <button
            type="button"
            class="sv-fviews-type"
            disabled={!possible(t)}
            title={possible(t) ? undefined : t === 'kanban' ? 'Needs a single select field' : t === 'chart' ? 'Needs a field to group by' : 'Needs a date field'}
            onclick={() => start(t)}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d={info.icon} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>{info.label}</span>
            <svg class="sv-fviews-plus" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .sv-fviews { width: 260px; }
  .sv-fviews-list, .sv-fviews-types { list-style: none; margin: 0; padding: 0; }
  .sv-fviews-item { display: flex; align-items: center; gap: 2px; border-radius: 6px; }
  .sv-fviews-item:hover, .sv-fviews-item.is-active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fviews-item .sv-fviews-acts { display: none; }
  .sv-fviews-item:hover .sv-fviews-acts, .sv-fviews-item:focus-within .sv-fviews-acts { display: inline-flex; }
  .sv-fviews-pick, .sv-fviews-type {
    display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; padding: 6px 8px; border: 0; border-radius: 6px;
    background: none; color: inherit; font: inherit; text-align: start; cursor: pointer;
  }
  .sv-fviews-pick span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-fviews-item.is-active .sv-fviews-pick { font-weight: 600; }
  .sv-fviews-type:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fviews-type:disabled { opacity: 0.45; cursor: default; }
  .sv-fviews-plus { margin-inline-start: auto; color: var(--sg-muted, #64748b); }
  .sv-fviews-create { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-fviews-field { display: grid; gap: 4px; margin: 8px 0; }
  .sv-fviews-field > span { font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-fviews-actions { justify-content: flex-end; }
</style>
