<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, type SvGridApi, type ColumnDef } from '@svgrid/grid'
  import { installEnterprise, type EnterpriseGridApi } from '@svgrid/enterprise'

  const features = tableFeatures({ rowSortingFeature })

  type Order = { company: string; product: string; price: number }
  const rows: Order[] = [
    { company: 'ACME', product: 'Widget', price: 19.95 },
    { company: 'Globex', product: 'Gadget', price: 49.0 },
    { company: 'Initech', product: 'Stapler', price: 7.5 },
  ]
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'company', header: 'Company' },
    { field: 'product', header: 'Product' },
    { field: 'price', header: 'Price', format: { type: 'currency', currency: 'USD' } },
  ]

  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
  let status = $state('idle')

  function onReady(next: SvGridApi<typeof features, Order>) {
    api = installEnterprise(next)
  }

  // Each format through the public api, kept in memory: the check reads the
  // size and the first bytes instead of a download.
  async function runExports() {
    if (!api) return
    status = 'running'
    const out: Record<string, unknown> = {}
    for (const format of ['csv', 'xlsx', 'pdf'] as const) {
      try {
        const res = await api.exportData({ format, filename: 'orders', download: false })
        if (!res) {
          out[format] = { error: 'exportData returned nothing' }
          continue
        }
        const head = new Uint8Array(await res.blob.slice(0, 8).arrayBuffer())
        out[format] = { size: res.blob.size, mime: res.mime, rowCount: res.rowCount, magic: String.fromCharCode(...head) }
      } catch (e) {
        out[format] = { error: e instanceof Error ? e.message : String(e) }
      }
    }
    window.__check = { exports: out }
    status = 'done'
  }
</script>

<h1>export</h1>
<button type="button" id="run-exports" disabled={!api} onclick={runExports}>Run exports</button>
<span id="export-status">{status}</span>
<SvGrid data={rows} {columns} {features} onApiReady={onReady} containerHeight={200} />
