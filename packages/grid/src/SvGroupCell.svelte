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
  import type { ServerDisplayRow } from './server-data-source'

  type GroupGridRow = { __group?: ServerDisplayRow<TData> } & Record<string, unknown>
  type Props = {
    /** The grid row from `serverGroupRows` (carries the `__group` marker). */
    row: GroupGridRow
    /**
     * Expand / collapse a group, or load more children. Receives the grid row;
     * wire to `serverGroupNav(ctl).onToggle` (which drives clicks and keyboard).
     */
    onToggle: (row: GroupGridRow) => void
    /** Field to show for leaf rows in the group column (blank if omitted). */
    leafField?: string
    /** Pixels of indentation per level. Default 18. */
    indent?: number
  }

  let { row, onToggle, leafField, indent = 18 }: Props = $props()
  const meta = $derived(row.__group)
</script>

{#if meta && meta.kind === 'group'}
  <button
    type="button"
    class="sv-group-cell"
    style={`padding-inline-start: ${meta.level * indent}px`}
    aria-expanded={meta.expanded}
    aria-label={meta.expanded ? 'Collapse group' : 'Expand group'}
    onclick={() => onToggle(row)}
  >
    <!-- Same chevron the grid's own expanders and SvTree draw, so every
         expander in the library looks identical. -->
    <span class="sv-group-chev" class:open={meta.expanded} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    </span>
    <span class="sv-group-key">{meta.key}</span>
    {#if meta.loading}<span class="sv-group-load" aria-hidden="true">…</span>{/if}
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
  .sv-group-chev {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s;
    color: var(--sg-muted, #64748b);
  }
  .sv-group-chev.open { transform: rotate(90deg); }
  .sv-group-key { font-weight: 600; }
  .sv-group-load { color: var(--sg-muted, #64748b); font-size: 12px; }
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
