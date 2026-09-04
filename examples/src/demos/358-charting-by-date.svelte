<script lang="ts">
  /**
   * 358. Charting by date (time axis + log scale)
   * ---------------------------------------------
   * A daily signups sheet with a real date column. Because the group-by column
   * is a date, the chart panel offers a **Date axis** toggle (space points by
   * actual time, real date ticks) on top of the usual pickers - and a **Log
   * scale** toggle for the wide-range value axis. Both are one-click, live, and
   * persist in saved views. Filter or sort the grid and the line re-plots.
   */
  import { SvGrid, tableFeatures, type ColumnDef } from '@svgrid/grid'

  type Row = { date: string; channel: string; device: string; signups: number; revenue: number }

  // 45 days x 3 channels x 2 devices, with a growth trend + weekly wobble + a spike.
  const CHANNELS = ['Organic', 'Paid', 'Referral']
  const DEVICES = ['Desktop', 'Mobile']
  const base: Record<string, number> = { Organic: 120, Paid: 80, Referral: 40 }
  const rows0: Row[] = []
  for (let d = 0; d < 45; d++) {
    const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10)
    const weekend = (d % 7 === 5 || d % 7 === 6) ? 0.7 : 1
    const spike = d === 30 ? 4 : 1 // launch-day spike -> log scale earns its keep
    for (const channel of CHANNELS) {
      for (const device of DEVICES) {
        const trend = 1 + d * 0.05
        const signups = Math.round(base[channel]! * trend * weekend * spike * (device === 'Mobile' ? 0.6 : 1))
        rows0.push({ date, channel, device, signups, revenue: signups * 12 })
      }
    }
  }

  let rows = $state<Row[]>(rows0)
  const features = tableFeatures({})

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'date', header: 'Date', width: 120, cellDataType: 'date' },
    { field: 'channel', header: 'Channel', width: 120 },
    { field: 'device', header: 'Device', width: 110 },
    { field: 'signups', header: 'Signups', width: 110, align: 'right', cellDataType: 'number', format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'revenue', header: 'Revenue', width: 130, align: 'right', cellDataType: 'number', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]
</script>

<div class="demo-page" style="height: 620px; display: flex; flex-direction: column;">
  <p class="demo-lede">
    A daily signups sheet charted <strong>by date</strong>. The group-by column is a real date, so the
    <strong>Chart</strong> panel adds a <strong>Date axis</strong> toggle (proportional time gaps + date ticks)
    next to <strong>Log scale</strong>. Toggle either live, change the pickers, or filter the grid.
  </p>
  <div style="flex: 1; min-height: 0;">
    <SvGrid
      columnResize
      data={rows}
      columns={columns}
      features={features}
      selectionMode="cell"
      containerHeight="100%"
      charting={{
        defaultOpen: true,
        width: 520,
        defaultType: 'line',
        dimension: 'date',
        series: 'channel',
        measures: 'signups',
        timeAxis: true,
      }}
    />
  </div>
</div>
