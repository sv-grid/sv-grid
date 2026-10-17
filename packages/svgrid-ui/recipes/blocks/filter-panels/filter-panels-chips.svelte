<script lang="ts" module>
  /**
   * Applied filter chips block - a support queue filtered by chips. An Add
   * filter SvMenu lists fields with their values as submenus; picking one adds
   * a removable SvChip ("Status: Open"). Values of one field are OR-ed, fields
   * are AND-ed. A result count, Clear all, and a read-only SvTextInput with
   * the URL query string the filters would produce and a Copy link action.
   * SvBadge, SvToaster. Pure UI-kit, --sg-* themed.
   *
   * Headless: createFilterChips() below owns the applied filters, the matching
   * rows, the query string and the Add filter menu items with no markup. The
   * component under it is one styled render of that core; import
   * createFilterChips from this file (or `npx @svgrid/ui add
   * filter-panels-chips --headless` for the core alone) to draw your own.
   */
  import type { MenuItem } from '@svgrid/grid'

  export type Ticket = { id: number; subject: string; status: string; priority: string; channel: string; assignee: string }
  export type ChipField = 'status' | 'priority' | 'channel' | 'assignee'
  export type ChipFilter = { field: ChipField; value: string }
  export type ChipFieldDef = { key: ChipField; label: string; values: string[] }
  export type FilterChipsOptions = {
    tickets?: Ticket[]
    fields?: ChipFieldDef[]
    initial?: ChipFilter[]
    /** Called after clearAll() removes every chip. */
    onClear?: () => void
  }

  const FIELDS: ChipFieldDef[] = [
    { key: 'status', label: 'Status', values: ['Open', 'Pending', 'Solved'] },
    { key: 'priority', label: 'Priority', values: ['Urgent', 'High', 'Normal', 'Low'] },
    { key: 'channel', label: 'Channel', values: ['Email', 'Chat', 'Phone'] },
    { key: 'assignee', label: 'Assignee', values: ['Ines', 'Marco', 'Unassigned'] },
  ]
  const SAMPLE: Ticket[] = [
    { id: 4821, subject: 'Invoice PDF shows the wrong VAT number', status: 'Open', priority: 'High', channel: 'Email', assignee: 'Ines' },
    { id: 4819, subject: 'SSO login loops back to the sign-in page', status: 'Open', priority: 'Urgent', channel: 'Chat', assignee: 'Marco' },
    { id: 4817, subject: 'Export to CSV drops the last column', status: 'Pending', priority: 'Normal', channel: 'Email', assignee: 'Ines' },
    { id: 4812, subject: 'Need to add 12 seats before Friday', status: 'Open', priority: 'Normal', channel: 'Phone', assignee: 'Unassigned' },
    { id: 4809, subject: 'Webhook retries stopped overnight', status: 'Pending', priority: 'Urgent', channel: 'Email', assignee: 'Marco' },
    { id: 4802, subject: 'Change billing contact to finance@', status: 'Solved', priority: 'Low', channel: 'Email', assignee: 'Ines' },
    { id: 4798, subject: 'Dashboard timezone is off by one hour', status: 'Open', priority: 'Low', channel: 'Chat', assignee: 'Unassigned' },
    { id: 4791, subject: 'API rate limit raised for staging?', status: 'Solved', priority: 'Normal', channel: 'Chat', assignee: 'Marco' },
  ]

  export function createFilterChips(opts: FilterChipsOptions = {}) {
    const tickets = opts.tickets ?? SAMPLE
    const fields = opts.fields ?? FIELDS

    let filters = $state<ChipFilter[]>(opts.initial ?? [{ field: 'status', value: 'Open' }, { field: 'status', value: 'Pending' }])
    let menuOpen = $state(false)

    const labelOf = (f: ChipField) => fields.find((x) => x.key === f)?.label ?? f
    const has = (f: ChipFilter) => filters.some((x) => x.field === f.field && x.value === f.value)
    const results = $derived(tickets.filter((t) => fields.every(({ key }) => {
      const vals = filters.filter((f) => f.field === key).map((f) => f.value)
      return !vals.length || vals.includes(t[key])
    })))
    const query = $derived.by(() => {
      const p = new URLSearchParams()
      for (const f of filters) p.append(f.field, f.value.toLowerCase())
      const s = p.toString()
      return s ? '?' + s : ''
    })

    function add(f: ChipFilter) {
      if (!has(f)) filters = [...filters, f]
    }
    function remove(f: ChipFilter) {
      filters = filters.filter((x) => !(x.field === f.field && x.value === f.value))
    }
    function clearAll() {
      filters = []
      opts.onClear?.()
    }

    // The Add filter menu: one entry per field, its values as a submenu.
    const menuItems = $derived<MenuItem[]>(fields.map((f) => ({
      label: f.label,
      children: f.values.map((value) => ({
        label: value,
        disabled: has({ field: f.key, value }),
        onSelect: () => add({ field: f.key, value }),
      })),
    })))

    return {
      fields,
      get total() { return tickets.length },
      get filters() { return filters },
      get results() { return results },
      /** `?status=open&status=pending`, or '' with no chips. */
      get query() { return query },
      get menuItems() { return menuItems },
      get menuOpen() { return menuOpen },
      set menuOpen(v: boolean) { menuOpen = v },
      labelOf,
      has,
      add,
      remove,
      clearAll,
      /** Chip text, e.g. "Status: Open". */
      chipLabel: (f: ChipFilter) => `${labelOf(f.field)}: ${f.value}`,
      /** Spread on the remove <button> of a chip you render yourself. */
      removeProps: (f: ChipFilter) => ({
        type: 'button' as const,
        'aria-label': `Remove ${labelOf(f.field)}: ${f.value}`,
        onclick: () => remove(f),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvMenu, SvChip, SvButton, SvBadge, SvTextInput, SvToaster, toast } from '@svgrid/grid'

  const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'neutral'> = { Urgent: 'danger', High: 'warning', Normal: 'neutral', Low: 'neutral' }

  const q = createFilterChips({ onClear: () => toast('All filters cleared') })

  function copy() {
    const url = location.origin + '/support/tickets' + q.query
    navigator.clipboard?.writeText(url).then(() => toast.success('Link copied'), () => toast.error('Could not copy the link'))
  }
</script>

<section class="sv-queue" aria-labelledby="sv-queue-title">
  <header class="sv-queue-head">
    <div>
      <h2 id="sv-queue-title">Support queue</h2>
      <p class="sv-queue-muted">Lumen Helpdesk - {q.total} tickets this week</p>
    </div>
    <SvMenu items={q.menuItems} bind:open={q.menuOpen} ariaLabel="Filter fields">
      {#snippet anchor()}<SvButton variant="outline">+ Add filter</SvButton>{/snippet}
    </SvMenu>
  </header>

  <div class="sv-queue-bar">
    <div class="sv-queue-chips" role="group" aria-label="Applied filters">
      {#each q.filters as f (f.field + f.value)}
        <SvChip removable onRemove={() => q.remove(f)}>{q.chipLabel(f)}</SvChip>
      {:else}
        <span class="sv-queue-muted sv-queue-none">No filters. Use Add filter to narrow the queue.</span>
      {/each}
    </div>
    <div class="sv-queue-summary">
      <span class="sv-queue-count" aria-live="polite">{q.results.length} of {q.total} tickets</span>
      {#if q.filters.length}<button type="button" class="sv-queue-link" onclick={q.clearAll}>Clear all</button>{/if}
    </div>
  </div>

  <div class="sv-queue-url">
    <SvTextInput label="Query string" value={q.query || '(none)'} readonly block
      hint="What a shareable link to this view would carry."
      actions={[{ label: 'Copy link', onClick: copy, disabled: !q.query }]} />
  </div>

  <ul class="sv-queue-list">
    {#each q.results as t (t.id)}
      <li>
        <span class="sv-queue-id">#{t.id}</span>
        <div class="sv-queue-meta">
          <strong>{t.subject}</strong>
          <span class="sv-queue-muted">{t.status} - {t.channel} - {t.assignee}</span>
        </div>
        <SvBadge size="sm" variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</SvBadge>
      </li>
    {:else}
      <li class="sv-queue-empty">
        <span>No tickets match these filters.</span>
        <SvButton variant="secondary" onclick={q.clearAll}>Clear all</SvButton>
      </li>
    {/each}
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-queue {
    width: 100%; box-sizing: border-box; min-height: 540px; padding: 24px;
    display: flex; flex-direction: column; gap: 14px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-queue-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
  h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-queue-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-queue-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 30px; }
  .sv-queue-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
  .sv-queue-none { margin: 0; }
  .sv-queue-summary { flex: none; display: flex; align-items: center; gap: 12px; font-size: 13px; }
  .sv-queue-count { font-variant-numeric: tabular-nums; }
  .sv-queue-link {
    background: none; border: 0; padding: 0; font: inherit; font-size: 13px; cursor: pointer;
    color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px;
  }
  .sv-queue-link:hover { color: var(--sg-accent, #4f46e5); }
  .sv-queue-url { max-width: 640px; }
  .sv-queue-url :global(input) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }

  .sv-queue-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); }
  .sv-queue-list li { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-queue-list li:last-child { border-bottom: 0; }
  .sv-queue-id { flex: none; width: 48px; font-size: 12.5px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .sv-queue-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sv-queue-meta strong { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-queue-meta .sv-queue-muted { margin: 0; font-size: 12.5px; }
  .sv-queue-list li.sv-queue-empty { justify-content: space-between; padding: 22px 14px; font-size: 13px; color: var(--sg-muted, #64748b); }

  @media (max-width: 640px) {
    .sv-queue { padding: 18px 16px; }
    .sv-queue-head { flex-wrap: wrap; align-items: center; }
    .sv-queue-bar { flex-direction: column; align-items: flex-start; flex-wrap: wrap; }
    .sv-queue-id { display: none; }
  }
</style>
