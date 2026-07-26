<script lang="ts">
  /**
   * 356. Spreadsheet chart (edit cells, customize the chart like Excel)
   * ------------------------------------------------------------------
   * A small editable sales sheet with the built-in chart drawer open beside it.
   * Type a new number into any Units / Revenue cell and the chart redraws on the
   * spot - exactly like an Excel chart bound to a table. The chart panel is the
   * "Chart Design" surface: switch the chart Type (column / bar / line / area /
   * pie), change what is on the axis (Group by / Split by / Value), aggregate,
   * stack the series, or turn on data labels - all live, no code.
   */
  import { SvGrid, tableFeatures, type ColumnDef } from '@svgrid/grid'

  type Row = { month: string; channel: string; units: number; revenue: number }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  const CHANNELS = ['Online', 'Retail', 'Wholesale']
  // Seed a plausible ramp so the starting chart already looks like a real report.
  const base: Record<string, number> = { Online: 42000, Retail: 31000, Wholesale: 58000 }
  const seed: Row[] = []
  MONTHS.forEach((month, m) => {
    CHANNELS.forEach((channel) => {
      const revenue = Math.round((base[channel]! * (1 + m * 0.12)) / 500) * 500
      seed.push({ month, channel, units: Math.round(revenue / 120), revenue })
    })
  })

  let rows = $state<Row[]>(seed)
  const features = tableFeatures({})

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'month', header: 'Month', width: 110 },
    { field: 'channel', header: 'Channel', width: 130 },
    {
      field: 'units',
      header: 'Units',
      width: 120,
      align: 'right',
      cellDataType: 'number',
      editorType: 'number',
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
    {
      field: 'revenue',
      header: 'Revenue',
      width: 150,
      align: 'right',
      cellDataType: 'number',
      editorType: 'number',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  function onCellValueChange(e: { rowIndex: number; columnId: string; newValue: unknown }) {
    if (e.columnId !== 'units' && e.columnId !== 'revenue') return
    const n = Number(e.newValue)
    if (!Number.isFinite(n)) return
    const next = rows.slice()
    next[e.rowIndex] = { ...next[e.rowIndex]!, [e.columnId]: n }
    rows = next
  }
</script>

<div class="demo-page" style="height: 620px; display: flex; flex-direction: column;">
  <p class="demo-lede">
    An editable sales sheet with a live chart - like inserting a chart in Excel. Edit any
    <strong>Units</strong> or <strong>Revenue</strong> cell and the chart redraws. Use the
    <strong>Chart</strong> panel to customize it: change the <strong>Type</strong>, swap
    <strong>Group by</strong> / <strong>Split by</strong> / <strong>Value</strong>, aggregate,
    <strong>Stack</strong>, or add <strong>Labels</strong>.
  </p>
  <div style="flex: 1; min-height: 0;">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      selectionMode="cell"
      enableInlineEditing={true}
      enableCellSelection={true}
      containerHeight="100%"
      contextMenu={['copy', 'cut', 'paste', 'clear']}
      onCellValueChange={onCellValueChange}
      charting={{
        defaultOpen: true,
        width: 500,
        dimension: 'month',
        series: 'channel',
        measures: 'revenue',
        defaultType: 'bar',
        stacked: false,
      }}
    />
  </div>
</div>
