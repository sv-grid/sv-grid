<script lang="ts">
  /**
   * 56. Export - theme-matched styles (Pro)
   * --------------------------------------
   * Click any export button - the resulting file's header row, body rows,
   * and zebra stripes match whichever theme the grid is showing (light or
   * dark). The styles come from the live `--sg-*` CSS tokens the grid
   * already renders with, so a re-theme of the page re-themes the export.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
    type ExportStyles,
    type ExportFormat,
  } from '@svgrid/enterprise'
  import { makeOrders, type Order } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const rows = makeOrders(80)
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let busy = $state<ExportFormat | null>(null)
  let lastExport = $state<string | null>(null)

  function readToken(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }
  function currentTheme(): 'light' | 'dark' {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  }

  function themeStyles(): ExportStyles {
    const fg       = readToken('--sg-fg',         '#0f172a')
    const bg       = readToken('--sg-bg',         '#ffffff')
    const headerBg = readToken('--sg-header-bg',  '#f1f5f9')
    const headerFg = readToken('--sg-header-fg',  '#0f172a')
    const rowAltBg = readToken('--sg-row-alt-bg', '#f8fafc')
    const border   = readToken('--sg-border',     '#e2e8f0')
    return {
      headerRow: {
        color: headerFg, backgroundColor: headerBg,
        fontWeight: 'bold', border: `1px solid ${border}`, textAlign: 'left',
      },
      rows: {
        color: fg, backgroundColor: bg, border: `1px solid ${border}`,
      },
      rowAlternate: { backgroundColor: rowAltBg },
    }
  }

  async function doExport(format: ExportFormat) {
    if (!api) return
    busy = format
    lastExport = null
    try {
      await api.exportData({
        format,
        filename: `orders-${currentTheme()}`,
        styles: themeStyles(),
      })
      lastExport = `${format.toUpperCase()} - ${currentTheme()} theme`
    } catch (err) {
      console.error('[export]', err)
    } finally {
      busy = null
    }
  }

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company', header: 'Company', editorType: 'text', width: 160 },
    { field: 'orderId', header: 'Order ID', editorType: 'text', width: 140 },
    { field: 'product', header: 'Product', editorType: 'text', width: 180 },
    {
      field: 'sellDate', header: 'Sell date', editorType: 'date', width: 120,
      format: { type: 'date', pattern: 'y-m-d' },
    },
    { field: 'quantity', header: 'Qty', editorType: 'number', width: 80 },
    {
      field: 'price', header: 'Price', editorType: 'number', width: 110,
      format: { type: 'currency', currency: 'USD' },
    },
    { field: 'country', header: 'Country', editorType: 'text', width: 110 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Export with current theme:</span>
    {#each ['xlsx', 'pdf', 'html'] as fmt (fmt)}
      <button
        type="button"
        onclick={() => doExport(fmt as ExportFormat)}
        disabled={busy !== null}
        class="rounded-md border px-3 py-1.5 disabled:opacity-50 ex-btn"
      >
        {busy === fmt ? 'Exporting…' : fmt.toUpperCase()}
      </button>
    {/each}
    {#if lastExport}
      <span class="text-xs text-emerald-600 dark:text-emerald-400">✓ {lastExport}</span>
    {/if}
    <span class="ml-auto ex-hint">
      Flip the gallery theme (sidebar sun/moon) then re-export to compare.
    </span>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showRowNumbers={true}
      showPagination={true}
      pageSize={25}
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = installEnterprise(next))}
    />
  </div>
</section>

<style>
  /* Toolbar chrome follows the same --sg-* tokens the export reads. */
  .ex-btn {
    border-color: var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #0f172a);
  }
  .ex-btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f8fafc); }
  .ex-hint { color: var(--sg-muted, #64748b); }
</style>
