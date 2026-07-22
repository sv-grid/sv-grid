<script lang="ts">
  /**
   * SvListBox - a production assignee picker: an inline multi-select list with
   * grouped options (departments) and a live selection summary. Copy-paste ready.
   */
  import { SvListBox } from '@svgrid/grid'
  import type { ListOption } from '@svgrid/grid'

  const people: ListOption[] = [
    { value: 'amy', label: 'Amy Chen', group: 'Engineering' },
    { value: 'ben', label: 'Ben Ortiz', group: 'Engineering' },
    { value: 'cara', label: 'Cara Singh', group: 'Engineering' },
    { value: 'dan', label: 'Dan Weber', group: 'Design' },
    { value: 'eve', label: 'Eve Larsson', group: 'Design' },
    { value: 'finn', label: 'Finn Murphy', group: 'Product' },
    { value: 'gia', label: 'Gia Rossi', group: 'Product' },
  ]
  let assignees = $state<Array<string | number>>(['amy', 'dan'])
  const names = $derived(assignees.map((v) => people.find((p) => p.value === v)?.label).join(', '))
</script>

<div class="wrap">
  <header>
    <h2>List box</h2>
    <p>An inline single/multi-select list (WAI-ARIA listbox) with grouped options, roving keyboard and type-ahead. Assign work, build audiences, pick columns.</p>
  </header>

  <div class="card">
    <label class="ttl">Assignees</label>
    <SvListBox options={people} value={assignees} multiple rows={7} onChange={(v) => (assignees = v)} />
    <p class="summary">{assignees.length ? names : 'No one assigned'}</p>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 420px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .card { display: flex; flex-direction: column; gap: 8px; }
  .ttl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .summary { margin: 0; font-size: 13px; color: var(--sg-fg, #0f172a); }
</style>
