<script lang="ts">
  /**
   * SvTree editing: drag-drop reorder (before / after / inside), inline rename
   * (double-click or F2), and sortable siblings. Uses the exported
   * `moveTreeNode` helper to apply a drop.
   */
  import { SvTree, moveTreeNode } from '@svgrid/grid'
  import type { SvTreeNode, TreeDropPosition } from '@svgrid/grid'

  let nodes = $state<SvTreeNode[]>([
    { id: 'work', label: 'Work', children: [
      { id: 'q1', label: 'Q1 planning' },
      { id: 'q2', label: 'Q2 roadmap' },
      { id: 'reviews', label: 'Reviews' },
    ] },
    { id: 'personal', label: 'Personal', children: [
      { id: 'trip', label: 'Trip ideas' },
      { id: 'books', label: 'Reading list' },
    ] },
    { id: 'inbox', label: 'Inbox' },
  ])
  let expanded = $state<string[]>(['work', 'personal'])
  let selected = $state<string | null>('q1')
  let sort = $state<'none' | 'asc' | 'desc'>('none')

  function renameNode(list: SvTreeNode[], id: string, label: string): SvTreeNode[] {
    return list.map((n) => (n.id === id ? { ...n, label } : n.children ? { ...n, children: renameNode(n.children, id, label) } : n))
  }
</script>

<div class="wrap">
  <header>
    <h2>Tree editing</h2>
    <p>Drag a node to reorder (drop <strong>before</strong>, <strong>after</strong>, or <strong>inside</strong> a folder), double-click or press <strong>F2</strong> to rename, and sort siblings.</p>
    <label class="sortsel">Sort
      <select bind:value={sort}>
        <option value="none">Manual (drag)</option>
        <option value="asc">A -&gt; Z</option>
        <option value="desc">Z -&gt; A</option>
      </select>
    </label>
  </header>

  <div class="card">
    <SvTree
      {nodes}
      {selected}
      expandedIds={expanded}
      reorderable={sort === 'none'}
      editable
      sort={sort === 'none' ? undefined : sort}
      onSelect={(id) => (selected = id)}
      onToggle={(id, open) => (expanded = open ? [...expanded, id] : expanded.filter((e) => e !== id))}
      onMove={(dragId, targetId, pos: TreeDropPosition) => (nodes = moveTreeNode(nodes, dragId, targetId, pos))}
      onRename={(id, label) => (nodes = renameNode(nodes, id, label))}
    />
  </div>
  <p class="note">{sort === 'none' ? 'Manual order - drag to rearrange.' : 'Sorted - drag is disabled while a sort is active.'}</p>
</div>

<style>
  .wrap { padding: 20px; max-width: 520px; display: flex; flex-direction: column; gap: 14px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .sortsel { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sortsel select { padding: 5px 8px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 7px; background: var(--sg-input-bg, #fff); color: inherit; font: inherit; font-size: 13px; }
  .card { display: inline-block; }
  .note { margin: 0; font-size: 12px; color: var(--sg-muted, #94a3b8); }
</style>
