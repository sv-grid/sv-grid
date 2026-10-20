<script lang="ts">
  import { SvGrid, type GridColumns, type GanttDependency } from '@svgrid/grid'
  import { enableGanttView } from '@svgrid/enterprise'

  enableGanttView()

  type Task = { id: string; name: string; start: string; end?: string; parentId?: string | null }

  // Anchored on this week so the bars sit in the opening viewport.
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7))
  const at = (offset: number) => {
    const d = new Date(base)
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const data: Task[] = [
    { id: 't1', name: 'Interviews', start: at(0), end: at(3) },
    { id: 't2', name: 'Synthesis', start: at(4), end: at(8) },
    { id: 't3', name: 'Build', start: at(9), end: at(16) },
    { id: 'm1', name: 'Launch', start: at(17) },
  ]
  const dependencies: GanttDependency[] = [
    { id: 'd1', from: 't1', to: 't2' },
    { id: 'd2', from: 't2', to: 't3' },
  ]
  const columns: GridColumns<Task> = [
    { field: 'name', header: 'Task', width: 180 },
    { field: 'start', header: 'Start', width: 110 },
    { field: 'end', header: 'Finish', width: 110 },
  ]
</script>

<h1>gantt</h1>
<SvGrid {data} {columns} getRowId={(r) => r.id} containerHeight={360} gantt={{ startField: 'start', endField: 'end', dependencies }} />
