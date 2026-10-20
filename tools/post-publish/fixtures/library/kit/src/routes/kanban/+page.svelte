<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { enableBoardView } from '@svgrid/enterprise'

  enableBoardView()

  type Task = { id: number; title: string; status: string; points: number }
  let rows = $state<Task[]>([
    { id: 1, title: 'Design the board', status: 'backlog', points: 3 },
    { id: 2, title: 'Lane drag and drop', status: 'doing', points: 5 },
    { id: 3, title: 'Card template', status: 'doing', points: 2 },
    { id: 4, title: 'Ship it', status: 'done', points: 8 },
  ])
  const columns: GridColumns<Task> = [
    { field: 'title', header: 'Task', width: 240 },
    { field: 'status', header: 'Status', width: 120 },
    { field: 'points', header: 'Points', width: 90 },
  ]
  const lanes = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'doing', title: 'Doing' },
    { id: 'done', title: 'Done' },
  ]
</script>

<h1>kanban</h1>
<SvGrid data={rows} {columns} getRowId={(r) => String(r.id)} containerHeight={420} board={{ groupBy: 'status', lanes }} />
