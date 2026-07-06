<!--
  title: Release status board
  author: SvGrid team
  github: sv-grid
  tags: editing, custom cells, badges
  discussion: 87
-->
<script lang="ts">
  /**
   * Community demo TEMPLATE
   * -----------------------
   * This is the reference community demo. Copy it to start your own:
   *   1. Duplicate this file into examples/src/demos/community/<your-slug>.svelte
   *   2. Edit the header comment above (title / author / github / tags).
   *      Leave `discussion: 0` - a maintainer sets it once the upvote thread
   *      exists (see examples/src/demos/community/README.md).
   *   3. Keep it self-contained (inline data, only @svgrid/grid imports) so it
   *      runs in the playground and downloads cleanly.
   *
   * What it shows: a small editable board with a custom coloured status badge
   * rendered via `renderSnippet`, plus sort + filter.
   */
  import {
    SvGrid,
    renderSnippet,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  type Task = {
    id: number
    feature: string
    owner: string
    status: 'Shipped' | 'In review' | 'Building' | 'Blocked'
    coverage: number
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let rows = $state<Task[]>([
    { id: 1, feature: 'Draggable splitter',   owner: 'Ada',  status: 'Shipped',   coverage: 100 },
    { id: 2, feature: 'Community gallery',     owner: 'Liam', status: 'In review', coverage: 82 },
    { id: 3, feature: 'AI fix-with-error',     owner: 'Mia',  status: 'Shipped',   coverage: 94 },
    { id: 4, feature: 'CodeMirror editor',     owner: 'Noah', status: 'Building',  coverage: 40 },
    { id: 5, feature: 'Shareable URL state',   owner: 'Zoe',  status: 'Blocked',   coverage: 12 },
  ])

  const columns: ColumnDef<typeof features, Task>[] = [
    { field: 'feature', header: 'Feature', editorType: 'text', width: 190 },
    { field: 'owner',   header: 'Owner',   editorType: 'text', width: 110 },
    {
      field: 'status',
      header: 'Status',
      width: 130,
      cell: (ctx) => renderSnippet(StatusBadge, { value: String(ctx.getValue()) }),
    },
    {
      field: 'coverage',
      header: 'Coverage',
      editorType: 'number',
      width: 110,
      format: { type: 'number', options: { maximumFractionDigits: 0 } },
    },
  ]

  const TONE: Record<string, string> = {
    Shipped: 'badge-green',
    'In review': 'badge-blue',
    Building: 'badge-amber',
    Blocked: 'badge-red',
  }
</script>

{#snippet StatusBadge(props: { value: string })}
  <span class="badge {TONE[props.value] ?? 'badge-slate'}">{props.value}</span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">
    A community-contributed demo. Sort or filter any column; double-click a cell to edit.
  </div>
  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      showRowNumbers={true}
      showPagination={false}
      enableInlineEditing={true}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
  }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-blue  { background: #dbeafe; color: #1e40af; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-red   { background: #fee2e2; color: #991b1b; }
  .badge-slate { background: #e2e8f0; color: #334155; }
</style>
