<!-- Documented in: docs/help/filtering/filter-conditions.md -->
<script lang="ts">
  /**
   * 178. Multi-condition filter (AND / OR within one column)
   * --------------------------------------------------------
   * A single column can hold TWO conditions joined by AND or OR - a numeric
   * band ("> 80k AND < 150k"), an either/or text match, an outlier filter
   * ("< 25 OR > 60"). Open a column's funnel menu and click "+ Add condition",
   * or drive it from the API with `setFilter(col, { operator, value,
   * operator2, value2, join })`. The preset buttons below do exactly that.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let rows = $state<Person[]>(makePeople(120))
  let api = $state<SvGridApi<typeof features, Person> | null>(null)
  let activePreset = $state<string>('band')

  const columns: ColumnDef<typeof features, Person>[] = [
    { field: 'firstName', header: 'First name', width: 130 },
    { field: 'lastName', header: 'Last name', width: 130 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'age', header: 'Age', editorType: 'number', width: 100, align: 'right' },
    { field: 'salary', header: 'Salary', editorType: 'number', width: 150, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  function salaryBand() {
    activePreset = 'band'
    api?.clearAllFilters()
    // salary > 80,000 AND salary < 150,000  (a band)
    api?.setFilter('salary', {
      operator: 'greaterThan', value: '80000',
      operator2: 'lessThan', value2: '150000', join: 'AND',
    })
  }
  function ageOutliers() {
    activePreset = 'outliers'
    api?.clearAllFilters()
    // age < 25 OR age > 60  (the two tails)
    api?.setFilter('age', {
      operator: 'lessThan', value: '25',
      operator2: 'greaterThan', value2: '60', join: 'OR',
    })
  }
  function clearAll() {
    activePreset = 'none'
    api?.clearAllFilters()
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 shrink-0">
    <button type="button" class="mc-btn" class:is-on={activePreset === 'band'} onclick={salaryBand}>
      Salary 80k &lt; x &lt; 150k <span class="mc-join">AND</span>
    </button>
    <button type="button" class="mc-btn" class:is-on={activePreset === 'outliers'} onclick={ageOutliers}>
      Age &lt; 25 or &gt; 60 <span class="mc-join mc-or">OR</span>
    </button>
    <button type="button" class="mc-btn" class:is-on={activePreset === 'none'} onclick={clearAll}>Clear</button>
    <span class="text-xs" style="color: var(--sg-muted);">
      …or open any column's <strong>funnel menu</strong> and click <em>+ Add condition</em>.
    </span>
  </div>

  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    Two conditions per column, joined by <code>AND</code> / <code>OR</code>.
    Set via <code>api.setFilter(col, {'{'} operator, value, operator2, value2, join {'}'})</code>
    or the column menu.
  </p>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      showColumnFilters={true}
      showRowNumbers={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => { api = next; salaryBand() }}
    />
  </div>
</section>

<style>
  .mc-btn {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 6px 12px; border-radius: 7px;
    font-size: 12.5px; font-weight: 600;
    color: var(--sg-fg); background: var(--sg-header-bg);
    border: 1px solid var(--sg-border); cursor: pointer;
    transition: border-color 120ms ease, background-color 120ms ease;
  }
  .mc-btn:hover { border-color: var(--sg-accent, #3b82f6); }
  .mc-btn.is-on { border-color: var(--sg-accent, #3b82f6); background: color-mix(in oklab, var(--sg-accent, #3b82f6) 12%, transparent); }
  .mc-join { font-size: 9px; font-weight: 800; letter-spacing: 0.05em; color: #fff; background: var(--sg-accent, #3b82f6); border-radius: 4px; padding: 1px 5px; }
  .mc-or { background: #8b5cf6; }
</style>
