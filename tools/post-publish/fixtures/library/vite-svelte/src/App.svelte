<script>
  import { SvGrid } from '@svgrid/grid'
  import { installEnterprise } from '@svgrid/enterprise'

  const rows = [
    { id: 1, name: 'Ada Lovelace', dept: 'Engineering' },
    { id: 2, name: 'Grace Hopper', dept: 'Engineering' },
    { id: 3, name: 'Barbara Liskov', dept: 'Platform' },
  ]
  const columns = [
    { field: 'name', header: 'Name', width: 200 },
    { field: 'dept', header: 'Department', width: 160 },
  ]

  // installEnterprise at runtime, then each format kept in memory for the check.
  // jszip and pdfmake are whatever the check installed. `window.__check` fills
  // in as each format settles, so a hang shows which one; `done` marks the end.
  async function onReady(api) {
    const pro = installEnterprise(api)
    const out = { started: [] }
    window.__check = out
    for (const format of ['csv', 'xlsx', 'pdf']) {
      out.started.push(format)
      try {
        const res = await pro.exportData({ format, download: false })
        const head = new Uint8Array(await res.blob.slice(0, 8).arrayBuffer())
        out[format] = { size: res.blob.size, magic: String.fromCharCode(...head), text: format === 'csv' ? await res.blob.text() : undefined }
      } catch (e) {
        out[format] = { error: String(e?.message ?? e) }
      }
    }
    out.done = true
  }
</script>

<h1>vite + svelte</h1>
<SvGrid data={rows} {columns} sortable onApiReady={onReady} containerHeight={240} />
