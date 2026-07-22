<script lang="ts">
  /**
   * SvTree at scale: a virtualized 10,000-node tree (only visible rows in the
   * DOM) and a lazy-loading tree that fetches each folder's children on first
   * expand. Both keep keyboard nav, selection and cascading checkboxes.
   */
  import { SvTree } from '@svgrid/grid'
  import type { SvTreeNode } from '@svgrid/grid'

  // ---- 10,000 nodes: 100 folders x 100 files -------------------------------
  const bigNodes: SvTreeNode[] = Array.from({ length: 100 }, (_, f) => ({
    id: `f${f}`,
    label: `Folder ${f + 1}`,
    children: Array.from({ length: 100 }, (_, i) => ({ id: `f${f}-${i}`, label: `File ${f + 1}.${i + 1}` })),
  }))
  const total = 100 + 100 * 100
  let selected = $state<string | null>('f0-0')
  let expanded = $state<string[]>(['f0'])

  // ---- Lazy loading: folders fetch children on first expand ----------------
  const lazyNodes: SvTreeNode[] = [
    { id: 'docs', label: 'Documents', lazy: true },
    { id: 'media', label: 'Media', lazy: true },
    { id: 'projects', label: 'Projects', lazy: true },
  ]
  let lazyExpanded = $state<string[]>([])
  let lazySelected = $state<string | null>(null)

  // Simulate a server round-trip (deterministic - no Math.random).
  function loadChildren(node: SvTreeNode): Promise<SvTreeNode[]> {
    return new Promise((resolve) =>
      setTimeout(() => {
        resolve(
          Array.from({ length: 5 }, (_, i) => ({
            id: `${node.id}-${i}`,
            label: `${node.label} item ${i + 1}`,
            // Nest one more lazy level to show it recurses.
            lazy: i === 0,
          })),
        )
      }, 650),
    )
  }
</script>

<div class="wrap">
  <header>
    <h2>Tree at scale</h2>
    <p>Two production patterns: a <strong>virtualized {total.toLocaleString()}-node</strong> tree, and a <strong>lazy-loading</strong> tree that fetches children on demand.</p>
  </header>

  <div class="cols">
    <section>
      <h3>Virtualized ({total.toLocaleString()} nodes)</h3>
      <SvTree
        nodes={bigNodes}
        {selected}
        expandedIds={expanded}
        virtual
        height={360}
        rowHeight={30}
        onSelect={(id) => (selected = id)}
        onToggle={(id, open) => (expanded = open ? [...expanded, id] : expanded.filter((e) => e !== id))}
      />
      <p class="note">Expand a few folders and scroll - only ~15 rows are ever in the DOM.</p>
    </section>

    <section>
      <h3>Lazy-loaded (fetch on expand)</h3>
      <SvTree
        nodes={lazyNodes}
        selected={lazySelected}
        expandedIds={lazyExpanded}
        {loadChildren}
        height={360}
        onSelect={(id) => (lazySelected = id)}
        onToggle={(id, open) => (lazyExpanded = open ? [...lazyExpanded, id] : lazyExpanded.filter((e) => e !== id))}
      />
      <p class="note">Each folder spins while it loads (~650ms), then reveals its children. The first child is itself lazy.</p>
    </section>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 720px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .cols { display: flex; gap: 28px; flex-wrap: wrap; align-items: start; }
  section h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .note { margin: 8px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); max-width: 300px; line-height: 1.5; }
</style>
