<!-- Documented in: docs/help/rows/row-dragging.md -->
<script lang="ts">
  /**
   * 184. External row-drag drop zones
   * ---------------------------------
   * Managed row drags can be dropped onto ANY element outside the grid via the
   * `rowDropZone` action. Here, drag a task out of the grid onto Archive or
   * Delete: the row leaves the grid, and the zone's `onDrop` handles it. The
   * grid keeps `rowDragManaged` (so in-grid reorder still works) and a
   * `rowDragGroup` the zones match on.
   */
  import { SvGrid, rowDropZone, type ColumnDef } from '@svgrid/grid'

  type Task = { id: number; title: string; priority: 'High' | 'Medium' | 'Low' }

  let tasks = $state<Task[]>([
    { id: 1, title: 'Design empty states', priority: 'Medium' },
    { id: 2, title: 'Keyboard nav audit', priority: 'High' },
    { id: 3, title: 'Dark theme polish', priority: 'Low' },
    { id: 4, title: 'CSV export edge cases', priority: 'Medium' },
    { id: 5, title: 'Virtualization stress test', priority: 'High' },
  ])
  let archived = $state<Task[]>([])
  let lastAction = $state('Drag a row onto Archive or Delete.')

  const columns: ColumnDef<any, Task>[] = [
    { field: 'title', header: 'Task', width: 240 },
    { field: 'priority', header: 'Priority', width: 110 },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    Drag a task by its grip out onto a <strong>drop zone</strong>. The row leaves
    the grid and the zone's <code>onDrop</code> runs - Archive keeps it, Delete
    discards it. In-grid reorder still works.
  </p>

  <div class="edz-status shrink-0">{lastAction}</div>

  <div class="edz-layout flex-1 min-h-0">
    <div class="edz-grid">
      <SvGrid responsive={true}
      columnResize
        data={tasks}
        columns={columns}
        showRowNumbers={true}
        rowDragManaged={true}
        rowDragGroup="tasks"
        rowHeight={40}
        containerHeight="100%"
        fitColumns={true}
      />
    </div>

    <div class="edz-zones">
      <div
        class="edz-zone edz-archive"
        use:rowDropZone={{
          group: 'tasks',
          onDrop: (e) => { archived = [...archived, e.row as Task]; lastAction = `Archived "${(e.row as Task).title}"` },
        }}
      >
        <div class="edz-zone-title">📥 Archive</div>
        <div class="edz-zone-hint">Drop to archive ({archived.length})</div>
        {#if archived.length}
          <ul class="edz-archived">
            {#each archived as t (t.id)}<li>{t.title}</li>{/each}
          </ul>
        {/if}
      </div>

      <div
        class="edz-zone edz-delete"
        use:rowDropZone={{
          group: 'tasks',
          onDrop: (e) => { lastAction = `Deleted "${(e.row as Task).title}"` },
        }}
      >
        <div class="edz-zone-title">🗑️ Delete</div>
        <div class="edz-zone-hint">Drop to remove</div>
      </div>
    </div>
  </div>
</section>

<style>
  .edz-status {
    font-size: 12px; color: var(--sg-fg);
    background: var(--sg-header-bg); border: 1px solid var(--sg-border);
    border-radius: 6px; padding: 8px 12px;
  }
  .edz-layout { display: grid; grid-template-columns: 1fr 240px; gap: 16px; }
  .edz-grid { min-height: 0; }
  .edz-zones { display: flex; flex-direction: column; gap: 12px; }
  .edz-zone {
    flex: 1; display: flex; flex-direction: column; gap: 4px;
    border: 2px dashed var(--sg-border, #cbd5e1); border-radius: 10px;
    padding: 14px; text-align: center; color: var(--sg-muted, #64748b);
    transition: border-color 120ms ease, background-color 120ms ease;
  }
  .edz-zone-title { font-size: 15px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .edz-zone-hint { font-size: 11px; }
  .edz-delete { border-color: color-mix(in oklab, #ef4444 40%, var(--sg-border)); }
  .edz-archived {
    list-style: none; margin: 6px 0 0; padding: 0; text-align: left;
    font-size: 11px; color: var(--sg-fg); overflow: auto;
  }
  .edz-archived li { padding: 2px 6px; border-radius: 4px; background: color-mix(in oklab, #10b981 10%, transparent); margin-bottom: 3px; }
</style>
