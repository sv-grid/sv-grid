<!-- Documented in: docs/help/rows/row-dragging.md -->
<script lang="ts">
  /**
   * 180. Managed row dragging (grid-to-grid)
   * ----------------------------------------
   * `rowDragManaged` turns every row into a drag source. Rows reorder within a
   * grid, and - because both grids share the same `rowDragGroup` - a row can be
   * dragged out of the Backlog and dropped into the Sprint (or back). The grid
   * splices its own data on drop; `onRowDragEnd` fires on the receiving grid so
   * you can mirror the move into your own state.
   */
  import { SvGrid, type ColumnDef } from '@svgrid/grid'

  type Task = { id: number; title: string; priority: 'High' | 'Medium' | 'Low'; points: number }

  let backlog = $state<Task[]>([
    { id: 1, title: 'Design empty states', priority: 'Medium', points: 3 },
    { id: 2, title: 'Keyboard nav audit', priority: 'High', points: 5 },
    { id: 3, title: 'Dark theme polish', priority: 'Low', points: 2 },
    { id: 4, title: 'CSV export edge cases', priority: 'Medium', points: 3 },
    { id: 5, title: 'Virtualization stress test', priority: 'High', points: 8 },
  ])
  let sprint = $state<Task[]>([
    { id: 6, title: 'Ship filter row', priority: 'High', points: 5 },
    { id: 7, title: 'Pivot subtotals', priority: 'Medium', points: 3 },
  ])

  let lastMove = $state<string>('Drag a row within a grid to reorder, or across to move it.')

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Task', width: 210 },
    { field: 'priority', header: 'Priority', width: 100 },
    { field: 'points', header: 'Pts', width: 64, align: 'right' },
  ]

  function onEnd(where: 'Backlog' | 'Sprint') {
    return (e: { row: Task; toIndex: number; sameGrid: boolean }) => {
      lastMove = e.sameGrid
        ? `Reordered "${e.row.title}" within ${where} → position ${e.toIndex + 1}`
        : `Moved "${e.row.title}" into ${where} → position ${e.toIndex + 1}`
    }
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    <strong>Drag any row</strong> by its grip (the <code>⠿</code> in the number
    column). Reorder inside a grid, or drag a row <strong>across</strong> to the
    other grid - both share <code>rowDragGroup="sprint-board"</code>, so the row
    leaves one and lands in the other. Drop below the last row to append.
  </p>

  <div
    class="shrink-0 text-xs rounded-md px-3 py-2"
    style="color: var(--sg-fg); background: var(--sg-header-bg); border: 1px solid var(--sg-border);"
  >
    {lastMove}
  </div>

  <div class="grid grid-cols-2 gap-4 flex-1 min-h-0">
    <div class="flex flex-col min-h-0">
      <h3 class="text-sm font-semibold mb-1 shrink-0" style="color: var(--sg-fg);">Backlog</h3>
      <div class="flex-1 min-h-0">
        <SvGrid responsive={true}
          data={backlog}
          columns={columns}
          showRowNumbers={true}
          rowDragManaged={true}
          rowDragGroup="sprint-board"
          onRowDragEnd={onEnd('Backlog')}
          rowHeight={40}
          containerHeight="100%"
          fitColumns={true}
        />
      </div>
    </div>

    <div class="flex flex-col min-h-0">
      <h3 class="text-sm font-semibold mb-1 shrink-0" style="color: var(--sg-fg);">Sprint</h3>
      <div class="flex-1 min-h-0">
        <SvGrid responsive={true}
          data={sprint}
          columns={columns}
          showRowNumbers={true}
          rowDragManaged={true}
          rowDragGroup="sprint-board"
          onRowDragEnd={onEnd('Sprint')}
          rowHeight={40}
          containerHeight="100%"
          fitColumns={true}
        />
      </div>
    </div>
  </div>
</section>
