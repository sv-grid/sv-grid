# Applying filters

"Applying" a filter means running it against the data. SvGrid applies
filters **eagerly** by default: every keystroke updates the row model and
the visible rows (with a 150ms debounce inside the column menu's value
input).
<div data-docs-demo="02-sort-filter-paginate" data-height="540"></div>

## Apply on Enter (manual)

If you want the classic "apply"-button pattern (no filter runs until the
user confirms), run in `externalFilter` mode and only push a new
pre-filtered `data` array on commit:

```svelte
<script lang="ts">
  let pending = $state('')
  let applied = $state('')
  const filtered = $derived(
    applied ? rows.filter((r) => r.name.toLowerCase().includes(applied.toLowerCase())) : rows,
  )
  function commit() { applied = pending }
</script>

<input bind:value={pending} onkeydown={(e) => e.key === 'Enter' && commit()} />
<button onclick={commit}>Apply</button>

<SvGrid
  data={filtered}
  columns={columns}
  features={features}
  filterMode="none"
  externalFilter={true}
/>
```

The grid's own column-menu filter applies as the user types - there is
no built-in "Apply" button. Use the pattern above when you need explicit
commit semantics.

## Apply against the server

When data is server-side, filtering happens on the backend. Mirror the
state pattern but issue a request from the change handler. See
[demos/09-server-side.svelte](../../../examples/src/demos/09-server-side.svelte)
for the canonical implementation with debounce + abort.

## Apply once, then freeze

To take a snapshot:

```ts
const filteredData = api.getData().filter(myPredicate)
// pass filteredData into a separate <SvGrid> with filterMode="none"
```

This works when you want to render the filtered result inside an
export-friendly grid that's independent of the user's current filters.

## See also

- [Applying filters - server-side variant](../../getting-started.md#11-server-side-data)
- [Filter API](./filter-api.md)
