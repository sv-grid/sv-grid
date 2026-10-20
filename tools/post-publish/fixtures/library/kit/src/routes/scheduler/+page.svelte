<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { enableSchedulerView } from '@svgrid/enterprise'

  enableSchedulerView()

  // Every event is in January; the calendar opens on a week in March, so the
  // Week view has no event in range. It must still draw its seven day columns.
  type Meeting = { id: number; title: string; start: string; end: string }
  const rows: Meeting[] = [
    { id: 1, title: 'Planning', start: '2026-01-05T09:00', end: '2026-01-05T10:00' },
    { id: 2, title: 'Review', start: '2026-01-07T14:00', end: '2026-01-07T15:00' },
  ]
  const columns: GridColumns<Meeting> = [
    { field: 'title', header: 'Title', width: 200 },
    { field: 'start', header: 'Start', width: 160 },
    { field: 'end', header: 'End', width: 160 },
  ]
</script>

<h1>scheduler</h1>
<SvGrid
  data={rows}
  {columns}
  getRowId={(r) => String(r.id)}
  containerHeight={560}
  scheduler={{ startField: 'start', endField: 'end', titleField: 'title', initialView: 'week', initialDate: '2026-03-11', weekStartsOn: 1 }}
/>
