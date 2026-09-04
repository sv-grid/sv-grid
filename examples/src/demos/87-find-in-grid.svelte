<script lang="ts">
  /**
   * 87. Find-in-grid
   * ----------------
   * Press <kbd>Ctrl/Cmd+F</kbd> anywhere on the grid to open the
   * find overlay. Type to search across every cell value; press
   * <kbd>Enter</kbd> for next match, <kbd>Shift+Enter</kbd> for
   * previous, <kbd>Esc</kbd> to close. Each match activates the
   * cell and scrolls it into view.
   *
   * The same surface is on the API for command palettes:
   *
   *   api.openFind()
   *   api.setFindQuery('error')
   *   api.getFindHits()
   *   api.closeFind()
   *
   * The grid does linear-scan matching - good enough for the typical
   * 10k row × 30 column working set. For larger views, debounce
   * setFindQuery in your own code or wire the search through a server
   * endpoint.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Log = {
    id: string
    timestamp: string
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
    service: string
    message: string
    requestId: string
  }

  let prng = 0xC0DEFEED
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }

  const SERVICES = ['auth', 'orders', 'payments', 'inventory', 'shipping', 'search', 'cache', 'workers']
  const LEVELS: Log['level'][] = ['INFO', 'INFO', 'INFO', 'INFO', 'WARN', 'WARN', 'ERROR', 'DEBUG']
  const MESSAGES = [
    'User login successful',
    'Cache hit ratio dropped below 80%',
    'Database query slow: 1247ms',
    'Payment authorisation declined',
    'Rate limit threshold reached',
    'Background job completed',
    'Connection pool exhausted',
    'Stripe webhook received',
    'Search index reindexed',
    'Worker queue empty',
    'API rate limit exceeded for client',
    'Database connection lost; retrying',
    'Search query returned 0 results',
    'Cache evicted under memory pressure',
    'Order placed successfully',
    'Inventory low for SKU A-100',
    'Payment captured: $1,499.00',
    'Shipping label generated',
    'Authentication token expired',
    'Background sync took 4.2s',
  ]

  const rows: Log[] = Array.from({ length: 240 }, (_, i) => ({
    id: `L-${(10_000 + i).toString()}`,
    timestamp: new Date(Date.now() - i * 1_800_000).toISOString().slice(0, 19).replace('T', ' '),
    level: pick(LEVELS),
    service: pick(SERVICES),
    message: pick(MESSAGES),
    requestId: `req_${Math.floor(rand() * 0xFFFFFFFF).toString(16).padStart(8, '0')}`,
  }))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Log> | null>(null)

  const columns: ColumnDef<typeof features, Log>[] = [
    { field: 'id',        header: 'ID',       editable: false, width: 90 },
    { field: 'timestamp', header: 'When',     editable: false, width: 170 },
    { field: 'level',     header: 'Level',    width: 90,
      cellClass: (ctx) => `log-${String(ctx.getValue()).toLowerCase()}` },
    { field: 'service',   header: 'Service',  width: 110 },
    { field: 'message',   header: 'Message',  width: 380 },
    { field: 'requestId', header: 'Request',  editable: false, width: 130 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      Click anywhere on the grid then press <kbd>Ctrl F</kbd> (or <kbd>⌘ F</kbd> on Mac).
      <kbd>Enter</kbd> / <kbd>Shift Enter</kbd> step through matches.
      Try <em>"error"</em>, <em>"req_"</em>, or one of the SKUs you see.
    </p>
    <button type="button" class="mock-cmd" onclick={() => api?.openFind()}>
      Or open find programmatically →
    </button>
  </div>

  <div class="flex-1 min-h-0 log-host">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={30}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .info {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0; flex: 1; min-width: 0; }
  .info kbd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              background: var(--sg-bg-subtle, var(--sg-header-bg, rgba(148,163,184,0.18)));
              padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  .mock-cmd {
    background: var(--sg-accent, #4338ca); color: var(--sg-on-accent, #fff); border: 0; border-radius: 6px;
    padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
  }

  /* Tint the level column by severity */
  :global(td.log-error) { color: #b91c1c; font-weight: 700; font-variant-numeric: tabular-nums; }
  :global(td.log-warn)  { color: #b45309; font-weight: 600; }
  :global(td.log-info)  { color: var(--sg-muted, #64748b); }
  :global(td.log-debug) { color: var(--sg-muted, #94a3b8); font-style: italic; }
</style>
