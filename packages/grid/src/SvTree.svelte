<script lang="ts" module>
  export type { TreeNode } from './createTree.svelte'
</script>

<script lang="ts">
  /**
   * SvTree - a WAI-ARIA tree view. Expand/collapse, single-select highlight, and
   * optional cascading tri-state checkboxes. Parity: Smart `smart-tree`. Keyboard:
   * up/down move, left collapse/parent, right expand/child, Enter/Space select.
   *
   * The behavior (flattening, cascade math, keyboard, ARIA) lives in the headless
   * `createTree` core; this component is just one styled renderer over it.
   */
  import { createTree, type TreeNode } from './createTree.svelte'

  type Props = {
    nodes: ReadonlyArray<TreeNode>
    /** Selected node id (single-select highlight). */
    selected?: string | null
    onSelect?: (id: string) => void
    /** Initially/controlled expanded ids. */
    expandedIds?: string[]
    onToggle?: (id: string, expanded: boolean) => void
    /** Show cascading checkboxes; `checked` is the set of checked ids. */
    checkable?: boolean
    checked?: string[]
    onCheck?: (ids: string[]) => void
    ariaLabel?: string
  }

  let {
    nodes,
    selected = null,
    onSelect,
    expandedIds,
    onToggle,
    checkable = false,
    checked = [],
    onCheck,
    ariaLabel,
  }: Props = $props()

  const tree = createTree({
    nodes: () => nodes,
    selected: () => selected,
    onSelect: (id) => onSelect?.(id),
    expandedIds: () => expandedIds,
    onToggle: (id, exp) => onToggle?.(id, exp),
    checkable: () => checkable,
    checked: () => checked,
    onCheck: (ids) => onCheck?.(ids),
    ariaLabel: () => ariaLabel,
  })

  // DOM focus movement is a render concern: follow the core's roving focus row.
  let treeEl: HTMLDivElement | null = null
  let lastFocusTick = 0
  $effect(() => {
    if (tree.focusTick !== lastFocusTick) {
      lastFocusTick = tree.focusTick
      const i = tree.activeIndex
      queueMicrotask(() => treeEl?.querySelector<HTMLElement>(`[data-row="${i}"]`)?.focus())
    }
  })
</script>

<div bind:this={treeEl} class="sv-tree" {...tree.treeProps()}>
  {#each tree.rows as item (item.node.id)}
    {@const cs = checkable ? tree.checkStateOf(item.node) : 'unchecked'}
    <div
      class="sv-tree__row"
      class:is-selected={item.node.id === selected}
      class:is-disabled={item.node.disabled}
      style:padding-left={`${item.depth * 18 + 6}px`}
      {...tree.itemProps(item)}
    >
      <button
        type="button"
        class="sv-tree__twist"
        class:is-open={item.open}
        class:is-leaf={!item.hasChildren}
        tabindex="-1"
        aria-hidden={!item.hasChildren}
        onclick={(e) => { e.stopPropagation(); toggleExpand(item.node) }}
      >
        {#if item.hasChildren}
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        {/if}
      </button>
      {#if checkable}
        <button type="button" class="sv-tree__check is-{cs}" tabindex="-1" aria-hidden="true" onclick={(e) => { e.stopPropagation(); toggleCheck(item.node) }}>
          {#if cs === 'checked'}<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {:else if cs === 'indeterminate'}<svg viewBox="0 0 16 16"><path d="M4 8h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>{/if}
        </button>
      {/if}
      <span class="sv-tree__label">{item.node.label}</span>
    </div>
  {/each}
</div>

<style>
  .sv-tree {
    --_accent: var(--sg-accent, #2563eb);
    width: 260px; padding: 4px; user-select: none;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
    font-size: 13px;
  }
  .sv-tree__row {
    display: flex; align-items: center; gap: 4px; height: 30px; padding-right: 8px;
    border-radius: 6px; cursor: pointer; outline: none;
  }
  .sv-tree__row:hover:not(.is-disabled) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-tree__row.is-selected { background: color-mix(in srgb, var(--_accent) 15%, transparent); color: var(--_accent); font-weight: 600; }
  .sv-tree__row.is-disabled { opacity: 0.45; cursor: not-allowed; }
  .sv-tree__row:focus-visible { box-shadow: inset 0 0 0 2px var(--sg-focus-ring, var(--_accent)); }
  .sv-tree__twist {
    display: grid; place-items: center; width: 18px; height: 18px; flex: none;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; transition: transform 0.12s;
  }
  .sv-tree__twist.is-open { transform: rotate(90deg); }
  .sv-tree__twist.is-leaf { visibility: hidden; }
  .sv-tree__check {
    display: grid; place-items: center; width: 16px; height: 16px; flex: none; padding: 0;
    border: 1.5px solid var(--sg-border, #cbd5e1); border-radius: 4px; background: var(--sg-input-bg, #fff);
    color: var(--sg-on-accent, #fff); cursor: pointer;
  }
  .sv-tree__check.is-checked, .sv-tree__check.is-indeterminate { background: var(--_accent); border-color: var(--_accent); }
  .sv-tree__check svg { width: 100%; height: 100%; }
  .sv-tree__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
