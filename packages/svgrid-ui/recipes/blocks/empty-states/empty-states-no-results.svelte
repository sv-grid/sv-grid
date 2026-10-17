<script lang="ts" module>
  /**
   * No search results block - a customer directory whose search and filters
   * match nothing. SvTextInput (search) and removable SvChip filters sit above
   * the results; SvEmptyState echoes the query and offers fixes: drop one
   * filter, clear the search, or "Clear filters" to bring results back.
   * SvButton, SvBadge, SvToaster. Pure UI-kit, --sg-* themed.
   *
   * Headless: createCustomerSearch() below owns the query, the active filters
   * and the matching rows with no markup. The component under it is one
   * styled render of that core; import createCustomerSearch from this file
   * (or `npx @svgrid/ui add empty-states-no-results --headless` for the core
   * alone) to draw your own.
   */
  export type Customer = { name: string; plan: string; region: string; status: string; mrr: number }
  const FILTER_KEYS = ['plan', 'region', 'status'] as const
  export type CustomerFilterKey = (typeof FILTER_KEYS)[number]
  export type CustomerFilter = { key: CustomerFilterKey; label: string; value: string }
  export type CustomerSearchOptions = {
    /** Rows to search; a sample CRM list by default. */
    customers?: Customer[]
    /** Starting query and filters; the defaults match nothing on purpose. */
    query?: string
    filters?: CustomerFilter[]
    onClearFilters?: () => void
  }

  const SAMPLE_CUSTOMERS: Customer[] = [
    { name: 'Acme Analytics', plan: 'Growth', region: 'EMEA', status: 'Active', mrr: 2400 },
    { name: 'Acme Freight', plan: 'Starter', region: 'North America', status: 'Active', mrr: 390 },
    { name: 'Lumen Health', plan: 'Enterprise', region: 'APAC', status: 'Active', mrr: 9800 },
    { name: 'Northwind Traders', plan: 'Enterprise', region: 'North America', status: 'Active', mrr: 12500 },
    { name: 'Fieldline Logistics', plan: 'Growth', region: 'APAC', status: 'Churned', mrr: 0 },
    { name: 'Harbor & Pine', plan: 'Starter', region: 'EMEA', status: 'Trial', mrr: 0 },
  ]
  const SAMPLE_FILTERS: CustomerFilter[] = [
    { key: 'plan', label: 'Plan', value: 'Enterprise' },
    { key: 'region', label: 'Region', value: 'APAC' },
    { key: 'status', label: 'Status', value: 'Active' },
  ]

  export function createCustomerSearch(opts: CustomerSearchOptions = {}) {
    // Name search is a case-insensitive substring; every filter must match exactly.
    const customers = opts.customers ?? SAMPLE_CUSTOMERS
    let query = $state(opts.query ?? 'acme')
    let filters = $state<CustomerFilter[]>([...(opts.filters ?? SAMPLE_FILTERS)])

    const term = $derived(query.trim())
    const results = $derived(
      customers.filter((c) =>
        c.name.toLowerCase().includes(term.toLowerCase()) &&
        filters.every((f) => c[f.key] === f.value)),
    )

    return {
      customers,
      get query() { return query },
      set query(v: string) { query = v },
      /** The query without surrounding spaces. */
      get term() { return term },
      get filters() { return filters },
      get results() { return results },
      removeFilter: (key: CustomerFilterKey) => { filters = filters.filter((x) => x.key !== key) },
      clearFilters: () => { filters = []; opts.onClearFilters?.() },
      clearSearch: () => { query = '' },
      /** Monthly revenue as $1,234/mo, or a dash for none. */
      money: (n: number) => (n ? `$${n.toLocaleString('en-US')}/mo` : '-'),
    }
  }
</script>

<script lang="ts">
  import { SvTextInput, SvChip, SvEmptyState, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  const search = createCustomerSearch({ onClearFilters: () => toast('Filters cleared') })
</script>

<section class="sv-noresults" aria-labelledby="sv-noresults-title">
  <header>
    <h2 id="sv-noresults-title">Customers</h2>
    <p class="sv-noresults-muted">Acme Analytics CRM - {search.customers.length} accounts</p>
  </header>

  <div class="sv-noresults-controls">
    <SvTextInput type="search" label="Search customers" placeholder="Company name" bind:value={search.query} clearable block />
    <div class="sv-noresults-chips" role="group" aria-label="Active filters">
      {#each search.filters as f (f.key)}
        <SvChip removable onRemove={() => search.removeFilter(f.key)}>{f.label}: {f.value}</SvChip>
      {/each}
      {#if search.filters.length}
        <button type="button" class="sv-noresults-link" onclick={search.clearFilters}>Clear all</button>
      {:else}
        <span class="sv-noresults-muted sv-noresults-small">No filters applied</span>
      {/if}
    </div>
  </div>

  <div class="sv-noresults-results" class:sv-noresults-has-results={search.results.length > 0} aria-live="polite">
    {#if search.results.length === 0}
      <SvEmptyState
        title={search.term ? `No customers match "${search.term}"` : 'No customers match these filters'}
        description={search.filters.length ? `Nothing fits the search together with ${search.filters.length} active ${search.filters.length === 1 ? 'filter' : 'filters'}.` : 'Check the spelling or try part of the company name.'}
      >
        {#snippet icon()}
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8.5 11h5" />
          </svg>
        {/snippet}
        <div class="sv-noresults-fixes">
          {#if search.filters.length}
            <SvButton onclick={search.clearFilters}>Clear filters</SvButton>
          {/if}
          {#if search.term}
            <SvButton variant="secondary" onclick={search.clearSearch}>Clear search</SvButton>
          {/if}
        </div>
      </SvEmptyState>
      {#if search.filters.length > 1}
        <p class="sv-noresults-tip">Or remove one filter:
          {#each search.filters as f (f.key)}
            <button type="button" class="sv-noresults-link" onclick={() => search.removeFilter(f.key)}>{f.label}: {f.value}</button>
          {/each}
        </p>
      {/if}
    {:else}
      <p class="sv-noresults-count">{search.results.length} {search.results.length === 1 ? 'result' : 'results'}</p>
      <ul class="sv-noresults-list">
        {#each search.results as c (c.name)}
          <li>
            <span class="sv-noresults-avatar" aria-hidden="true">{c.name.slice(0, 1)}</span>
            <div class="sv-noresults-meta">
              <strong>{c.name}</strong>
              <span class="sv-noresults-muted">{c.plan} - {c.region}</span>
            </div>
            <SvBadge size="sm" variant={c.status === 'Active' ? 'success' : c.status === 'Trial' ? 'info' : 'neutral'}>{c.status}</SvBadge>
            <span class="sv-noresults-mrr">{search.money(c.mrr)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-noresults {
    min-height: 500px; padding: 28px; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 16px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font-family: var(--sg-font, inherit);
  }
  h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.01em; }
  .sv-noresults-muted { margin: 2px 0 0; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-noresults-small { margin: 0; font-size: 12.5px; }
  .sv-noresults-controls { display: flex; flex-direction: column; gap: 10px; max-width: 640px; }
  /* type="search" adds the browser's own clear button next to SvTextInput's. */
  .sv-noresults-controls :global(input[type='search']::-webkit-search-cancel-button) { appearance: none; display: none; }
  .sv-noresults-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 26px; }
  .sv-noresults-link {
    background: none; border: 0; padding: 0 2px; font: inherit; font-size: 12.5px; cursor: pointer;
    color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px;
  }
  .sv-noresults-link:hover { color: var(--sg-accent, #4f46e5); }
  .sv-noresults-results {
    flex: 1; display: flex; flex-direction: column;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-noresults-results.sv-noresults-has-results { flex: none; }
  .sv-noresults-results :global(.sv-empty) { flex: 1; justify-content: center; }
  .sv-noresults-fixes { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .sv-noresults-tip { margin: 0; padding: 0 16px 22px; text-align: center; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-noresults-tip .sv-noresults-link { margin-left: 6px; }
  .sv-noresults-count { margin: 0; padding: 10px 16px; font-size: 12.5px; color: var(--sg-muted, #64748b); border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-noresults-list { list-style: none; margin: 0; padding: 0; }
  .sv-noresults-list li { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-noresults-list li:last-child { border-bottom: 0; }
  .sv-noresults-avatar {
    flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
    font-size: 13px; font-weight: 700; background: var(--sg-bg-subtle, #f1f5f9); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-noresults-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sv-noresults-meta strong { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-noresults-meta .sv-noresults-muted { margin: 0; font-size: 12.5px; }
  .sv-noresults-mrr { width: 92px; text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; }

  @media (max-width: 560px) {
    .sv-noresults { padding: 18px 16px; }
    .sv-noresults-list li { padding: 10px 12px; gap: 10px; }
    .sv-noresults-mrr { display: none; }
    /* Text links are thumb targets on a phone. */
    .sv-noresults-link { min-height: 40px; }
  }
</style>
