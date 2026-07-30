<script lang="ts" module>
  export type { TreeSelectNode } from './ui-app.types'
</script>

<script lang="ts">
  /**
   * SvTreeSelect - a single-select dropdown that shows an indented, collapsible
   * tree in its panel (pick a node from a hierarchy). The open / position /
   * dismiss / roving / keyboard / ARIA mechanics come from the shared
   * `createPopoverSelect` core (with ArrowLeft/Right handled via onExtraKey for
   * expand/collapse); this component adds the tree flattening + rendering. Covers
   * the "cascader / tree select" pattern without depending on SvTree.
   */
  import type { TreeSelectNode } from './ui-app.types'
  import SvField from './SvField.svelte'
  import { editorAria, nextEditorId, type SvEditorProps } from './editor-contract'
  import { portalToBody, popIn } from './popover'
  import { createPopoverSelect } from './createPopoverSelect.svelte'
  import { flattenVisible, findNodePath } from './tree-select'

  type Props = Pick<
    SvEditorProps,
    'disabled' | 'label' | 'hint' | 'error' | 'required' | 'invalid' | 'size' | 'id' | 'name' | 'dir' | 'ariaLabel'
  > & {
    nodes: ReadonlyArray<TreeSelectNode>
    value?: string | number | null
    onChange?: (value: string | number) => void
    onCommit?: (value: string | number) => void
    onCancel?: () => void
    placeholder?: string
    showPath?: boolean
    expandedIds?: ReadonlyArray<string | number>
  }

  let {
    nodes,
    value = $bindable<string | number | null>(null),
    onChange,
    onCommit,
    onCancel,
    placeholder = 'Select…',
    showPath = false,
    expandedIds = [],
    disabled = false,
    label,
    hint,
    error,
    required = false,
    invalid = false,
    size = 'md',
    id,
    name,
    dir,
    ariaLabel,
  }: Props = $props()

  const autoId = nextEditorId('sv-ts')
  const uid = $derived(id ?? autoId)

  let expanded = $state(new Set<string | number>(expandedIds))
  let triggerEl = $state<HTMLButtonElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let treeEl = $state<HTMLUListElement | null>(null)

  const rows = $derived(flattenVisible(nodes, expanded))
  const selectedPath = $derived(value == null ? null : findNodePath(nodes, value))
  const triggerText = $derived(
    !selectedPath
      ? ''
      : showPath
        ? selectedPath.map((n) => n.label).join(' / ')
        : selectedPath[selectedPath.length - 1]!.label,
  )

  function setExpanded(v: string | number, on: boolean) {
    const next = new Set(expanded)
    on ? next.add(v) : next.delete(v)
    expanded = next
  }
  function toggleExpand(v: string | number) {
    setExpanded(v, !expanded.has(v))
  }
  function pick(node: TreeSelectNode) {
    if (node.disabled) return
    value = node.value // enables bind:value
    onChange?.(node.value)
    ts.closePanel()
  }
  function onRowClick(row: { node: TreeSelectNode; hasChildren: boolean }) {
    if (row.hasChildren) toggleExpand(row.node.value)
    else pick(row.node)
  }

  const ts = createPopoverSelect({
    itemCount: () => rows.length,
    disabled: (i) => !!rows[i]?.node.disabled,
    onSelect: (i) => { const row = rows[i]; if (row) onRowClick(row) },
    getTrigger: () => triggerEl,
    getPanel: () => panelEl,
    getInitialFocus: () => treeEl,
    closeOnSelect: () => false, // onRowClick handles pick + close (branches stay open)
    initialActive: () => Math.max(0, rows.findIndex((r) => r.node.value === value)),
    minWidth: () => 220,
    estimatedHeight: () => 300,
    onExtraKey: (e, act) => {
      const row = rows[act]
      if (!row) return false
      // "expand" opens the node or steps into the first child; "collapse" closes
      // it or jumps to the parent - same fallback as createTree's core.
      const expand = () => {
        if (row.hasChildren && !row.expanded) setExpanded(row.node.value, true)
        else if (row.hasChildren && row.expanded) ts.active = Math.min(act + 1, rows.length - 1)
      }
      const collapse = () => {
        if (row.hasChildren && row.expanded) setExpanded(row.node.value, false)
        else {
          let pi = act - 1
          while (pi >= 0 && rows[pi]!.depth >= row.depth) pi--
          if (pi >= 0) ts.active = pi
        }
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); expand(); return true }
      if (e.key === 'ArrowLeft') { e.preventDefault(); collapse(); return true }
      return false
    },
    idPrefix: 'sv-ts',
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <div class="sv-ts sv-ts--{size}" class:is-disabled={disabled}>
    <button
      bind:this={triggerEl}
      type="button"
      class="sv-ts__trigger"
      class:is-invalid={invalid}
      {disabled}
      onclick={() => ts.toggle()}
      {...ts.triggerProps('tree')}
      {...editorAria({ id: uid, invalid, required, error, hint, ariaLabel })}
    >
      <span class="sv-ts__value" class:is-placeholder={!triggerText}>{triggerText || placeholder}</span>
      <span class="sv-ts__arrow" aria-hidden="true">▾</span>
    </button>
    {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  </div>
</SvField>

{#if ts.open}
  <div
    bind:this={panelEl}
    class="sv-ts__panel"
    dir={dir}
    use:portalToBody
    use:popIn={{ up: ts.rect.openUpward }}
    style:position="fixed"
    style:top={`${ts.rect.top}px`}
    style:left={`${ts.rect.left}px`}
    style:min-width={`${ts.rect.width}px`}
  >
    <ul
      bind:this={treeEl}
      id={ts.panelId}
      class="sv-ts__tree"
      role="tree"
      aria-label={label ?? ariaLabel ?? 'Tree'}
      aria-activedescendant={ts.activeDescendant()}
      tabindex="0"
      style:max-height={`${ts.rect.maxHeight}px`}
      onkeydown={ts.onPanelKeydown}
    >
      {#each rows as row, i (row.node.value)}
        <li
          class="sv-ts__row"
          class:is-active={ts.isActive(i)}
          class:is-selected={row.node.value === value}
          class:is-disabled={row.node.disabled}
          role="treeitem"
          aria-selected={row.node.value === value}
          aria-expanded={row.hasChildren ? row.expanded : undefined}
          style:padding-inline-start={`${8 + row.depth * 16}px`}
          onclick={() => onRowClick(row)}
          {...ts.itemProps(i)}
        >
          {#if row.hasChildren}
            <span class="sv-ts__chev" class:is-open={row.expanded} aria-hidden="true">▸</span>
          {:else}
            <span class="sv-ts__chev sv-ts__chev--leaf" aria-hidden="true"></span>
          {/if}
          <span class="sv-ts__label">{row.node.label}</span>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .sv-ts { --_accent: var(--sg-accent, #2563eb); display: inline-flex; width: 240px; }
  .sv-ts.is-disabled { opacity: 0.6; }
  .sv-ts__trigger {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; text-align: start;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    font: inherit; cursor: pointer; padding: 0 9px;
  }
  .sv-ts--sm .sv-ts__trigger { height: 28px; font-size: 12px; }
  .sv-ts--md .sv-ts__trigger { height: 34px; font-size: 13px; }
  .sv-ts--lg .sv-ts__trigger { height: 40px; font-size: 15px; }
  .sv-ts__trigger:focus-visible { outline: none; border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-ts__trigger.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-ts__value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-ts__value.is-placeholder { color: var(--sg-muted, #94a3b8); }
  .sv-ts__arrow { color: var(--sg-muted, #64748b); font-size: 10px; }

  :global(.sv-ts__panel) {
    z-index: 2147483646; max-height: 320px; max-width: 92vw; overflow: hidden;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 48px -12px rgba(15, 23, 42, 0.35); font-size: 13px;
  }
  :global(.sv-ts__tree) { list-style: none; margin: 0; padding: 4px; overflow: auto; max-height: 320px; outline: none; }
  :global(.sv-ts__row) { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
  :global(.sv-ts__row.is-active) { background: var(--sg-row-hover-bg, #f1f5f9); }
  :global(.sv-ts__row.is-selected) { color: var(--sg-accent, #2563eb); font-weight: 600; }
  :global(.sv-ts__row.is-disabled) { opacity: 0.5; cursor: not-allowed; }
  :global(.sv-ts__chev) { width: 14px; flex: none; color: var(--sg-muted, #64748b); transition: transform 0.12s; font-size: 10px; }
  :global(.sv-ts__chev.is-open) { transform: rotate(90deg); }
  :global(.sv-ts__chev--leaf) { visibility: hidden; }
  :global(.sv-ts__label) { flex: 1; white-space: nowrap; }
</style>
