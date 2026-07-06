<!--
  title: Sprint board
  author: SvGrid team
  github: sv-grid
  tags: editing, custom cells, avatars
  discussion: 0
-->
<script lang="ts">
  /**
   * A sprint task list: assignee avatar (initials), a coloured priority pill,
   * story points, a status badge, and a "done" checkbox you can toggle inline.
   * Double-click the title or points to edit. Self-contained.
   */
  import {
    SvGrid,
    renderSnippet,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Task = {
    id: number
    title: string
    assignee: string
    priority: 'Low' | 'Medium' | 'High'
    points: number
    status: 'To do' | 'In progress' | 'Review' | 'Done'
    done: boolean
  }

  const features = tableFeatures({ rowSortingFeature })

  let rows = $state<Task[]>([
    { id: 1, title: 'Wire up auth callback',    assignee: 'Ada Lovelace', priority: 'High',   points: 5, status: 'In progress', done: false },
    { id: 2, title: 'Empty-state illustrations', assignee: 'Liam Chen',   priority: 'Low',    points: 2, status: 'To do',       done: false },
    { id: 3, title: 'Fix pagination overflow',   assignee: 'Mia Rossi',   priority: 'Medium', points: 3, status: 'Review',      done: false },
    { id: 4, title: 'Cache API responses',       assignee: 'Noah Patel',  priority: 'High',   points: 8, status: 'To do',       done: false },
    { id: 5, title: 'Dark-mode token audit',     assignee: 'Zoe Nakamura', priority: 'Medium', points: 3, status: 'Done',       done: true },
    { id: 6, title: 'Onboarding checklist',      assignee: 'Ada Lovelace', priority: 'Low',   points: 2, status: 'In progress', done: false },
    { id: 7, title: 'Rate-limit the webhook',    assignee: 'Liam Chen',   priority: 'High',   points: 5, status: 'Done',        done: true },
  ])

  const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('')
  const PRI: Record<string, string> = { Low: 'p-low', Medium: 'p-med', High: 'p-high' }
  const STA: Record<string, string> = { 'To do': 's-todo', 'In progress': 's-prog', Review: 's-rev', Done: 's-done' }

  const columns: ColumnDef<typeof features, Task>[] = [
    { field: 'title', header: 'Task', width: 220, editorType: 'text' },
    { id: 'assignee', header: 'Assignee', field: 'assignee', width: 150, cell: (ctx) => renderSnippet(Assignee, { name: String(ctx.getValue()) }) },
    { field: 'priority', header: 'Priority', width: 110, cell: (ctx) => renderSnippet(Pri, { v: String(ctx.getValue()) }) },
    { field: 'points', header: 'Pts', width: 70, align: 'right', editorType: 'number' },
    { field: 'status', header: 'Status', width: 130, cell: (ctx) => renderSnippet(Sta, { v: String(ctx.getValue()) }) },
    { field: 'done', header: 'Done', width: 70, align: 'center', editorType: 'checkbox' },
  ]
</script>

{#snippet Assignee(p: { name: string })}
  <span class="asg"><span class="av">{initials(p.name)}</span>{p.name}</span>
{/snippet}

{#snippet Pri(p: { v: string })}<span class="pill {PRI[p.v] ?? 'p-low'}">{p.v}</span>{/snippet}
{#snippet Sta(p: { v: string })}<span class="pill {STA[p.v] ?? 's-todo'}">{p.v}</span>{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">
    Double-click a Task or Pts cell to edit; toggle Done. A community-contributed demo.
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid data={rows} columns={columns} features={features} enableInlineEditing showRowNumbers={false} showPagination={false} rowHeight={40} containerHeight="100%" fitColumns={true} />
  </div>
</section>

<style>
  .asg { display: inline-flex; align-items: center; gap: 8px; }
  .av { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; font-size: 10px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); }
  .pill { display: inline-flex; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .p-low  { background: #e2e8f0; color: #475569; }
  .p-med  { background: #fef3c7; color: #92400e; }
  .p-high { background: #fee2e2; color: #991b1b; }
  .s-todo { background: #e2e8f0; color: #334155; }
  .s-prog { background: #dbeafe; color: #1e40af; }
  .s-rev  { background: #ede9fe; color: #5b21b6; }
  .s-done { background: #dcfce7; color: #166534; }
</style>
