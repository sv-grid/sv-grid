<svelte:options
  customElement={{
    tag: 'sv-grid',
    shadow: 'none',
    props: {
      data: { type: 'Array' },
      columns: { type: 'Array' },
      sortable: { type: 'Boolean', attribute: 'sortable' },
      filterable: { type: 'Boolean', attribute: 'filterable' },
      selectable: { type: 'Boolean', attribute: 'selectable' },
      editable: { type: 'Boolean', attribute: 'editable' },
      rowHeight: { type: 'Number', attribute: 'row-height' },
    },
  }}
/>

<script>
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  } from 'sv-grid-community'

  let {
    data = [],
    columns = [],
    sortable = true,
    filterable = true,
    selectable = false,
    editable = false,
    rowHeight = 36,
  } = $props()

  // Build the feature set from the boolean attributes.
  const features = $derived(
    tableFeatures({
      ...(sortable ? { rowSortingFeature } : {}),
      ...(filterable ? { columnFilteringFeature } : {}),
      ...(selectable ? { rowSelectionFeature } : {}),
    }),
  )

  // Re-emit grid callbacks as DOM CustomEvents so non-Svelte hosts can listen
  // with addEventListener(...). $host() is the <sv-grid> element itself.
  function emit(name, detail) {
    $host().dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    )
  }
</script>

<div style="height: 100%; min-height: 320px;">
  <SvGrid
    {data}
    {columns}
    features={features}
    filterMode="menu"
    selectionMode="row"
    showRowSelection={selectable}
    enableInlineEditing={editable}
    {rowHeight}
    containerHeight="100%"
    fitColumns={true}
    onRowClick={(e) => emit('rowclick', e.row)}
    onRowSelectionChange={(_e, sel) => emit('selectionchange', sel)}
  />
</div>
