<script lang="ts">
  /**
   * The grid mounts this for every cell of a column with a `fieldType` whose
   * type draws its own cell (registerGridExtension's `cell` + `hasCell`). It
   * hands the cell to that type with the column's merged properties.
   */
  import { fieldPropsOf, getFieldType, type FieldCellProps } from './registry.svelte'

  let { ctrl, row, column, value }: Omit<FieldCellProps, 'props'> = $props()
  const type = $derived(getFieldType(column.columnDef.fieldType))
  const props = $derived(fieldPropsOf(column.columnDef as { fieldType?: unknown; fieldProps?: Record<string, unknown> }))
</script>

{#if type?.cell}
  <type.cell {ctrl} {row} {column} {value} {props} />
{:else}
  {value == null ? '' : String(value)}
{/if}

<style>
  /* The view bar's filter (`fieldFilter`) shows on the bar's Filter button. */
  :global(.sv-fields-own-filter .sv-grid-advf-chip) { display: none; }
  :global(.sv-fields-own-filter .sv-grid-toolbar:not(:has(> :not(.sv-grid-advf-chip)))) { display: none; }
  /* rowColor (row-colors.ts): the grid sets --sv-row-mark on each colored row
     and a root class naming the target. Background-image layers, not
     box-shadow: the grid draws the selection outline with box-shadow on
     cells, and layers leave the cell's own background colour underneath. */
  /* The header target is a 3px stripe on the row's leading edge: the color
     says which group a row is in without tinting the row number under it. */
  :global(.sv-fields-rowcolor-header tbody .sv-grid-row-number-cell) {
    background-image: linear-gradient(to right, var(--sv-row-mark, transparent) 3px, transparent 3px);
  }
  :global(.sv-fields-rowcolor-header:dir(rtl) tbody .sv-grid-row-number-cell) {
    background-image: linear-gradient(to left, var(--sv-row-mark, transparent) 3px, transparent 3px);
  }
  :global(.sv-fields-rowcolor-bar tbody tr > td:first-child) {
    background-image: linear-gradient(to right, var(--sv-row-mark, transparent) 3px, transparent 3px);
  }
  :global(.sv-fields-rowcolor-bar:dir(rtl) tbody tr > td:first-child) {
    background-image: linear-gradient(to left, var(--sv-row-mark, transparent) 3px, transparent 3px);
  }
  :global(.sv-fields-rowcolor-row tbody tr > td) {
    background-image: linear-gradient(color-mix(in srgb, var(--sv-row-mark, transparent) 10%, transparent), color-mix(in srgb, var(--sv-row-mark, transparent) 10%, transparent));
  }

  /* Tall rows (row-colors.ts, tallRowClass): content starts at the top and
     uses the height - text wraps to as many lines as fit, select pills wrap,
     attachment thumbnails grow, a long text keeps its line breaks. */
  :global(.sv-fields-lines-2) { --sv-lines: 2; --sv-thumb: 40px; }
  :global(.sv-fields-lines-3) { --sv-lines: 3; --sv-thumb: 56px; }
  :global(.sv-fields-lines-4) { --sv-lines: 4; --sv-thumb: 72px; }
  :global(.sv-fields-lines-5) { --sv-lines: 5; --sv-thumb: 92px; }
  :global(.sv-fields-lines-6) { --sv-lines: 6; --sv-thumb: 108px; }
  :global(.sv-fields-tall tbody > tr > td.sv-grid-cell) {
    align-items: flex-start;
    padding-block: 6px;
  }
  :global(.sv-fields-tall tbody > tr > td > .sv-grid-cell-line) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--sv-lines, 2);
    line-clamp: var(--sv-lines, 2);
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 20px;
  }
  :global(.sv-fields-tall .sv-fsl) {
    flex-wrap: wrap;
    align-content: flex-start;
  }
  /* tbody td: one more than the attachment cell's own scoped rule, so this wins. */
  :global(.sv-fields-tall tbody td .sv-att-thumb) {
    width: var(--sv-thumb, 26px);
    height: var(--sv-thumb, 26px);
  }
  :global(.sv-fields-tall .sv-frx-sep) {
    display: block;
    height: 0;
  }
</style>
