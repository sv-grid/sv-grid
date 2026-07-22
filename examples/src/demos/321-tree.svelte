<script lang="ts">
  /**
   * SvTree - a production file explorer with cascading tri-state checkboxes and a
   * single-select highlight. Keyboard: up/down move, left/right collapse/expand.
   * Copy-paste ready.
   */
  import { SvTree } from '@svgrid/grid'
  import type { SvTreeNode } from '@svgrid/grid'

  const nodes: SvTreeNode[] = [
    { id: 'src', label: 'src', children: [
      { id: 'comp', label: 'components', children: [
        { id: 'grid', label: 'Grid.svelte' },
        { id: 'toolbar', label: 'Toolbar.svelte' },
      ] },
      { id: 'lib', label: 'lib', children: [
        { id: 'api', label: 'api.ts' },
        { id: 'utils', label: 'utils.ts' },
      ] },
      { id: 'main', label: 'main.ts' },
    ] },
    { id: 'public', label: 'public', children: [
      { id: 'logo', label: 'logo.svg' },
      { id: 'favicon', label: 'favicon.ico' },
    ] },
    { id: 'readme', label: 'README.md' },
  ]
  let selected = $state<string | null>('grid')
  let checked = $state<string[]>(['api'])
  let expanded = $state<string[]>(['src', 'comp', 'lib'])
</script>

<div class="wrap">
  <header>
    <h2>Tree</h2>
    <p>A hierarchical view (WAI-ARIA tree) with a built-in search box (type to filter, matches auto-expand), cascading tri-state checkboxes and keyboard nav.</p>
  </header>

  <div class="cols">
    <div class="card">
      <SvTree {nodes} {selected} checkable {checked} expandedIds={expanded} searchable searchPlaceholder="Search files..."
        onSelect={(id) => (selected = id)}
        onCheck={(ids) => (checked = ids)}
        onToggle={(id, open) => (expanded = open ? [...expanded, id] : expanded.filter((e) => e !== id))} />
    </div>
    <aside class="side">
      <div><span class="k">Selected</span><strong>{selected ?? '-'}</strong></div>
      <div><span class="k">Checked ({checked.length})</span><strong>{checked.join(', ') || '-'}</strong></div>
    </aside>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 640px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .cols { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  .side { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 14px; }
  .side .k { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #94a3b8); margin-bottom: 2px; }
  .side strong { font-size: 13px; word-break: break-word; }
</style>
