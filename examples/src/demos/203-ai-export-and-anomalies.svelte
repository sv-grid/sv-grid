<script lang="ts">
  /**
   * 203. AI export + anomaly detection (Enterprise)
   * -----------------------------------------------
   * Natural-language export - type "export orders over $300 as a grouped PDF by
   * country" and the AI provider turns it into a { format, filters, groupBy }
   * plan that's applied to the grid and downloaded. Plus a one-click anomaly
   * scan over the current view. Wired to the bundled `mockAIProvider` so it
   * runs with no API key; swap in `setAIProvider(yourAdapter)` for a real model.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
    setAIProvider,
    mockAIProvider,
    aiExport,
    aiFindAnomalies,
    type ColumnDef,
    type SvGridApi,
    type AIExportPlan,
    type AIAnomaly,
  } from '@svgrid/grid'
  // Enterprise only supplies the EXPORT ENGINE here (xlsx / pdf). The AI itself
  // is built-in + free above; installEnterprise registers the export engine so
  // the AI's planned export can actually write the file.
  import {
    installEnterprise,
    setLicenseKey,
    dismissUnlicensedNudge,
    type EnterpriseGridApi,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  dismissUnlicensedNudge()
  setAIProvider(mockAIProvider) // deterministic canned model for the demo

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnGroupingFeature,
    rowExpandingFeature,
  })

  let rows = $state<Order[]>(makeOrders(200))
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let query = $state('export orders over $300 as a grouped PDF by country')
  let busy = $state(false)
  let plan = $state<AIExportPlan | null>(null)
  let anomalies = $state<AIAnomaly[]>([])
  let anomalySummary = $state('')
  let scanned = $state(false)
  let errorMsg = $state<string | null>(null)

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'country', header: 'Country', width: 110 },
    { field: 'company', header: 'Company', width: 150 },
    { field: 'product', header: 'Product', width: 160 },
    { field: 'quantity', header: 'Qty', width: 80, align: 'right', cellDataType: 'number',
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'price', header: 'Price', width: 110, align: 'right', cellDataType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]

  function onReady(next: SvGridApi<typeof features, Order>) {
    api = installEnterprise(next)
  }

  async function runExport() {
    if (!api || busy) return
    busy = true
    errorMsg = null
    plan = null
    try {
      plan = await aiExport(api, query, { filename: 'ai-export' })
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }

  async function findAnomalies() {
    if (!api || busy) return
    busy = true
    errorMsg = null
    anomalies = []
    anomalySummary = ''
    scanned = false
    try {
      const res = await aiFindAnomalies(api, { target: { kind: 'all' } })
      anomalies = res.anomalies
      anomalySummary = res.summary
      scanned = true
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
    } finally {
      busy = false
    }
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="ai-muted text-sm shrink-0">
    Describe an export in plain English - the AI turns it into a filter + group +
    format plan and downloads the file (the grid stays as-is). Or scan the view
    for anomalies. Running on the bundled mock model (no API key).
  </div>

  <div class="flex flex-wrap items-center gap-2 shrink-0">
    <input
      bind:value={query}
      placeholder="e.g. export orders over $300 as a grouped PDF by country"
      class="ai-input flex-1 min-w-[280px] rounded border px-3 py-1.5 text-sm"
      onkeydown={(e) => e.key === 'Enter' && runExport()}
    />
    <button class="btn btn-primary" disabled={!api || busy} onclick={runExport}>
      {busy ? 'Thinking…' : 'AI export'}
    </button>
    <button class="btn" disabled={!api || busy} onclick={findAnomalies}>Find anomalies</button>
  </div>

  {#if errorMsg}
    <p class="text-xs text-red-600 dark:text-red-400 shrink-0">{errorMsg}</p>
  {/if}

  {#if plan}
    <div class="ai-card shrink-0">
      <strong>Plan:</strong> format <code>{plan.format}</code>
      {#if plan.groupBy.length}· group by <code>{plan.groupBy.join(', ')}</code>{/if}
      {#if plan.filters.length}· {plan.filters.length} filter(s){/if}
      <div class="ai-muted mt-1">{plan.rationale}</div>
    </div>
  {/if}

  {#if scanned}
    <div class="ai-card shrink-0">
      <strong>Anomalies:</strong>
      {anomalySummary || (anomalies.length ? `${anomalies.length} found` : 'No anomalies found in the sample.')}
      {#if anomalies.length}
        <ul class="mt-1 list-disc pl-5">
          {#each anomalies as a, i (i)}
            <li>
              <span class="sev sev-{a.severity}">{a.severity}</span>
              <code>{a.field}</code>{#if a.value != null} = {a.value}{/if} — {a.reason}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      showGroupingControls={true}
      showPagination={false}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={onReady}
    />
  </div>

  <footer class="ai-muted text-xs shrink-0">
    Built-in + free. <code>aiExport(api, ...)</code> and
    <code>aiFindAnomalies(api, ...)</code> route through your registered
    <code>AIProvider</code> - the grid bundles no model client. This demo uses
    <code>mockAIProvider</code>; the plans are heuristic, not a real model.
    Writing the xlsx / PDF uses the @svgrid/enterprise export engine.
  </footer>
</section>

<style>
  .ai-muted { color: var(--sg-muted, rgb(100 116 139)); }
  .ai-input {
    border-color: var(--sg-input-border, var(--sg-border, rgb(203 213 225)));
    background: var(--sg-input-bg, var(--sg-bg, #fff));
    color: var(--sg-fg, rgb(15 23 42));
  }
  .btn {
    border-radius: 0.375rem;
    border: 1px solid var(--sg-border, rgb(203 213 225));
    padding: 0.375rem 0.85rem;
    font-size: 0.85rem;
    font-weight: 500;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, rgb(15 23 42));
    cursor: pointer;
  }
  .btn:disabled { opacity: 0.5; }
  .btn-primary {
    border-color: var(--sg-accent, rgb(79 70 229));
    background: var(--sg-accent, rgb(79 70 229));
    color: var(--sg-on-accent, #fff);
  }
  .ai-card {
    border: 1px solid var(--sg-border, rgb(203 213 225));
    background: var(--sg-header-bg, rgb(248 250 252));
    border-radius: 0.5rem;
    padding: 0.6rem 0.8rem;
    font-size: 0.8rem;
  }
  .sev { font-size: 0.65rem; text-transform: uppercase; font-weight: 700; padding: 1px 6px; border-radius: 999px; margin-right: 4px; }
  .sev-high { background: #fee2e2; color: #991b1b; }
  .sev-medium { background: #fef9c3; color: #854d0e; }
  .sev-low { background: #dcfce7; color: #166534; }
</style>
