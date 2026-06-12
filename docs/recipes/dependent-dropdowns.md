# Dependent dropdowns (cascading editors)

`Country → State → City`. Editing one level resets downstream
levels; each cell's dropdown options come from the row's upstream
value.

```ts
const REGIONS: Record<string, Record<string, string[]>> = {
  USA:     { California: ['SF', 'LA', 'San Diego'], Texas: ['Austin', 'Dallas'] },
  Germany: { Bavaria: ['Munich', 'Nuremberg'],     Berlin: ['Berlin'] },
}

const columns: ColumnDef<typeof features, Region>[] = [
  { field: 'country', editorType: 'list',
    editorOptions: () => Object.keys(REGIONS) },
  { field: 'state', editorType: 'list',
    editorOptions: (row) => Object.keys(REGIONS[row.country] ?? {}) },
  { field: 'city', editorType: 'list',
    editorOptions: (row) => REGIONS[row.country]?.[row.state] ?? [] },
]
```

The `(row) => options` form is what makes the cascade work: every
cell re-computes its options from the row's current value at edit
time.

## Reset downstream on upstream change

When `country` changes, the row's `state` and `city` may now be
invalid. Catch the cell change and snap them to a sane default:

```svelte
<SvGrid
  {data} {columns} features={features}
  onCellValueChange={(e) => {
    if (!api) return
    if (e.columnId === 'country') {
      const newCountry = String(e.newValue)
      const firstState = Object.keys(REGIONS[newCountry] ?? {})[0] ?? ''
      const firstCity  = (REGIONS[newCountry]?.[firstState] ?? [])[0] ?? ''
      api.setCellValue(e.rowIndex, 'state', firstState)
      api.setCellValue(e.rowIndex, 'city',  firstCity)
    } else if (e.columnId === 'state') {
      const row = rows[e.rowIndex]
      const firstCity = (REGIONS[row.country]?.[String(e.newValue)] ?? [])[0] ?? ''
      api.setCellValue(e.rowIndex, 'city', firstCity)
    }
  }}
  onApiReady={(next) => (api = next)}
/>
```

Live in [demo 68 (Dependent dropdowns)](https://svgrid.com/#/demos/68-dependent-dropdowns)
- includes a typeahead combobox + a one-click "Fix" button when seed
data leaves the cascade in an inconsistent state.

## See also

- [Provided cell editors](../help/editing/provided-editors.md) - the built-in editor set
- [Edit components](../help/editing/edit-components.md) - rolling your own
