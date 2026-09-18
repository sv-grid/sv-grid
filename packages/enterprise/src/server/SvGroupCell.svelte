<!--
  Built-in group cell for the server-side group/tree model. Drop it into the
  grouping column and it draws the expander + indentation for group rows (and an
  indented leaf value) - no hand-written cell recipe. Pair with `serverGroupRows`
  to feed `<SvGrid data>`, and wire `onToggle` to the controller's `toggleGroup`.

      cell: (ctx) => renderComponent(SvGroupCell, {
        row: ctx.row.original, onToggle: ctl.toggleGroup, leafField: 'name',
      })
-->
<script lang="ts" generics="TData">
  import type { GridIcons, ServerDisplayRow, ServerPlaceholderRow } from '@svgrid/grid'

  // Rows from either model: the display-row union, plus the block-cached
  // model's shared placeholder (which the grid renders itself, so it never
  // reaches this cell - but the type has to admit it).
  type GroupGridRow = { __group?: ServerDisplayRow<TData> | ServerPlaceholderRow } & Record<string, unknown>
  type Props = {
    /** The grid row from `serverGroupRows` (carries the `__group` marker). */
    row: GroupGridRow
    /**
     * Expand / collapse a group, or load more children. Receives the grid row;
     * wire to `serverGroupNav(ctl).onToggle` (which drives clicks and keyboard).
     */
    onToggle: (row: GroupGridRow) => void
    /**
     * Field to show for leaf rows in the group column (blank if omitted).
     * Under `treeData` every row is a node of the same shape, so it names
     * the label of expandable nodes too; a group row's key is otherwise
     * the text.
     */
    leafField?: string
    /** Pixels of indentation per level. Default 18. */
    indent?: number
    /**
     * Icon overrides, the same map `<SvGrid icons>` takes. Only
     * `chevron-right` is drawn here. You mount this component yourself, so it
     * cannot inherit the grid's icons - pass the same object to both to keep
     * the expander consistent with the rest of the chrome.
     */
    icons?: GridIcons
  }

  let { row, onToggle, leafField, indent = 18, icons }: Props = $props()
  const chevron = $derived(icons?.['chevron-right'])
  const meta = $derived(row.__group)
  // A tree node's key is its id (`field` is empty under treeData); the
  // label is the leaf field then, the same as for its leaves.
  const label = $derived(
    meta?.kind === 'group' && meta.field === '' && leafField ? String(row[leafField] ?? '') : meta?.kind === 'group' ? meta.key : '',
  )
</script>

{#if meta && meta.kind === 'group' && meta.expandable === false}
  <!-- Nothing opens beneath it (the innermost level under a server pivot),
       so no expander: the key and the count, indented like its siblings. -->
  <span class="sv-group-cell sv-group-cell-leaf" style={`padding-inline-start: ${meta.level * indent}px`}>
    <span class="sv-group-chev sv-group-chev-none" aria-hidden="true"></span>
    <span class="sv-group-key">{label}</span>
    {#if meta.childCount != null}<span class="sv-group-count">({meta.childCount.toLocaleString()})</span>{/if}
  </span>
{:else if meta && meta.kind === 'group'}
  <button
    type="button"
    class="sv-group-cell"
    style={`padding-inline-start: ${meta.level * indent}px`}
    aria-expanded={meta.expanded}
    aria-busy={meta.loading ? 'true' : undefined}
    aria-label={meta.loading ? 'Loading group' : meta.expanded ? 'Collapse group' : 'Expand group'}
    onclick={() => onToggle(row)}
  >
    {#if meta.loading}
      <!-- The level's block is in flight: the expander's slot holds a
           spinner until it lands, so the wait is visible on the row itself. -->
      <span class="sv-group-chev sv-group-spinner" aria-hidden="true"></span>
    {:else}
      <!-- Same chevron the grid's own expanders and SvTree draw, so every
           expander in the library looks identical. -->
      <span class="sv-group-chev" class:open={meta.expanded} aria-hidden="true">
        {#if chevron}
          {@render chevron()}
        {:else}
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        {/if}
      </span>
    {/if}
    <span class="sv-group-key">{label}</span>
    {#if meta.childCount != null}<span class="sv-group-count">({meta.childCount.toLocaleString()})</span>{/if}
  </button>
{:else if meta && meta.kind === 'more'}
  <button
    type="button"
    class="sv-group-more"
    style={`padding-inline-start: ${meta.level * indent}px`}
    disabled={meta.loading}
    onclick={() => onToggle(row)}
  >
    {meta.loading ? 'Loading...' : `Load ${meta.remaining} more`}
  </button>
{:else if meta && meta.kind === 'footer'}
  <span class="sv-group-footer" style={`padding-inline-start: ${meta.level * indent}px`}>Total</span>
{:else if meta && meta.kind === 'skeleton'}
  <span class="sv-group-skeleton" style={`margin-inline-start: ${meta.level * indent}px`} aria-hidden="true"></span>
{:else if meta && meta.kind === 'grandTotal'}
  <span class="sv-group-footer sv-group-grand-total">Grand total</span>
{:else if meta && meta.kind === 'placeholder'}
  <!-- The grid draws placeholder rows itself; nothing to add here. -->
{:else if meta}
  <span class="sv-group-leaf" style={`padding-inline-start: ${(meta.level + 1) * indent}px`}>
    {leafField ? (row[leafField] ?? '') : ''}
  </span>
{/if}

<style>
  .sv-group-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .sv-group-cell-leaf { cursor: default; }
  .sv-group-chev {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    transition: transform 0.15s;
    color: var(--sg-muted, #64748b);
  }
  /* An `icons` override renders inside this wrapper, and this style block is
     scoped, so its markup needs :global() to be reached. Sizing it here means
     a custom chevron lands in the same box as the built-in and rotates with
     the wrapper rather than needing to know the rule exists. */
  .sv-group-chev :global(svg),
  .sv-group-chev :global(img) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .sv-group-chev.open { transform: rotate(90deg); }
  .sv-group-key { font-weight: 600; }
  .sv-group-count { color: var(--sg-muted, #64748b); font-size: 12px; }
  .sv-group-spinner {
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, var(--sg-muted, #64748b) 35%, transparent);
    border-top-color: var(--sg-accent, #2563eb);
    animation: sv-group-spin 0.8s linear infinite;
  }
  @keyframes sv-group-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-group-spinner { animation: none; border-top-color: var(--sg-muted, #64748b); }
  }
  .sv-group-leaf { color: var(--sg-muted, #475569); }
  .sv-group-more {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    font-size: 13px;
    color: var(--sg-accent, #2563eb);
    cursor: pointer;
  }
  .sv-group-more:disabled { color: var(--sg-muted, #64748b); cursor: default; }
  .sv-group-footer { font-weight: 600; color: var(--sg-muted, #64748b); font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
  .sv-group-skeleton {
    display: inline-block;
    width: 60%;
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(90deg, var(--sg-border, #e2e8f0) 25%, var(--sg-header-bg, #f1f5f9) 50%, var(--sg-border, #e2e8f0) 75%);
    background-size: 200% 100%;
    animation: sv-group-shimmer 1.2s infinite;
  }
  @keyframes sv-group-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .sv-group-skeleton { animation: none; } }
</style>
