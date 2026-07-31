<script lang="ts" module>
  type MdRow = Record<string, unknown>
</script>

<script lang="ts" generics="TParent extends MdRow, TChild extends MdRow">
  /**
   * SvGridMasterDetail - expand a master row into a nested grid of related
   * records. A feature of the grid's data stack (built on SvGrid's own
   * `isDetailRow` / `renderDetailRow`), not a separate widget. Click a master
   * row to expand or collapse its detail region.
   *
   * Minimal wire-up:
   *   <SvGridMasterDetail
   *     schema={orderSchema}
   *     data={orders}
   *     detailSchema={lineItemSchema}
   *     getChildren={(order) => lineItems.filter((li) => li.orderId === order.id)}
   *   />
   */
  import { SvGrid } from '@svgrid/grid'
  import { resolveIdField, schemaToColumns, type EntitySchema } from './schema'
  import { buildDisplayRows, isDetailRow, toggleExpanded, type DetailRow } from './master-detail'

  type Props = {
    /** The master entity. */
    schema: EntitySchema<TParent>
    /** Master rows. */
    data: ReadonlyArray<TParent>
    /** The detail entity, rendered in the nested grid. */
    detailSchema: EntitySchema<TChild>
    /** Return the child rows for a given master row. */
    getChildren: (parent: TParent) => ReadonlyArray<TChild>
    /** Height of the outer grid. Default 320. */
    containerHeight?: number | string
    /** Height of each nested detail grid. Default 200. */
    detailHeight?: number | string
    /** When set, a parent row click calls this (with the row id) to drill into a
     *  detail page, instead of expanding the inline child grid. */
    onParentClick?: (id: string) => void
  }

  let {
    schema,
    data,
    detailSchema,
    getChildren,
    containerHeight = 320,
    detailHeight = 200,
    onParentClick,
  }: Props = $props()

  const parentIdOf = (p: TParent) => String(p[resolveIdField(schema)])
  const columns = $derived(schemaToColumns(schema))
  const detailColumns = $derived(schemaToColumns(detailSchema))

  let expanded = $state<Set<string>>(new Set())
  // Detail rows are woven in; SvGrid renders them full-width via isDetailRow.
  const displayRows = $derived(buildDisplayRows(data, expanded, parentIdOf) as unknown as TParent[])

  function handleRowClick(row: unknown) {
    if (isDetailRow(row)) return
    // When wired to a detail page, a parent row navigates there (the detail page
    // shows this record's children); otherwise it expands the child grid inline.
    if (onParentClick) { onParentClick(parentIdOf(row as TParent)); return }
    expanded = toggleExpanded(expanded, parentIdOf(row as TParent))
  }
</script>

<SvGrid
  data={displayRows}
  {columns}
  {containerHeight}
  virtualization={false}
  isDetailRow={(row) => isDetailRow(row)}
  onRowClick={(e) => handleRowClick(e.row)}
>
  {#snippet renderDetailRow({ row })}
    {@const parent = (row as unknown as DetailRow<TParent>).parent}
    <div class="sv-md-detail">
      <SvGrid data={getChildren(parent)} columns={detailColumns} containerHeight={detailHeight} />
    </div>
  {/snippet}
</SvGrid>

<style>
  /* `:global` because this div lives in the `renderDetailRow` snippet, which SvGrid
     renders inside ITS OWN tree - a scoped rule can get pruned / not match there, which
     left the detail region with no padding / background. Global keeps it reliable. */
  :global(.sv-md-detail) {
    padding: 10px 12px;
    /* Fall back to the themed header surface (not a fixed light grey) so the
       detail region tracks light/dark - `--sg-bg-subtle` is unset by default,
       which used to leave this white on every dark theme. */
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
    color: var(--sg-fg, inherit);
    border-left: 3px solid var(--sg-accent, #2563eb);
  }
</style>
