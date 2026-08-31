<!-- Documented in: docs/help/rows/master-detail.md -->
<script lang="ts">
  /**
   * 181. Master / Detail - nested grids
   * -----------------------------------
   * The classic AG-Grid-style master/detail: each master row expands to reveal
   * a full nested <SvGrid responsive={true}> of its child records. Built on the grid's own
   * `isDetailRow` + `renderDetailRow` props - the detail row is a real
   * full-width colspan row, and its content is just another grid.
   *
   * Master = accounts; Detail = that account's call records.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  type Call = {
    callId: number
    direction: 'Inbound' | 'Outbound'
    number: string
    duration: number // seconds
    switchCode: string
  }
  type Account = {
    kind: 'account'
    id: string
    name: string
    account: number
    country: string
    calls: number
    minutes: number
    callRecords: Call[]
  }
  type Detail = { kind: 'detail'; id: string; parentId: string; name: string; callRecords: Call[] }
  type AnyRow = Account | Detail

  const SWITCHES = ['SW5', 'SW3', 'SW7', 'SW2', 'SW9']
  const NUMBERS = ['(02) 8988 1234', '(03) 9011 5567', '(07) 3210 9988', '(08) 6122 4531', '(02) 4455 7781']
  function makeCalls(seed: number, n: number): Call[] {
    const out: Call[] = []
    for (let i = 0; i < n; i += 1) {
      const k = seed * 13 + i * 7
      out.push({
        callId: 1000 + seed * 100 + i,
        direction: k % 2 === 0 ? 'Inbound' : 'Outbound',
        number: NUMBERS[k % NUMBERS.length]!,
        duration: 30 + (k * 17) % 540,
        switchCode: SWITCHES[k % SWITCHES.length]!,
      })
    }
    return out
  }

  const accounts: Account[] = [
    { kind: 'account', id: 'A-1001', name: 'Ada Lovelace',   account: 177001, country: 'United Kingdom', calls: 4, minutes: 32, callRecords: makeCalls(1, 4) },
    { kind: 'account', id: 'A-1002', name: 'Grace Hopper',   account: 177002, country: 'United States',  calls: 6, minutes: 51, callRecords: makeCalls(2, 6) },
    { kind: 'account', id: 'A-1003', name: 'Linus Torvalds', account: 177003, country: 'Finland',        calls: 3, minutes: 18, callRecords: makeCalls(3, 3) },
    { kind: 'account', id: 'A-1004', name: 'Margaret Hamilton', account: 177004, country: 'United States', calls: 7, minutes: 63, callRecords: makeCalls(4, 7) },
    { kind: 'account', id: 'A-1005', name: 'Tim Berners-Lee', account: 177005, country: 'United Kingdom', calls: 5, minutes: 40, callRecords: makeCalls(5, 5) },
  ]

  let expanded = $state<Set<string>>(new Set(['A-1002']))
  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  function expandAll() { expanded = new Set(accounts.map((a) => a.id)) }
  function collapseAll() { expanded = new Set() }

  // Splice a detail sentinel after each expanded account.
  const visible = $derived.by<AnyRow[]>(() => {
    const out: AnyRow[] = []
    for (const a of accounts) {
      out.push(a)
      if (expanded.has(a.id)) {
        out.push({ kind: 'detail', id: `${a.id}-d`, parentId: a.id, name: a.name, callRecords: a.callRecords })
      }
    }
    return out
  })

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, AnyRow>[] = [
    {
      id: 'expand', header: '', width: 40, editable: false, sortable: false, filterable: false,
      cell: (ctx) => ctx.row.original.kind === 'account'
        ? renderSnippet(Chevron, { id: ctx.row.original.id, open: expanded.has(ctx.row.original.id) })
        : renderSnippet(Blank, {}),
    },
    { field: 'name', header: 'Name', width: 190, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'account'
        ? renderSnippet(Plain, { value: ctx.row.original.name }) : renderSnippet(Blank, {}) },
    { id: 'account', header: 'Account', width: 120, align: 'right', editable: false,
      cell: (ctx) => ctx.row.original.kind === 'account'
        ? renderSnippet(Plain, { value: String(ctx.row.original.account) }) : renderSnippet(Blank, {}) },
    { id: 'country', header: 'Country', width: 170, editable: false,
      cell: (ctx) => ctx.row.original.kind === 'account'
        ? renderSnippet(Plain, { value: ctx.row.original.country }) : renderSnippet(Blank, {}) },
    { id: 'calls', header: 'Calls', width: 100, align: 'right', editable: false,
      cell: (ctx) => ctx.row.original.kind === 'account'
        ? renderSnippet(Plain, { value: String(ctx.row.original.calls) }) : renderSnippet(Blank, {}) },
    { id: 'minutes', header: 'Minutes', width: 110, align: 'right', editable: false,
      cell: (ctx) => ctx.row.original.kind === 'account'
        ? renderSnippet(Plain, { value: `${ctx.row.original.minutes} min` }) : renderSnippet(Blank, {}) },
  ]

  // Nested detail grid columns (the child grid).
  const detailFeatures = tableFeatures({ rowSortingFeature })
  const detailColumns: ColumnDef<typeof detailFeatures, Call>[] = [
    { field: 'callId', header: 'Call ID', width: 100, cellDataType: 'number' },
    { field: 'direction', header: 'Direction', width: 120 },
    { field: 'number', header: 'Number', width: 160 },
    { field: 'duration', header: 'Duration', width: 110, align: 'right',
      formatter: ({ value }) => {
        const s = Number(value)
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
      } },
    { field: 'switchCode', header: 'Switch', width: 90 },
  ]
</script>

{#snippet Chevron(props: { id: string; open: boolean })}
  <button class="md-chev" aria-label={props.open ? 'Collapse' : 'Expand'} onclick={() => toggle(props.id)}>
    <svg class={props.open ? 'is-open' : ''} viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 4 10 8 6 12"></polyline>
    </svg>
  </button>
{/snippet}
{#snippet Blank()}{/snippet}
{#snippet Plain(props: { value: string })}<span>{props.value}</span>{/snippet}

{#snippet DetailGrid(props: { row: AnyRow; rowIndex: number })}
  {#if props.row.kind === 'detail'}
    <div class="md-detail">
      <div class="md-detail-title">
        Call records for <strong>{props.row.name}</strong>
        <span class="md-detail-count">{props.row.callRecords.length} calls</span>
      </div>
      <div class="md-detail-grid">
        <SvGrid responsive={true}
          data={props.row.callRecords}
          columns={detailColumns}
          features={detailFeatures}
          selectionMode="none"
          rowHeight={34}
          containerHeight="100%"
          fitColumns={true}
          virtualization={false}
        />
      </div>
    </div>
  {/if}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="md-toolbar shrink-0">
    <div class="md-info">
      Click a <strong>chevron</strong> to expand an account into a nested grid of its
      call records - a real full-width detail row hosting another <code>&lt;SvGrid&gt;</code>.
    </div>
    <div class="md-actions">
      <button class="md-btn" onclick={expandAll}>Expand all</button>
      <button class="md-btn alt" onclick={collapseAll}>Collapse all</button>
      <span class="md-count">{expanded.size} of {accounts.length} open</span>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={visible}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="none"
      rowHeight={44}
      containerHeight="100%"
      fitColumns={true}
      virtualization={false}
      isDetailRow={(row) => row.kind === 'detail'}
      renderDetailRow={DetailGrid}
    />
  </div>
</section>

<style>
  .md-toolbar {
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 10px 14px;
  }
  .md-info { flex: 1; min-width: 280px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .md-info strong { color: var(--sg-accent, #6366f1); }
  .md-actions { display: flex; align-items: center; gap: 8px; }
  .md-btn {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); border: 0;
    border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .md-btn.alt { background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); border: 1px solid var(--sg-border, #cbd5e1); }
  .md-btn:hover { filter: brightness(1.07); }
  .md-count { font-size: 11px; color: var(--sg-muted, #64748b); }

  :global(.md-chev) {
    width: 24px; height: 24px; background: transparent; border: 0; cursor: pointer;
    color: var(--sg-muted, #64748b); border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  :global(.md-chev:hover) { background: color-mix(in oklab, var(--sg-accent, #6366f1) 12%, transparent); color: var(--sg-accent, #6366f1); }
  :global(.md-chev svg) { transition: transform 140ms; }
  :global(.md-chev svg.is-open) { transform: rotate(90deg); }

  /* Detail row: a nested grid on an inset, accent-bordered panel. */
  :global(.md-detail) {
    border-left: 3px solid var(--sg-accent, #6366f1);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, var(--sg-bg, #fff));
    padding: 12px 16px; width: 100%; box-sizing: border-box;
  }
  :global(.md-detail-title) {
    font-size: 12px; color: var(--sg-muted, #64748b); margin-bottom: 8px;
    display: flex; align-items: center; gap: 10px;
  }
  :global(.md-detail-title strong) { color: var(--sg-fg, #0f172a); }
  :global(.md-detail-count) {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 14%, transparent); color: var(--sg-accent, #6366f1);
    padding: 1px 7px; border-radius: 999px;
  }
  :global(.md-detail-grid) {
    height: 200px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px; overflow: hidden;
    background: var(--sg-bg, #fff);
  }
</style>
