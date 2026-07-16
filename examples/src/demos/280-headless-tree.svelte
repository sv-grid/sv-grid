<script lang="ts">
  /**
   * Headless tree - the same headless-first split as the grid. `createTree` is the
   * runes state machine behind <SvTree>: flattening, expand/collapse, single-select,
   * cascading tri-state checkboxes and full keyboard - exposed as **prop-getters**
   * you spread onto YOUR OWN markup. Below, one core drives the styled <SvTree> AND
   * a custom compact explorer, both bound to a single selected id.
   */
  import { SvTree, createTree, type SvTreeNode } from '@svgrid/grid'

  const nodes: SvTreeNode[] = [
    { id: 'src', label: 'src', children: [
      { id: 'comp', label: 'components', children: [
        { id: 'grid', label: 'SvGrid.svelte' },
        { id: 'tree', label: 'SvTree.svelte' },
      ] },
      { id: 'core', label: 'createTree.svelte.ts' },
    ] },
    { id: 'pkg', label: 'package.json' },
  ]

  let selected = $state<string | null>('tree')

  // The headless core - identical behavior, our own DOM.
  const tree = createTree({
    nodes: () => nodes,
    selected: () => selected,
    onSelect: (id) => (selected = id),
    expandedIds: () => ['src', 'comp'],
  })

  // DOM focus movement is a render concern, so the renderer owns it.
  let listEl: HTMLDivElement | null = null
  let lastTick = 0
  $effect(() => {
    if (tree.focusTick !== lastTick) {
      lastTick = tree.focusTick
      const i = tree.activeIndex
      queueMicrotask(() => listEl?.querySelector<HTMLElement>(`[data-row="${i}"]`)?.focus())
    }
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless tree</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createTree</code>
      drives both renders; flattening, expand/collapse and keyboard come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvTree&gt;</code></h3>
      <SvTree {nodes} {selected} expandedIds={['src', 'comp']} onSelect={(id) => (selected = id)} ariaLabel="Files" />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="exp" bind:this={listEl} {...tree.treeProps()}>
        {#each tree.rows as row (row.node.id)}
          <div class="exp__row" class:on={row.node.id === selected} style:padding-left={`${row.depth * 16 + 8}px`} {...tree.itemProps(row)}>
            {#if row.hasChildren}
              <button class="exp__tw" class:open={row.open} tabindex="-1" aria-hidden="true" onclick={(e) => { e.stopPropagation(); tree.toggleExpand(row.node) }}>▸</button>
            {:else}<span class="exp__dot">•</span>{/if}
            <span class="exp__lbl">{row.node.label}</span>
          </div>
        {/each}
      </div>
      <p class="hint">Arrows move, left/right collapse/expand, Enter selects - all from <code>createTree</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Selected</h3>
    {#if selected}<div class="tags"><span class="tag">{selected}</span></div>{:else}<p class="empty">Nothing selected</p>{/if}
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  /* Fully custom tree render - nothing shared with SvTree but the core. */
  .exp { width: 240px; padding: 6px; border-radius: 10px; background: var(--sg-input-bg, #fff); border: 1px dashed var(--sg-border, #e2e8f0); outline: none; font-size: 13px; }
  .exp__row { display: flex; align-items: center; gap: 6px; height: 28px; border-radius: 6px; cursor: pointer; outline: none; }
  .exp__row:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .exp__row.on { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .exp__row:focus-visible { box-shadow: inset 0 0 0 2px var(--sg-accent, #4f46e5); }
  .exp__tw { border: 0; background: none; cursor: pointer; color: var(--sg-muted, #64748b); width: 16px; transition: transform 0.12s; }
  .exp__tw.open { transform: rotate(90deg); }
  .exp__dot { width: 16px; text-align: center; color: var(--sg-muted, #94a3b8); }
  .exp__lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
