<script lang="ts">
  /**
   * DockNodeView - the recursive renderer for one node of a <SvDockLayout> tree.
   * A `group` becomes a flex row/column of children with draggable splitters
   * between them; a `tabs` leaf becomes a tab strip over the active pane's
   * content. All tree edits go through the pure `dock-model`; this file only
   * paints and wires gestures. It renders itself for nested groups.
   */
  import { getContext } from 'svelte'
  import Self from './DockNodeView.svelte'
  import { DOCK_CONTEXT, type DockContext } from './dock-context'
  import type { DockNode, DockGroup } from './dock-model'

  let { node }: { node: DockNode } = $props()

  const ctx = getContext<DockContext>(DOCK_CONTEXT)

  // ---- splitter drag (group children resize) ----------------------------
  let groupEl = $state<HTMLElement | null>(null)

  function onSplitterDown(e: PointerEvent, group: DockGroup, index: number) {
    if (e.button !== 0 || !groupEl) return
    e.preventDefault()
    const vertical = group.direction === 'column'
    const rect = groupEl.getBoundingClientRect()
    const total = vertical ? rect.height : rect.width
    if (total <= 0) return
    const startSizes = group.sizes.slice()
    const startPos = vertical ? e.clientY : e.clientX
    const minFrac = ctx.minSize() / total
    // Only the two panes adjacent to this gutter move; the rest stay put.
    const a = index
    const b = index + 1
    const pairTotal = startSizes[a]! + startSizes[b]!

    const onMove = (ev: PointerEvent) => {
      const delta = ((vertical ? ev.clientY : ev.clientX) - startPos) / total
      let fa = Math.min(Math.max(startSizes[a]! + delta, minFrac), pairTotal - minFrac)
      const next = startSizes.slice()
      next[a] = fa
      next[b] = pairTotal - fa
      ctx.resize(group.id, next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
</script>

{#if node.type === 'group'}
  <div
    class="sv-dock__group sv-dock__group--{node.direction}"
    bind:this={groupEl}
    role="group"
  >
    {#each node.children as child, i (child.id)}
      <div class="sv-dock__cell" style:flex-grow={node.sizes[i] ?? 1} style:flex-basis="0">
        <Self node={child} />
      </div>
      {#if i < node.children.length - 1}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="sv-dock__splitter sv-dock__splitter--{node.direction}"
          role="separator"
          aria-orientation={node.direction === 'column' ? 'horizontal' : 'vertical'}
          onpointerdown={(e) => onSplitterDown(e, node as DockGroup, i)}
        ></div>
      {/if}
    {/each}
  </div>
{:else}
  {@const active = node.panes[node.active] ?? node.panes[0]}
  {@const reorder = ctx.reorderTarget?.() ?? null}
  {@const reorderHere = reorder && reorder.tabsId === node.id ? reorder.index : -1}
  <div class="sv-dock__leaf" data-dock-tabs={node.id}>
    <div class="sv-dock__tabstrip" role="tablist">
      {#each node.panes as p, i (p.id)}
        {#if reorderHere === i}<div class="sv-dock__ins" aria-hidden="true"></div>{/if}
        <div
          class="sv-dock__tab"
          class:is-active={i === node.active}
          role="tab"
          aria-selected={i === node.active}
          tabindex={i === node.active ? 0 : -1}
          data-dock-tab={p.id}
          data-tab-index={i}
          onpointerdown={(e) => {
            if (e.button === 0) { ctx.activate(node.id, i); ctx.beginDrag(e, p.id, node.id) }
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.activate(node.id, i) }
          }}
        >
          <span class="sv-dock__tab-label">{p.title}</span>
          {#if p.closable !== false}
            <button
              type="button"
              class="sv-dock__tab-close"
              aria-label={`Close ${p.title}`}
              title="Close"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => { e.stopPropagation(); ctx.close(p.id) }}
            >&times;</button>
          {/if}
        </div>
      {/each}
      {#if reorderHere === node.panes.length}<div class="sv-dock__ins" aria-hidden="true"></div>{/if}
      {#if ctx.leafActions}
        <div class="sv-dock__leafctl">{@render ctx.leafActions(node)}</div>
      {/if}
    </div>

    <div class="sv-dock__content" role="tabpanel">
      {#if active}{@render ctx.pane(active)}{/if}
    </div>

    {#if ctx.dropTarget()?.tabsId === node.id}
      {@const dt = ctx.dropTarget()!}
      {@const zone = dt.zone}
      {@const centerOnly = dt.centerOnly === true}
      <div class="sv-dock__dropzone" aria-hidden="true">
        <!-- Preview: the region the panel will occupy (only when over a chip). -->
        {#if zone}<div class="sv-dock__drop-hint sv-dock__drop-hint--{zone}"></div>{/if}
        <!-- Guide: dock targets. Drop ON a chip to dock; off it, the tab floats. -->
        <div class="sv-dock__guide" class:is-center-only={centerOnly}>
          {#if !centerOnly}
            <div class="sv-dock__guide-cell sv-dock__guide-cell--top" class:is-on={zone === 'top'}></div>
          {/if}
          <div class="sv-dock__guide-row">
            {#if !centerOnly}
              <div class="sv-dock__guide-cell sv-dock__guide-cell--left" class:is-on={zone === 'left'}></div>
            {/if}
            <div class="sv-dock__guide-cell sv-dock__guide-cell--center" class:is-on={zone === 'center'}></div>
            {#if !centerOnly}
              <div class="sv-dock__guide-cell sv-dock__guide-cell--right" class:is-on={zone === 'right'}></div>
            {/if}
          </div>
          {#if !centerOnly}
            <div class="sv-dock__guide-cell sv-dock__guide-cell--bottom" class:is-on={zone === 'bottom'}></div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .sv-dock__group { display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0; }
  .sv-dock__group--row { flex-direction: row; }
  .sv-dock__group--column { flex-direction: column; }
  .sv-dock__cell { min-width: 0; min-height: 0; overflow: hidden; display: flex; }
  .sv-dock__cell > :global(*) { flex: 1; min-width: 0; min-height: 0; }

  .sv-dock__splitter { flex: none; background: var(--sg-border, #e2e8f0); position: relative; }
  .sv-dock__splitter::after { content: ''; position: absolute; inset: -3px; }
  .sv-dock__splitter--row { width: 4px; cursor: col-resize; }
  .sv-dock__splitter--column { height: 4px; cursor: row-resize; }
  .sv-dock__splitter:hover { background: var(--sg-accent, #2563eb); }

  .sv-dock__leaf {
    position: relative; display: flex; flex-direction: column; width: 100%; height: 100%;
    min-width: 0; min-height: 0; background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 8px; overflow: hidden;
  }
  .sv-dock__tabstrip {
    display: flex; flex: none; gap: 2px; padding: 4px 4px 0; overflow-x: auto;
    background: var(--sg-header-bg, #f6f7f9); border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-dock__tab {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; cursor: grab;
    font-size: 12.5px; font-weight: 600; color: var(--sg-muted, #64748b); white-space: nowrap;
    border: 1px solid transparent; border-bottom: none; border-radius: 7px 7px 0 0; user-select: none;
    touch-action: none;
  }
  .sv-dock__tab:hover { color: var(--sg-fg, #0f172a); }
  .sv-dock__tab.is-active {
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff);
    border-color: var(--sg-border, #e2e8f0);
  }
  .sv-dock__tab-close {
    display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;
    padding: 0; font-size: 15px; line-height: 1; color: var(--sg-muted, #94a3b8); cursor: pointer;
    background: none; border: none; border-radius: 4px;
  }
  .sv-dock__tab-close:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-danger, #dc2626); }
  /* Stack-header controls, pinned to the right of the tab strip. */
  .sv-dock__leafctl { margin-inline-start: auto; align-self: center; display: flex; align-items: center; gap: 1px; padding: 0 2px 3px; }
  .sv-dock__content { flex: 1; min-height: 0; overflow: auto; }

  /* Tab-reorder insertion line. */
  .sv-dock__ins {
    flex: none; align-self: stretch; width: 3px; margin: 3px 0; border-radius: 2px;
    background: var(--sg-accent, #2563eb); box-shadow: 0 0 0 1px color-mix(in srgb, var(--sg-accent, #2563eb) 40%, transparent);
  }

  /* Drop-zone indicators shown on the leaf under the pointer while dragging. */
  .sv-dock__dropzone { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
  /* Ring around the whole targeted leaf, so which pane you're over is obvious. */
  .sv-dock__dropzone::before {
    content: ''; position: absolute; inset: 2px; border-radius: 7px;
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sg-accent, #2563eb) 32%, transparent);
  }
  .sv-dock__drop-hint {
    position: absolute; background: color-mix(in srgb, var(--sg-accent, #2563eb) 22%, transparent);
    border: 2px solid var(--sg-accent, #2563eb); border-radius: 6px; transition: inset 90ms ease;
  }
  .sv-dock__drop-hint--center { inset: 8px; }
  .sv-dock__drop-hint--left { inset: 4px 50% 4px 4px; }
  .sv-dock__drop-hint--right { inset: 4px 4px 4px 50%; }
  .sv-dock__drop-hint--top { inset: 4px 4px 50% 4px; }
  .sv-dock__drop-hint--bottom { inset: 50% 4px 4px 4px; }

  /* The 5-direction dock guide (VS-style): a plus of targets, active one lit. */
  .sv-dock__guide {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 6px; border-radius: 10px;
    background: color-mix(in srgb, var(--sg-bg, #fff) 82%, transparent);
    box-shadow: 0 6px 20px -6px rgba(15,23,42,0.45); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-dock__guide-row { display: flex; gap: 4px; }
  .sv-dock__guide-cell {
    width: 26px; height: 26px; border-radius: 6px; position: relative;
    background: var(--sg-header-bg, #f1f5f9); border: 1px solid var(--sg-border, #cbd5e1);
  }
  .sv-dock__guide-cell::after {
    content: ''; position: absolute; border-radius: 3px;
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 55%, transparent);
  }
  .sv-dock__guide-cell--center::after { inset: 5px; }
  .sv-dock__guide-cell--left::after { inset: 5px 13px 5px 5px; }
  .sv-dock__guide-cell--right::after { inset: 5px 5px 5px 13px; }
  .sv-dock__guide-cell--top::after { inset: 5px 5px 13px 5px; }
  .sv-dock__guide-cell--bottom::after { inset: 13px 5px 5px 5px; }
  .sv-dock__guide-cell.is-on {
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 18%, var(--sg-bg, #fff));
    border-color: var(--sg-accent, #2563eb);
  }
  .sv-dock__guide-cell.is-on::after { background: var(--sg-accent, #2563eb); }
</style>
