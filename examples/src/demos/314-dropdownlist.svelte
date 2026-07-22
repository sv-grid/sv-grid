<script lang="ts">
  /**
   * SvDropDownList - a production toolbar: compact single-select dropdowns for
   * status and priority (grouped, type-ahead, portalled + animated). Copy-paste
   * ready.
   */
  import { SvDropDownList } from '@svgrid/grid'
  import type { ListOption } from '@svgrid/grid'

  const statuses: ListOption[] = [
    { value: 'todo', label: 'To do', group: 'Open' },
    { value: 'doing', label: 'In progress', group: 'Open' },
    { value: 'review', label: 'In review', group: 'Open' },
    { value: 'done', label: 'Done', group: 'Closed' },
    { value: 'wontfix', label: "Won't fix", group: 'Closed' },
  ]
  const priorities: ListOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'med', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ]
  let status = $state<string | number | null>('doing')
  let priority = $state<string | number | null>('high')
  const rows = 4
</script>

<div class="wrap">
  <header>
    <h2>Drop-down list</h2>
    <p>A compact single-select (no typing in the field) with grouped options, type-ahead and keyboard - toolbars, filters, cell editors.</p>
  </header>

  <div class="toolbar">
    <label class="f">Status<SvDropDownList options={statuses} value={status} onChange={(v) => (status = v)} /></label>
    <label class="f">Priority<SvDropDownList options={priorities} value={priority} onChange={(v) => (priority = v)} /></label>
  </div>

  <div class="issues">
    {#each Array(rows) as _, i (i)}
      <div class="issue">
        <span class="badge badge--{status}">{statuses.find((s) => s.value === status)?.label}</span>
        <span class="title">Issue #{1042 + i} - improve dashboard load time</span>
        <span class="pri pri--{priority}">{priorities.find((p) => p.value === priority)?.label}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 640px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .toolbar { display: flex; gap: 16px; flex-wrap: wrap; }
  .f { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .issues { display: flex; flex-direction: column; gap: 6px; }
  .issue { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; font-size: 13px; }
  .title { flex: 1; }
  .badge, .pri { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .badge { background: color-mix(in srgb, var(--sg-accent, #2563eb) 14%, transparent); color: var(--sg-accent, #2563eb); }
  .pri { color: var(--sg-muted, #64748b); border: 1px solid var(--sg-border, #e2e8f0); }
  .pri--urgent { color: #dc2626; border-color: #dc2626; }
  .pri--high { color: #ea580c; border-color: #ea580c; }
</style>
