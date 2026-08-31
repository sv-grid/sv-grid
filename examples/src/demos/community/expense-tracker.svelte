<!--
  title: Expense tracker
  author: SvGrid team
  github: sv-grid
  tags: grouping, aggregation, formatting
  discussion: 0
-->
<script lang="ts">
  /**
   * A monthly expense list grouped by category, with a summed total in every
   * group header via the declarative `aggregate` column option. Categories show
   * as coloured chips. Self-contained - inline data, only @svgrid/grid.
   */
  import {
    SvGrid,
    renderSnippet,
    tableFeatures,
    columnGroupingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Expense = { id: number; date: string; merchant: string; category: string; amount: number }

  const features = tableFeatures({ columnGroupingFeature })

  const rows: Expense[] = [
    { id: 1,  date: '2026-06-02', merchant: 'Whole Foods',   category: 'Groceries',      amount: 84.2 },
    { id: 2,  date: '2026-06-03', merchant: 'Shell',         category: 'Transport',      amount: 52.0 },
    { id: 3,  date: '2026-06-05', merchant: 'Netflix',       category: 'Subscriptions',  amount: 15.49 },
    { id: 4,  date: '2026-06-07', merchant: 'Trader Joe’s',  category: 'Groceries',      amount: 63.75 },
    { id: 5,  date: '2026-06-09', merchant: 'Uber',          category: 'Transport',      amount: 18.4 },
    { id: 6,  date: '2026-06-11', merchant: 'Spotify',       category: 'Subscriptions',  amount: 11.99 },
    { id: 7,  date: '2026-06-12', merchant: 'Chipotle',      category: 'Dining',         amount: 13.25 },
    { id: 8,  date: '2026-06-15', merchant: 'Costco',        category: 'Groceries',      amount: 142.6 },
    { id: 9,  date: '2026-06-18', merchant: 'Delta',         category: 'Transport',      amount: 289.0 },
    { id: 10, date: '2026-06-20', merchant: 'The Italian',   category: 'Dining',         amount: 71.5 },
    { id: 11, date: '2026-06-22', merchant: 'iCloud',        category: 'Subscriptions',  amount: 2.99 },
    { id: 12, date: '2026-06-25', merchant: 'Blue Bottle',   category: 'Dining',         amount: 6.75 },
  ]

  const TONE: Record<string, string> = {
    Groceries: 'chip-green',
    Transport: 'chip-blue',
    Subscriptions: 'chip-violet',
    Dining: 'chip-amber',
  }

  const columns: ColumnDef<typeof features, Expense>[] = [
    { field: 'category', header: 'Category', width: 160, cell: (ctx) => renderSnippet(Chip, { v: String(ctx.getValue()) }) },
    { field: 'merchant', header: 'Merchant', width: 160 },
    { field: 'date', header: 'Date', width: 120, format: { type: 'date', pattern: 'y-m-d' } },
    {
      field: 'amount',
      header: 'Amount',
      width: 130,
      align: 'right',
      aggregate: 'sum',
      format: { type: 'currency', currency: 'USD' },
    },
  ]

  let api = $state<SvGridApi<typeof features, Expense> | null>(null)
</script>

{#snippet Chip(p: { v: string })}
  <span class="chip {TONE[p.v] ?? 'chip-slate'}">{p.v}</span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">
    Grouped by category - each group header sums its amounts. A community-contributed demo.
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      groupable
      selectionMode="none"
      showRowNumbers={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(a) => { api = a; queueMicrotask(() => a.setGroupBy(['category'])) }}
    />
  </div>
</section>

<style>
  .chip { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .chip-green  { background: #dcfce7; color: #166534; }
  .chip-blue   { background: #dbeafe; color: #1e40af; }
  .chip-violet { background: #ede9fe; color: #5b21b6; }
  .chip-amber  { background: #fef3c7; color: #92400e; }
  .chip-slate  { background: #e2e8f0; color: #334155; }
</style>
