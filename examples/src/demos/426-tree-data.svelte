<!-- Documented in: docs/help/rows/tree-data.md -->
<script lang="ts">
  /**
   * 426. Tree data
   * --------------
   * `treeData` nests rows into an expandable hierarchy by parent id:
   *
   *   treeData={{ parentField: 'managerId', column: 'name' }}
   *
   * Tree rows stay REAL data rows - own cells, formatting, editing, selection -
   * and only gain an expander plus indent in the tree column. (Row grouping is
   * the other shape: there the parent is a synthetic full-width banner.)
   *
   * Two input shapes, one model:
   *   FLAT   - rows already carry a parent id. Use it directly.
   *   NESTED - objects hold a `children` array. `flattenTreeData` stamps
   *            `__parentId` on each child and returns one flat list.
   */
  import {
    SvGrid,
    flattenTreeData,
    tableFeatures,
    rowSortingFeature,
    type GridColumns,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  // ---- Flat source: an org chart, each row naming its manager -------------
  type Person = {
    id: number
    managerId: number | null
    name: string
    title: string
    location: string
    reports: number
    budget: number
  }

  const people: Person[] = [
    { id: 1,  managerId: null, name: 'Ada Lovelace',      title: 'Chief Executive',    location: 'London',    reports: 10, budget: 4_200_000 },
    { id: 2,  managerId: 1,    name: 'Grace Hopper',      title: 'VP Engineering',     location: 'New York',  reports: 5,  budget: 1_850_000 },
    { id: 3,  managerId: 2,    name: 'Alan Turing',       title: 'Principal Engineer', location: 'Cambridge', reports: 2,  budget: 540_000 },
    { id: 4,  managerId: 3,    name: 'Barbara Liskov',    title: 'Staff Engineer',     location: 'Boston',    reports: 0,  budget: 210_000 },
    { id: 5,  managerId: 3,    name: 'Ken Thompson',      title: 'Staff Engineer',     location: 'Remote',    reports: 0,  budget: 205_000 },
    { id: 6,  managerId: 2,    name: 'Dennis Ritchie',    title: 'Engineering Manager',location: 'New York',  reports: 1,  budget: 420_000 },
    { id: 7,  managerId: 6,    name: 'Brian Kernighan',   title: 'Senior Engineer',    location: 'Princeton', reports: 0,  budget: 190_000 },
    { id: 8,  managerId: 1,    name: 'Margaret Hamilton', title: 'VP Operations',      location: 'Houston',   reports: 2,  budget: 1_100_000 },
    { id: 9,  managerId: 8,    name: 'Katherine Johnson', title: 'Operations Lead',    location: 'Houston',   reports: 1,  budget: 380_000 },
    { id: 10, managerId: 9,    name: 'Dorothy Vaughan',   title: 'Operations Engineer',location: 'Houston',   reports: 0,  budget: 175_000 },
    { id: 11, managerId: 1,    name: 'Linus Torvalds',    title: 'VP Infrastructure',  location: 'Portland',  reports: 0,  budget: 950_000 },
  ]

  // ---- Nested source: a file tree with children arrays --------------------
  type Node = {
    id: number
    name: string
    title: string
    location: string
    reports: number
    budget: number
    children?: Node[]
  }

  const fileTree: Node[] = [
    {
      id: 100, name: 'src', title: 'folder', location: '—', reports: 5, budget: 0,
      children: [
        {
          id: 101, name: 'components', title: 'folder', location: '—', reports: 2, budget: 0,
          children: [
            { id: 102, name: 'Grid.svelte',    title: 'component', location: '18.4 KB', reports: 0, budget: 0 },
            { id: 103, name: 'Toolbar.svelte', title: 'component', location: '6.1 KB',  reports: 0, budget: 0 },
          ],
        },
        {
          id: 104, name: 'lib', title: 'folder', location: '—', reports: 2, budget: 0,
          children: [
            { id: 105, name: 'utils.ts',   title: 'module', location: '3.2 KB', reports: 0, budget: 0 },
            { id: 106, name: 'format.ts',  title: 'module', location: '1.8 KB', reports: 0, budget: 0 },
          ],
        },
        { id: 107, name: 'main.ts', title: 'entry', location: '0.9 KB', reports: 0, budget: 0 },
      ],
    },
    {
      id: 200, name: 'docs', title: 'folder', location: '—', reports: 2, budget: 0,
      children: [
        { id: 201, name: 'readme.md',  title: 'markdown', location: '2.4 KB', reports: 0, budget: 0 },
        { id: 202, name: 'changelog.md', title: 'markdown', location: '5.7 KB', reports: 0, budget: 0 },
      ],
    },
  ]

  // One call converts the nested shape into the flat parent-id shape the model
  // consumes. `__parentId` is the link field it stamps on by default.
  const flattenedFiles = flattenTreeData(fileTree, { childrenField: 'children' })

  type Source = 'org' | 'files'
  let source = $state<Source>('org')

  const orgColumns: GridColumns<Person> = [
    { field: 'name',     header: 'Name',     width: 240 },
    { field: 'title',    header: 'Title',    width: 190 },
    { field: 'location', header: 'Location', width: 130 },
    { field: 'reports',  header: 'Reports',  width: 100, align: 'right' },
    {
      field: 'budget', header: 'Budget', width: 140, align: 'right',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
  ]

  const fileColumns: GridColumns<Node> = [
    { field: 'name',     header: 'Name',    width: 280 },
    { field: 'title',    header: 'Kind',    width: 140 },
    { field: 'location', header: 'Size',    width: 120, align: 'right' },
  ]

  // `expandAllGroups` / `collapseAllGroups` walk the row model's `subRows`,
  // which is exactly what the tree model builds - so they drive a tree too.
  let api = $state<SvGridApi<typeof features, Person | Node> | null>(null)
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Hierarchical rows via <code>treeData</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Click a chevron, or focus a row and press <kbd>→</kbd> / <kbd>←</kbd>. The
      grid uses the <code>treegrid</code> role with <code>aria-level</code> and
      <code>aria-expanded</code>, so screen readers announce the depth. Rows keep
      their own cells - sort by Budget and the hierarchy still holds.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <div class="inline-flex overflow-hidden rounded-md border" style="border-color: var(--sg-border);">
        <button
          type="button" class="px-3 py-1 text-xs"
          style={source === 'org'
            ? 'background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff);'
            : 'background: transparent; color: var(--sg-fg);'}
          onclick={() => (source = 'org')}
        >Flat (parent id)</button>
        <button
          type="button" class="px-3 py-1 text-xs"
          style={source === 'files'
            ? 'background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff);'
            : 'background: transparent; color: var(--sg-fg);'}
          onclick={() => (source = 'files')}
        >Nested (flattened)</button>
      </div>

      <button
        type="button" class="rounded-md border px-3 py-1 text-xs"
        style="border-color: var(--sg-border); color: var(--sg-fg);"
        onclick={() => api?.expandAllGroups()}
      >Expand all</button>
      <button
        type="button" class="rounded-md border px-3 py-1 text-xs"
        style="border-color: var(--sg-border); color: var(--sg-fg);"
        onclick={() => api?.collapseAllGroups()}
      >Collapse all</button>

      <span class="text-xs" style="color: var(--sg-muted);">
        {#if source === 'org'}
          <code>parentField: 'managerId'</code>
        {:else}
          <code>flattenTreeData(tree, &lbrace; childrenField: 'children' &rbrace;)</code>
        {/if}
      </span>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#if source === 'org'}
      <SvGrid
      columnResize
        responsive={true}
        data={people}
        columns={orgColumns}
        {features}
        treeData={{ parentField: 'managerId', column: 'name' }}
        selectionMode="none"
        rowHeight={34}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => (api = a as never)}
      />
    {:else}
      <SvGrid
      columnResize
        responsive={true}
        data={flattenedFiles}
        columns={fileColumns}
        {features}
        treeData={{ parentField: '__parentId', column: 'name' }}
        selectionMode="none"
        rowHeight={34}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => (api = a as never)}
      />
    {/if}
  </div>
</section>
