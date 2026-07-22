# Set filter

A "set filter" (a.k.a. value filter, list filter) shows a checklist of all distinct values in a column and lets the user pick which to include. It's what you reach for to filter `status` to "active OR pending", or `department` to a few specific teams.

![An Excel-style set filter: a per-column checklist of distinct values with a Select all row, search, and a facet count, applying an IN filter to the grid.](/docs-media/grid-set-filter.svg)

<div data-docs-demo="111-set-filter-advanced" data-height="640"></div>

Three patterns are supported, all wired through the imperative `api.setFacetFilter(columnId, values | null)`:

| Mode | UI | Built-in? | When to use |
| --- | --- | --- | --- |
| **Excel-style** | Column-menu Values tab | Yes | Most columns. Distinct values are enumerated from the loaded data; search box + select-all + clear ship out of the box. |
| **Async** | Side panel that loads values from a server endpoint | User-land (one screen of code) | The column has too many distinct values to list at full data load. Lazy-fetch on demand. |
| **Tree-list** | Hierarchical checkboxes (parent ↔ descendants) | User-land (cascade logic) | Nested taxonomies: Region → Country → City; Department → Team → Employee. |

## 1. Excel-style (built-in)

The column menu's Values tab is the default set filter. Click the funnel icon on any header to open it.

What you get without writing any code:

- Distinct values from the current dataset.
- Type-ahead search.
- Select-all / clear toggle.
- Mixed-state preserved as the user scrolls.

Programmatic equivalent for "remember and restore":

```ts
// Capture the current set
const filters = api.getFilters() // includes selectedValues per column

// Restore later (e.g. saved view, URL persistence)
api.setFacetFilter('status', ['active', 'pending'])
api.setFacetFilter('status', null) // clear
```

## 2. Async values (server-loaded)

When a column has tens of thousands of distinct values, you don't want to pre-render them all. Pattern: render a side panel beside the grid, load values from the server on first open, drive the grid via `api.setFacetFilter`:

```ts
let state = $state<{
  status: 'idle' | 'loading' | 'ready' | 'error'
  values: string[]
}>({ state: 'idle', values: [] })
let selected = $state<Set<string>>(new Set())

async function loadValues() {
  state = { state: 'loading', values: [] }
  const res = await fetch('/api/orders/customers')
  const values = await res.json()
  state = { state: 'ready', values }
}

function toggle(value: string) {
  const next = new Set(selected)
  if (next.has(value)) next.delete(value); else next.add(value)
  selected = next
  api.setFacetFilter('customer', next.size === 0 ? null : Array.from(next))
}
```

Key benefits vs the Excel tab:

- **Lazy load** - no client-side enumeration for millions of distinct values.
- **Server can apply policy** - hide values the current user shouldn't see.
- **Static label / dynamic value** - the panel can show pretty labels while the filter applies on the underlying id.

See demo 111 ("Async values" card) for a complete implementation with loading state, retry, and search.

## 3. Tree-list (hierarchical)

For nested taxonomies, render a tree of checkboxes. Parent checked = all descendants checked. Some descendants checked = parent shows the "indeterminate" state. On any change, compute the leaf set and apply it to the column.

```ts
// Taxonomy: Region → Country → City
const GEO = {
  Americas: { 'United States': ['New York', 'San Francisco'], Canada: ['Toronto'] },
  EMEA:     { Germany: ['Berlin', 'Munich'], France: ['Paris'] },
}

let selectedCities = $state<Set<string>>(new Set())

function toggleNode(node: TreeNode, on: boolean) {
  const next = new Set(selectedCities)
  for (const city of node.cities) {  // pre-computed leaf set
    if (on) next.add(city); else next.delete(city)
  }
  selectedCities = next
  api.setFacetFilter('city', next.size === 0 ? null : Array.from(next))
}

function isChecked(node: TreeNode): boolean {
  return node.cities.every((c) => selectedCities.has(c))
}
function isPartial(node: TreeNode): boolean {
  const hits = node.cities.filter((c) => selectedCities.has(c)).length
  return hits > 0 && hits < node.cities.length
}
```

The grid is unaware of the hierarchy - it just receives a flat list of allowed leaf values. The hierarchy lives in your panel UI.

See demo 111 ("Tree" card) and [demo 102: Tree checkbox cascade](#/demos/102-tree-checkbox-cascade) for the cascade-logic recipe.

## API surface

```ts
type SvGridApi<…> = {
  // Set a multi-select set filter. Pass null or [] to clear.
  setFacetFilter(columnId: string, values: ReadonlyArray<string> | null): void

  // Read the current filters (includes the facet selection per column).
  getFilters(): Record<string, { operator: ..., selectedValues?: string[] }>

  // Snapshot of the rows the grid currently displays - useful when your
  // filter UI needs to count matches without re-running the search.
  getDisplayedRows(): ReadonlyArray<TData>
}
```

## See also

- Demo 111: [Set filter - tree / async / Excel mode](#/demos/111-set-filter-advanced)
- Demo 102: [Tree checkbox cascade](#/demos/102-tree-checkbox-cascade) - the cascade recipe used inside the tree filter
- [`api.setFacetFilter`](../api-reference.md#setfacetfilter)
- [Filter API overview](./filter-api.md)
