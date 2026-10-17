<script lang="ts" module>
  /**
   * Collapsible filters block - a task tracker with its filters in SvAccordion
   * sections: Status SvCheckBox list, an Assignee SvDropDownList, a due-date
   * SvDateRangeInput and an SvMultiSelect of tags. Each section header carries
   * an SvBadge with its active count, and the SvGrid on the right refilters on
   * every change, with sortable columns, a row count and Clear all.
   * SvToaster. Pure UI-kit, --sg-* themed.
   *
   * Headless: createCollapsibleFilters() below owns the filter values, which
   * sections are open, the per-section counts and the filtered rows with no
   * markup. The component under it is one styled render of that core; import
   * createCollapsibleFilters from this file (or `npx @svgrid/ui add
   * filter-panels-collapsible --headless` for the core alone) to draw your own.
   */
  import type { DateRangeValue } from '@svgrid/grid'

  export type Task = { key: string; title: string; status: string; assignee: string; due: string; tags: string }
  export type FilterSection = 'status' | 'assignee' | 'due' | 'tags'
  export type CollapsibleFiltersOptions = {
    tasks?: Task[]
    statuses?: string[]
    assignees?: string[]
    tags?: string[]
    /** Sections open on first render. */
    expanded?: FilterSection[]
    /** Called after clearAll() turns every filter off. */
    onClear?: () => void
  }

  const SAMPLE: Task[] = [
    { key: 'FL-212', title: 'Route planner: avoid toll roads', status: 'In progress', assignee: 'Maya Chen', due: '2026-10-17', tags: 'routing, api' },
    { key: 'FL-208', title: 'Driver app crashes on Android 12', status: 'Blocked', assignee: 'Omar Haddad', due: '2026-10-16', tags: 'mobile, bug' },
    { key: 'FL-205', title: 'Proof-of-delivery photo upload', status: 'In review', assignee: 'Priya Nair', due: '2026-10-21', tags: 'mobile' },
    { key: 'FL-201', title: 'Depot capacity report', status: 'To do', assignee: 'Leo Martins', due: '2026-10-28', tags: 'reports' },
    { key: 'FL-198', title: 'ETA webhook for customers', status: 'In progress', assignee: 'Maya Chen', due: '2026-10-23', tags: 'api' },
    { key: 'FL-194', title: 'Fuel surcharge in invoices', status: 'Done', assignee: 'Leo Martins', due: '2026-10-09', tags: 'billing' },
    { key: 'FL-190', title: 'Map tiles flicker on zoom', status: 'To do', assignee: 'Omar Haddad', due: '2026-11-04', tags: 'routing, bug' },
    { key: 'FL-187', title: 'Weekly on-time rate email', status: 'Done', assignee: 'Priya Nair', due: '2026-10-07', tags: 'reports' },
    { key: 'FL-183', title: 'Rate limit the public tracking API', status: 'In review', assignee: 'Maya Chen', due: '2026-10-19', tags: 'api, security' },
    { key: 'FL-179', title: 'Split shipments across two vans', status: 'To do', assignee: 'Priya Nair', due: '2026-11-12', tags: 'routing' },
  ]

  export const FILTER_SECTIONS: { id: FilterSection; label: string }[] = [
    { id: 'status', label: 'Status' }, { id: 'assignee', label: 'Assignee' },
    { id: 'due', label: 'Due date' }, { id: 'tags', label: 'Tags' },
  ]

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  export function createCollapsibleFilters(opts: CollapsibleFiltersOptions = {}) {
    const tasks = opts.tasks ?? SAMPLE
    const statusList = opts.statuses ?? ['To do', 'In progress', 'In review', 'Blocked', 'Done']
    const assigneeOptions = [{ value: 'all', label: 'Anyone' }, ...(opts.assignees ?? ['Maya Chen', 'Omar Haddad', 'Priya Nair', 'Leo Martins']).map((n) => ({ value: n, label: n }))]
    const tagOptions = (opts.tags ?? ['api', 'billing', 'bug', 'mobile', 'reports', 'routing', 'security']).map((t) => ({ value: t, label: t }))

    let statuses = $state<string[]>(['To do', 'In progress', 'Blocked'])
    let assignee = $state<string | number>('all')
    let due = $state<DateRangeValue>(null)
    let tags = $state<Array<string | number>>([])
    let expanded = $state<string[]>(opts.expanded ?? ['status', 'tags'])

    const rows = $derived(tasks.filter((t) =>
      (!statuses.length || statuses.includes(t.status)) &&
      (assignee === 'all' || t.assignee === assignee) &&
      (!due || (t.due >= iso(due[0]) && t.due <= iso(due[1]))) &&
      (!tags.length || tags.some((g) => t.tags.split(', ').includes(String(g))))))
    const counts = $derived<Record<string, number>>({
      status: statuses.length, assignee: assignee === 'all' ? 0 : 1, due: due ? 1 : 0, tags: tags.length,
    })
    const active = $derived(Object.values(counts).reduce((a, b) => a + b, 0))

    function setOpen(id: string, open: boolean) {
      expanded = open ? [...expanded.filter((x) => x !== id), id] : expanded.filter((x) => x !== id)
    }
    function toggleStatus(s: string, on: boolean) {
      statuses = on ? [...statuses.filter((x) => x !== s), s] : statuses.filter((x) => x !== s)
    }
    function clearAll() {
      statuses = []; assignee = 'all'; due = null; tags = []
      opts.onClear?.()
    }

    return {
      sections: FILTER_SECTIONS, statusList, assigneeOptions, tagOptions,
      get total() { return tasks.length },
      /** The tasks that pass every filter; feed them to your grid or list. */
      get rows() { return rows },
      /** Active filters per section id. */
      get counts() { return counts },
      get active() { return active },
      get statuses() { return statuses },
      set statuses(v: string[]) { statuses = v },
      get assignee() { return assignee },
      set assignee(v: string | number) { assignee = v },
      get due() { return due },
      set due(v: DateRangeValue) { due = v },
      get tags() { return tags },
      set tags(v: Array<string | number>) { tags = v },
      isOpen: (id: string) => expanded.includes(id),
      setOpen,
      toggleStatus,
      clearAll,
      /** Spread on a section's header <button>; pair with panelProps(id). */
      headerProps: (id: string) => ({
        type: 'button' as const,
        id: `sv-tracker-h-${id}`,
        'aria-expanded': expanded.includes(id),
        'aria-controls': `sv-tracker-p-${id}`,
        onclick: () => setOpen(id, !expanded.includes(id)),
      }),
      /** Spread on the section's panel; render it only while isOpen(id). */
      panelProps: (id: string) => ({
        id: `sv-tracker-p-${id}`,
        role: 'region' as const,
        'aria-labelledby': `sv-tracker-h-${id}`,
      }),
    }
  }
</script>

<script lang="ts">
  import {
    SvGrid, SvAccordion, SvCheckBox, SvDropDownList, SvDateRangeInput, SvMultiSelect, SvBadge,
    SvToaster, toast, type GridColumns, type AccordionItem,
  } from '@svgrid/grid'

  const columns: GridColumns<Task> = [
    { field: 'title', header: 'Task', width: 185 },
    { field: 'status', header: 'Status', width: 100 },
    { field: 'assignee', header: 'Assignee', width: 115, hideBelow: 420 },
    { field: 'due', header: 'Due', width: 102, hideBelow: 420 },
    { field: 'tags', header: 'Tags', width: 115, hideBelow: 420 },
  ]

  const f = createCollapsibleFilters({ onClear: () => toast('Filters cleared') })
</script>

<section class="sv-tracker" aria-labelledby="sv-tracker-title">
  <aside class="sv-tracker-filters" aria-label="Task filters">
    <div class="sv-tracker-filters-head">
      <span class="sv-tracker-title">Filters</span>
      <button type="button" class="sv-tracker-link" onclick={f.clearAll} disabled={!f.active}>Clear all</button>
    </div>
    <div class="sv-tracker-sections">
      {#each f.sections as s (s.id)}
        <div class="sv-tracker-sec">
          <SvAccordion items={[s]} expanded={f.isOpen(s.id) ? [s.id] : []}
            onChange={(ids) => f.setOpen(s.id, ids.length > 0)} panel={body} />
          {#if f.counts[s.id]}<span class="sv-tracker-count"><SvBadge size="sm" variant="accent" pill>{f.counts[s.id]}</SvBadge></span>{/if}
        </div>
      {/each}
    </div>
  </aside>

  <main class="sv-tracker-results">
    <header class="sv-tracker-head">
      <div>
        <h2 id="sv-tracker-title">Fieldline sprint 42</h2>
        <p class="sv-tracker-muted" aria-live="polite">{f.rows.length} of {f.total} tasks{f.active ? ` - ${f.active} ${f.active === 1 ? 'filter' : 'filters'} on` : ''}</p>
      </div>
    </header>
    <div class="sv-tracker-grid-box">
      <SvGrid data={f.rows} {columns} sortable showRowSelection={false} fitColumns responsive={{ breakpoint: 420 }} rowHeight={36} containerHeight={400}
        emptyMessage="No tasks match these filters" />
    </div>
  </main>
</section>

<SvToaster position="bottom-right" />

{#snippet body(item: AccordionItem)}
  {#if item.id === 'status'}
    <div class="sv-tracker-checks">
      {#each f.statusList as st (st)}
        <SvCheckBox checked={f.statuses.includes(st)} onChange={(on) => f.toggleStatus(st, on)}>{st}</SvCheckBox>
      {/each}
    </div>
  {:else if item.id === 'assignee'}
    <SvDropDownList label="Assigned to" options={f.assigneeOptions} value={f.assignee} onChange={(v) => (f.assignee = v)} block />
  {:else if item.id === 'due'}
    <div class="sv-tracker-stretch"><SvDateRangeInput label="Due between" value={f.due} onChange={(v) => (f.due = v)} months={1} block /></div>
  {:else}
    <div class="sv-tracker-stretch"><SvMultiSelect label="Has any tag" options={f.tagOptions} bind:value={f.tags} placeholder="Pick tags" block /></div>
  {/if}
{/snippet}

<style>
  .sv-tracker {
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 24px;
    display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 24px; align-items: start;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-tracker-filters { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .sv-tracker-filters-head { display: flex; align-items: center; justify-content: space-between; min-height: 30px; }
  .sv-tracker-title { font-size: 14px; font-weight: 650; }
  .sv-tracker-link {
    background: none; border: 0; padding: 0; font: inherit; font-size: 12.5px; cursor: pointer;
    color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px;
  }
  .sv-tracker-link:hover { color: var(--sg-accent, #4f46e5); }
  .sv-tracker-link:disabled { color: var(--sg-muted, #64748b); text-decoration: none; cursor: default; }
  .sv-tracker-sections { border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); overflow: hidden; }
  .sv-tracker-sec { position: relative; }
  .sv-tracker-sec + .sv-tracker-sec { border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-tracker-sec :global(.sv-acc) { border: 0; border-radius: 0; }
  /* The badge sits over the header's right edge; clicks fall through to the header. */
  .sv-tracker-count { position: absolute; top: 12px; right: 14px; pointer-events: none; }
  .sv-tracker-checks { display: flex; flex-direction: column; gap: 8px; }
  /* SvDateRangeInput and SvMultiSelect leave their label wrapper at content width; stretch it. */
  .sv-tracker-stretch :global(.sv-field) { display: flex; width: 100%; }

  .sv-tracker-results { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
  .sv-tracker-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; min-height: 30px; }
  h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-tracker-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-tracker-grid-box { min-width: 0; }

  @media (max-width: 760px) {
    .sv-tracker { grid-template-columns: minmax(0, 1fr); padding: 18px 16px; }
  }
</style>
