<script lang="ts">
  /**
   * The "+ Add row" line after the last body row (`rowAdder` prop). The grid
   * renders it through registerGridExtension's `bodyEnd` slot, inside the
   * body, so it scrolls with the rows and sits under the last one.
   *
   * A click appends a row (with `rowAdder.defaults()`), scrolls to it and
   * starts editing its first editable cell, then fires `onRowAdd` so the app
   * can persist the row.
   */
  import { tick } from 'svelte'
  import { newRowValues } from './field-ops'

  type Config = { label?: string; defaults?: () => Record<string, unknown> }
  let { ctrl, foot = false }: { ctrl: any; foot?: boolean } = $props()

  // With a summary row the line goes under it (`foot`), so the sums sit right after the records.
  const config = $derived<Config | null>(
    ctrl.props.rowAdder && foot === !!ctrl.rowSummariesEnabled ? (typeof ctrl.props.rowAdder === 'object' ? ctrl.props.rowAdder : {}) : null,
  )
  const label = $derived(config?.label ?? 'Add row')
  const span = $derived((ctrl.allColumns?.length ?? 0) + 3)

  async function add() {
    const api = ctrl.buildApi?.()
    if (!api || !config) return
    // Field defaults, the next autonumber, the created time; the prop's own defaults win.
    const row: Record<string, unknown> = newRowValues(ctrl, config.defaults?.() ?? {})
    api.addRow(row, 'bottom')
    await tick()
    // Sorting or grouping can put the new row anywhere; find it by identity.
    const index = (ctrl.allRows as Array<{ original: unknown }>).findIndex((r) => r.original === row)
    if (index >= 0) {
      api.scrollToRow(index)
      await tick()
      for (const column of ctrl.allColumns as Array<{ id: string }>) {
        if (api.startEditing(index, column.id)) break
      }
    }
    ctrl.props.onRowAdd?.({ row })
  }
</script>

{#if config}
  <tr class="sv-grid-row sv-field-row-adder" class:is-foot={foot}>
    <!-- overflow and flex inline, over the grid's cell rules: a clipping cell is its own
         scroll box, and the sticky button would not stay at the left edge. -->
    <td class="sv-grid-cell sv-field-row-adder-cell" colspan={span} style="overflow: visible; flex: 1 1 auto;">
      <button type="button" class="sv-field-row-adder-button" onclick={add}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        {label}
      </button>
    </td>
  </tr>
{/if}

<style>
  .sv-field-row-adder-cell {
    flex: 1 1 auto;
    padding: 0;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-field-row-adder:hover > .sv-field-row-adder-cell { background: var(--sg-row-hover-bg, #f8fafc); }
  /* The column headers' ground, as the summary row has: the grid's chrome, not
     a record. In the footer the summary row draws the line between them. */
  .sv-field-row-adder,
  .sv-field-row-adder > .sv-field-row-adder-cell { background: var(--sg-summary-bg, var(--sg-header-bg, #f5f7fb)); }
  .sv-field-row-adder.is-foot > .sv-field-row-adder-cell { border-bottom: 0; }
  .sv-field-row-adder-button {
    position: sticky;
    inset-inline-start: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    min-height: 34px;
    padding: 0 14px;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    font: inherit;
    /* A secondary action: the size of the summary text, not of the records. */
    font-size: 13px;
    cursor: pointer;
  }
  .sv-field-row-adder-button:hover { color: var(--sg-fg, #0f172a); }
  .sv-field-row-adder-button:focus-visible {
    outline: 2px solid var(--sg-accent, #2563eb);
    outline-offset: -2px;
  }
</style>
